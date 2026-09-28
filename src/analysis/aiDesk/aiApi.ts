/**
 * AI API providers – user-selected, keys in localStorage only.
 * OpenAI-compatible chat completions + local fallback.
 */

import type { TaReport } from './taEngine'
import type { SmcReport } from './smcEngine'
import type { AiMode } from './chatEngine'
import { answerMessage } from './chatEngine'

export type AiProviderId =
  | 'local'
  | 'xai'
  | 'openai'
  | 'openrouter'
  | 'groq'
  | 'custom'

export interface AiProviderMeta {
  id: AiProviderId
  label: string
  baseUrl: string
  defaultModel: string
  needsKey: boolean
  docs?: string
}

export const AI_PROVIDERS: AiProviderMeta[] = [
  {
    id: 'local',
    label: 'Local (built-in)',
    baseUrl: '',
    defaultModel: 'rule-engine',
    needsKey: false,
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-2-latest',
    needsKey: true,
    docs: 'https://console.x.ai',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    needsKey: true,
    docs: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    needsKey: true,
    docs: 'https://openrouter.ai/keys',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    needsKey: true,
    docs: 'https://console.groq.com/keys',
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    baseUrl: '',
    defaultModel: 'gpt-4o-mini',
    needsKey: true,
  },
]

const SETTINGS_KEY = 'tt-ai-api:v1'

export interface AiApiSettings {
  provider: AiProviderId
  apiKey: string
  model: string
  customBaseUrl: string
}

export const DEFAULT_AI_SETTINGS: AiApiSettings = {
  provider: 'local',
  apiKey: '',
  model: 'rule-engine',
  customBaseUrl: '',
}

export function loadAiSettings(): AiApiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_AI_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AiApiSettings>
    return { ...DEFAULT_AI_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_AI_SETTINGS }
  }
}

export function saveAiSettings(s: AiApiSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

function providerMeta(id: AiProviderId): AiProviderMeta {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0]
}

function buildSystemPrompt(
  mode: AiMode,
  report: TaReport | null,
  smc: SmcReport | null
): string {
  const lines = [
    'You are a crypto market desk assistant inside a trading terminal.',
    'Use ONLY the market context provided. Do not invent prices.',
    'Be concise. Italian or English matching the user.',
    'Not financial advice. Structure, levels, risk framing only.',
    `Active analysis mode: ${mode}`,
  ]
  if (report?.last) {
    lines.push(
      `Context: ${report.symbol} ${report.interval}`,
      `Last ${report.last.close} bias ${report.bias} rangePos ${report.rangePos.toFixed(0)}%`,
      `Supports: ${report.supports.join(', ') || '—'}`,
      `Resistances: ${report.resistances.join(', ') || '—'}`,
      ...report.summary
    )
  }
  if (smc) {
    lines.push('SMC:', ...smc.summary)
    const openFvg = smc.fvgs.filter((z) => !z.mitigated).slice(-3)
    for (const z of openFvg) {
      lines.push(`FVG ${z.kind} ${z.bottom}-${z.top}`)
    }
    for (const ob of smc.orderBlocks.slice(-3)) {
      lines.push(`OB ${ob.kind} ${ob.bottom}-${ob.top}`)
    }
    if (smc.volumeProfile) {
      const vp = smc.volumeProfile
      lines.push(`VP POC ${vp.poc} VAL ${vp.val} VAH ${vp.vah}`)
    }
  }
  return lines.join('\n')
}

export async function callAiChat(
  userMessage: string,
  settings: AiApiSettings,
  mode: AiMode,
  report: TaReport | null,
  smc: SmcReport | null
): Promise<{ text: string; source: string }> {
  // Always allow local
  if (settings.provider === 'local') {
    const { text } = answerMessage(userMessage, report, mode, smc)
    return { text, source: 'local' }
  }

  const meta = providerMeta(settings.provider)
  const baseUrl =
    settings.provider === 'custom'
      ? settings.customBaseUrl.replace(/\/$/, '')
      : meta.baseUrl.replace(/\/$/, '')

  if (!baseUrl) {
    throw new Error('Imposta Custom Base URL (es. https://api.example.com/v1)')
  }
  if (meta.needsKey && !settings.apiKey.trim()) {
    throw new Error(`API key richiesta per ${meta.label}`)
  }

  const model =
    settings.model.trim() ||
    meta.defaultModel ||
    'gpt-4o-mini'

  const system = buildSystemPrompt(mode, report, smc)
  const url = `${baseUrl}/chat/completions`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${settings.apiKey.trim()}`,
  }
  if (settings.provider === 'openrouter') {
    headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : ''
    headers['X-Title'] = 'Trading Terminal'
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 900,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200) || res.statusText}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('Risposta API vuota')

  return { text, source: `${meta.label} · ${model}` }
}
