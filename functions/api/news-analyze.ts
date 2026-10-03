/**
 * POST /api/news-analyze
 * Body: { title: string, text?: string, source?: string, url?: string }
 * Calls an LLM (OpenAI / xAI / Groq – OpenAI-compatible) and returns ONLY:
 * {
 *   sintesi, asset_coinvolti[], direzione, forza, orizzonte,
 *   meccanismo, rischi[], livelli_da_osservare, confidenza
 * }
 * No synthetic market data. Requires one of OPENAI_API_KEY | XAI_API_KEY | GROQ_API_KEY.
 */

import {
  cors,
  json,
  bad,
  readJsonBody,
  checkRateLimit,
  clientIp,
  type Env as AuthEnv,
} from './auth/_shared'

interface AnalyzeEnv extends AuthEnv {
  OPENAI_API_KEY?: string
  XAI_API_KEY?: string
  GROQ_API_KEY?: string
  /** Optional model override, e.g. gpt-4o-mini */
  NEWS_ANALYZE_MODEL?: string
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
}

const SYSTEM = `Sei un analista di mercato crypto/macro. Ricevi titolo e testo di una notizia.
Rispondi SOLO con un oggetto JSON valido (nessun markdown, nessun testo extra) con esattamente queste chiavi:
{
  "sintesi": string (2-4 frasi, italiano, fatto-based),
  "asset_coinvolti": string[] (ticker base es. BTC, ETH, o "macro"),
  "direzione": "rialzista" | "ribassista" | "neutra",
  "forza": number intero 1-5,
  "orizzonte": "minuti" | "ore" | "giorni",
  "meccanismo": string (come la notizia può influenzare prezzo/flussi),
  "rischi": string[] (2-5 rischi o confutazioni),
  "livelli_da_osservare": string (prezzi, date, eventi da monitorare; se non noti, descrivi qualitativamente),
  "confidenza": number 0-1
}
Non inventare prezzi numerici precisi se non nel testo. Non dare consigli di investimento.`

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

function normalizeAnalysis(raw: unknown): NewsImpactAnalysis | null {
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

  const sintesi = String(o.sintesi ?? '').trim()
  if (!sintesi) return null

  return {
    sintesi,
    asset_coinvolti: asStringArray(o.asset_coinvolti),
    direzione,
    forza: clampInt(o.forza, 1, 5, 3),
    orizzonte,
    meccanismo: String(o.meccanismo ?? '').trim() || 'Non specificato',
    rischi: asStringArray(o.rischi),
    livelli_da_osservare: String(o.livelli_da_osservare ?? '').trim() || '—',
    confidenza: clamp01(o.confidenza, 0.4),
  }
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    /* try fenced or embedded */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim())
    } catch {
      /* continue */
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
      temperature: 0.2,
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

  const provider = pickProvider(env)
  if (!provider) {
    return bad(
      'AI not configured: set OPENAI_API_KEY, XAI_API_KEY, or GROQ_API_KEY on Pages',
      503,
      request
    )
  }

  // Soft rate limit per IP when KV is available
  if (env.WORKSPACE_KV) {
    const ip = clientIp(request)
    const rl = await checkRateLimit(env.WORKSPACE_KV, `news-analyze:${ip}`, 20, 60)
    if (!rl.ok) {
      return json(
        { error: 'rate limit', retryAfterSec: rl.retryAfterSec },
        429,
        request,
        { 'Retry-After': String(rl.retryAfterSec) }
      )
    }
  }

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

  try {
    const rawContent = await callLlm(provider, title, text, source)
    const parsed = extractJsonObject(rawContent)
    const analysis = normalizeAnalysis(parsed)
    if (!analysis) {
      return bad('model returned invalid analysis JSON', 502, request)
    }
    // Return ONLY the analysis object as requested (plus minimal meta for debug)
    return json(analysis, 200, request)
  } catch (e) {
    const status = (e as { status?: number })?.status
    const msg = e instanceof Error ? e.message : 'analyze failed'
    if (status === 401 || status === 403) {
      return bad('AI provider rejected the API key', 502, request)
    }
    if (status === 429) {
      return bad('AI provider rate limited — retry later', 429, request)
    }
    return bad(msg.slice(0, 300), 502, request)
  }
}
