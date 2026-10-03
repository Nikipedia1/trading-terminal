/**
 * POST /api/news-analyze
 * Guardrails: no buy/sell advice, confidence + sources, disclaimer meta.
 * Quota per user/IP, KV cache, heuristic fallback if LLM down.
 */

import {
  cors,
  json,
  bad,
  readJsonBody,
  checkRateLimit,
  clientIp,
  extractToken,
  getSession,
  type Env as AuthEnv,
} from './auth/_shared'

interface AnalyzeEnv extends AuthEnv {
  OPENAI_API_KEY?: string
  XAI_API_KEY?: string
  GROQ_API_KEY?: string
  NEWS_ANALYZE_MODEL?: string
  /** Max AI analyzes per user/IP per hour (default 15) */
  NEWS_ANALYZE_QUOTA_HOUR?: string
}

export type Direzione = 'rialzista' | 'ribassista' | 'neutra'
export type Orizzonte = 'minuti' | 'ore' | 'giorni'

export interface NewsImpactAnalysis {
  sintesi: string
  asset_coinvolti: string[]
  direzione: Direzione
  forza: number
  orizzonte: Orizzonte
  meccanismo: string
  rischi: string[]
  livelli_da_osservare: string
  confidenza: number
  fonti?: string[]
  disclaimer: string
  meta?: {
    provider?: string
    cached?: boolean
    fallback?: boolean
    quotaRemaining?: number
  }
}

const DISCLAIMER =
  'Interpretazione AI, non consiglio finanziario. Nessun invito a comprare o vendere.'

const SYSTEM = `Sei un analista educativo di mercato crypto/macro. Ricevi titolo e testo di una notizia.
Rispondi SOLO con un oggetto JSON valido (nessun markdown) con queste chiavi:
{
  "sintesi": string (2-4 frasi, italiano, fatto-based),
  "asset_coinvolti": string[] (ticker base es. BTC, ETH, o "macro"),
  "direzione": "rialzista" | "ribassista" | "neutra",
  "forza": number intero 1-5,
  "orizzonte": "minuti" | "ore" | "giorni",
  "meccanismo": string (canali di impatto plausibili: flussi, risk-on/off, funding, liquidazioni…),
  "rischi": string[] (2-5 confutazioni o rischi),
  "livelli_da_osservare": string (eventi/date/aree qualitative; NO prezzi inventati),
  "confidenza": number 0-1,
  "fonti": string[] (citazioni dal testo o nome outlet; se assenti: [])
}
VIETATO:
- Consigli di trading ("compra", "vendi", "buy now", "sell now", "entra long/short", "leverage").
- Target price o stop inventati non presenti nel testo.
- Linguaggio prescrittivo verso l'utente.
Se l'impatto è incerto, usa direzione "neutra" e confidenza bassa.`

const FORBIDDEN =
  /\b(buy now|sell now|compra ora|vendi ora|devi comprare|devi vendere|entra long|entra short|leverage alto|all-in)\b/gi

function scrubAdvice(s: string): string {
  return s.replace(FORBIDDEN, '[redacted]').trim()
}

function pickProvider(env: AnalyzeEnv): {
  key: string
  base: string
  model: string
  name: string
} | null {
  if (env.OPENAI_API_KEY) {
    return {
      key: env.OPENAI_API_KEY,
      base: 'https://api.openai.com/v1',
      model: env.NEWS_ANALYZE_MODEL || 'gpt-4o-mini',
      name: 'openai',
    }
  }
  if (env.XAI_API_KEY) {
    return {
      key: env.XAI_API_KEY,
      base: 'https://api.x.ai/v1',
      model: env.NEWS_ANALYZE_MODEL || 'grok-3-mini',
      name: 'xai',
    }
  }
  if (env.GROQ_API_KEY) {
    return {
      key: env.GROQ_API_KEY,
      base: 'https://api.groq.com/openai/v1',
      model: env.NEWS_ANALYZE_MODEL || 'llama-3.3-70b-versatile',
      name: 'groq',
    }
  }
  return null
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, Math.round(v)))
}

function clamp01(n: unknown, fallback = 0.4): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.min(1, Math.max(0, v))
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .slice(0, 12)
}

function normalizeAnalysis(raw: unknown, extra?: Partial<NewsImpactAnalysis>): NewsImpactAnalysis | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const direzioneRaw = String(o.direzione ?? '').toLowerCase()
  let direzione: Direzione = 'neutra'
  if (direzioneRaw.includes('rialz') || direzioneRaw === 'bullish') direzione = 'rialzista'
  else if (direzioneRaw.includes('ribass') || direzioneRaw === 'bearish') direzione = 'ribassista'

  const orizzonteRaw = String(o.orizzonte ?? '').toLowerCase()
  let orizzonte: Orizzonte = 'ore'
  if (orizzonteRaw.startsWith('min')) orizzonte = 'minuti'
  else if (orizzonteRaw.startsWith('giorn') || orizzonteRaw.startsWith('day')) orizzonte = 'giorni'
  else if (orizzonteRaw.startsWith('or')) orizzonte = 'ore'

  const sintesi = scrubAdvice(String(o.sintesi ?? '').trim())
  if (!sintesi) return null

  return {
    sintesi,
    asset_coinvolti: asStringArray(o.asset_coinvolti),
    direzione,
    forza: clampInt(o.forza, 1, 5, 3),
    orizzonte,
    meccanismo: scrubAdvice(String(o.meccanismo ?? '').trim()) || 'Non specificato',
    rischi: asStringArray(o.rischi).map(scrubAdvice),
    livelli_da_osservare:
      scrubAdvice(String(o.livelli_da_osservare ?? '').trim()) || '—',
    confidenza: clamp01(o.confidenza, 0.4),
    fonti: asStringArray(o.fonti),
    disclaimer: DISCLAIMER,
    ...extra,
  }
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    /* */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim())
    } catch {
      /* */
    }
  }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      return null
    }
  }
  return null
}

async function digestKey(title: string, text: string): Promise<string> {
  const data = new TextEncoder().encode(`${title}\n${text.slice(0, 2000)}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

function heuristicFallback(title: string, text: string, source: string): NewsImpactAnalysis {
  const blob = `${title} ${text}`.toLowerCase()
  let direzione: Direzione = 'neutra'
  if (/\b(surge|rally|approval|etf inflows?|rate cut|bullish)\b/.test(blob)) direzione = 'rialzista'
  if (/\b(hack|ban|lawsuit|outflow|crash|bearish|inflation hot)\b/.test(blob)) direzione = 'ribassista'
  const assets: string[] = []
  for (const a of ['BTC', 'ETH', 'SOL', 'macro']) {
    if (a === 'macro') {
      if (/\b(fomc|cpi|nfp|fed|inflation)\b/i.test(blob)) assets.push('macro')
    } else if (new RegExp('\\b' + a + '\\b', 'i').test(blob)) assets.push(a)
  }
  return {
    sintesi: scrubAdvice(
      `Analisi euristica (modello AI non disponibile): la notizia «${title.slice(0, 120)}» richiede verifica sulle fonti primarie. Nessuna raccomandazione operativa.`
    ),
    asset_coinvolti: assets.length ? assets : ['macro'],
    direzione,
    forza: 2,
    orizzonte: 'ore',
    meccanismo:
      'Classificazione basata su parole-chiave; non sostituisce lettura del testo completo né dati di mercato real-time.',
    rischi: [
      'Possibile falsa polarità da keyword matching',
      'Titolo clickbait non rappresentativo del corpo',
      'Eventi già prezzati dal mercato',
    ],
    livelli_da_osservare:
      'Attendere conferma da fonti ufficiali e reazione del prezzo dopo pubblicazione completa.',
    confidenza: 0.25,
    fonti: source ? [source] : [],
    disclaimer: DISCLAIMER,
    meta: { fallback: true, provider: 'heuristic' },
  }
}

async function callLlm(
  provider: NonNullable<ReturnType<typeof pickProvider>>,
  title: string,
  text: string,
  source: string
): Promise<string> {
  const userContent = [
    `Titolo: ${title}`,
    source ? `Fonte: ${source}` : '',
    text ? `Testo:\n${text.slice(0, 6000)}` : 'Testo: (non disponibile — analizza solo il titolo)',
    'Ricorda: nessun consiglio buy/sell; solo interpretazione educativa.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const res = await fetch(`${provider.base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.15,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw Object.assign(new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 200)}`), {
      status: res.status,
    })
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty LLM response')
  return content
}

export const onRequestOptions: PagesFunction<AnalyzeEnv> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestPost: PagesFunction<AnalyzeEnv> = async (ctx) => {
  const { request, env } = ctx

  const body = await readJsonBody<{
    title?: string
    text?: string
    source?: string
    url?: string
  }>(request, 24_000)
  if (!body.ok) return body.response

  const title = String(body.data.title ?? '').trim()
  if (!title || title.length < 3) {
    return bad('title required (min 3 chars)', 400, request)
  }
  const text = String(body.data.text ?? '').trim()
  const source = String(body.data.source ?? '').trim()

  const quotaRemaining: number | undefined = undefined
  const quotaHour = Math.max(1, Number(env.NEWS_ANALYZE_QUOTA_HOUR || 15) || 15)

  if (env.WORKSPACE_KV) {
    let subject = clientIp(request)
    try {
      const token = extractToken(request)
      if (token) {
        const sess = await getSession(env.WORKSPACE_KV, token)
        if (sess?.userId) subject = `u:${sess.userId}`
      }
    } catch {
      /* */
    }
    const rl = await checkRateLimit(
      env.WORKSPACE_KV,
      `news-analyze-quota:${subject}`,
      quotaHour,
      3600
    )
    if (!rl.ok) {
      return json(
        {
          error: 'quota exceeded',
          retryAfterSec: rl.retryAfterSec,
          disclaimer: DISCLAIMER,
        },
        429,
        request,
        { 'Retry-After': String(rl.retryAfterSec) }
      )
    }
    const burst = await checkRateLimit(
      env.WORKSPACE_KV,
      `news-analyze:ip:${clientIp(request)}`,
      30,
      60
    )
    if (!burst.ok) {
      return json(
        { error: 'rate limit', retryAfterSec: burst.retryAfterSec, disclaimer: DISCLAIMER },
        429,
        request,
        { 'Retry-After': String(burst.retryAfterSec) }
      )
    }

    const hash = await digestKey(title, text)
    const cacheKey = `ai:news-analyze:${hash}`
    try {
      const cached = await env.WORKSPACE_KV.get(cacheKey, 'json')
      if (cached && typeof cached === 'object') {
        const analysis = normalizeAnalysis(cached, {
          disclaimer: DISCLAIMER,
          meta: { cached: true, quotaRemaining },
        })
        if (analysis) return json(analysis, 200, request)
      }
    } catch {
      /* */
    }
  }

  const provider = pickProvider(env)
  if (!provider) {
    return json(heuristicFallback(title, text, source), 200, request)
  }

  try {
    const rawContent = await callLlm(provider, title, text, source)
    const parsed = extractJsonObject(rawContent)
    const analysis = normalizeAnalysis(parsed, {
      disclaimer: DISCLAIMER,
      meta: { provider: provider.name, cached: false, quotaRemaining },
    })
    if (!analysis) {
      return json(
        {
          ...heuristicFallback(title, text, source),
          meta: { fallback: true, provider: provider.name },
        },
        200,
        request
      )
    }
    if (!analysis.fonti?.length && source) analysis.fonti = [source]

    if (env.WORKSPACE_KV) {
      try {
        const hash = await digestKey(title, text)
        await env.WORKSPACE_KV.put(`ai:news-analyze:${hash}`, JSON.stringify(analysis), {
          expirationTtl: 60 * 60 * 6,
        })
      } catch {
        /* */
      }
    }

    return json(analysis, 200, request)
  } catch (e) {
    const status = (e as { status?: number })?.status
    if (status === 429 || status === 500 || status === 502 || status === 503 || !status) {
      const fb = heuristicFallback(title, text, source)
      fb.meta = { ...fb.meta, fallback: true, provider: provider.name }
      return json(fb, 200, request)
    }
    if (status === 401 || status === 403) {
      return bad('AI provider rejected the API key', 502, request)
    }
    const msg = e instanceof Error ? e.message : 'analyze failed'
    return bad(msg.slice(0, 300), 502, request)
  }
}
