/**
 * AI API providers – user keys in sessionStorage only (not localStorage).
 * Cleared when the tab closes. Never send keys to our backend.
 * OpenAI-compatible chat completions + local fallback.
 */

import type { TaReport } from './taEngine'
import type { SmcReport } from './smcEngine'
import type { LiquidityReport } from './liquidityEngine'
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
    let raw = sessionStorage.getItem(SETTINGS_KEY)
    if (!raw) {
      raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) {
        sessionStorage.setItem(SETTINGS_KEY, raw)
        localStorage.removeItem(SETTINGS_KEY)
      }
    }
    if (!raw) return { ...DEFAULT_AI_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AiApiSettings>
    return {
      ...DEFAULT_AI_SETTINGS,
      ...parsed,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey.slice(0, 256) : '',
    }
  } catch {
    return { ...DEFAULT_AI_SETTINGS }
  }
}

export function saveAiSettings(s: AiApiSettings) {
  try {
    const safe = {
      ...s,
      apiKey: (s.apiKey || '').slice(0, 256),
    }
    sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(safe))
    localStorage.removeItem(SETTINGS_KEY)
  } catch {
    /* quota / private mode */
  }
}

export function clearAiSettings() {
  try {
    sessionStorage.removeItem(SETTINGS_KEY)
    localStorage.removeItem(SETTINGS_KEY)
  } catch {
    /* */
  }
}

function providerMeta(id: AiProviderId): AiProviderMeta {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0]!
}

function buildSystemPrompt(
  mode: AiMode,
  report: TaReport | null,
  smc: SmcReport | null,
  liq: LiquidityReport | null = null
): string {
  const lines = [
    'You are a crypto market desk assistant inside a trading terminal.',
    'Use ONLY the market context provided. Do not invent prices.',
    'Be concise. Italian or English matching the user.',
  ]
  if (report) {
    lines.push(`TA: ${JSON.stringify(report).slice(0, 2000)}`)
  }
  if (smc) {
    lines.push(`SMC: ${JSON.stringify(smc).slice(0, 2000)}`)
  }
  if (liq) {
    lines.push(
      `Liquidity: ${JSON.stringify(liq.summary).slice(0, 800)} bias=${liq.bias} score=${liq.score}`
    )
  }
  lines.push(`Mode: ${mode}`)
  return lines.join('\n')
}

/**
 * Primary API used by AiAnalysisPanel.
 * callAiChat(message, settings, mode, ta, smc, liq?) → { text, source }
 */
export async function callAiChat(
  userMessage: string,
  settings: AiApiSettings,
  mode: AiMode,
  report: TaReport | null,
  smc: SmcReport | null,
  liq: LiquidityReport | null = null
): Promise<{ text: string; source: string }> {
  if (settings.provider === 'local') {
    const res = answerMessage(userMessage, report, mode, smc, liq)
    return { text: res.text, source: 'local' }
  }
  const meta = providerMeta(settings.provider)
  const base =
    settings.provider === 'custom'
      ? settings.customBaseUrl.replace(/\/$/, '')
      : meta.baseUrl
  if (!base) throw new Error('Missing base URL')
  if (meta.needsKey && !settings.apiKey.trim()) throw new Error('API key required')

  const model = settings.model.trim() || meta.defaultModel
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt(mode, report, smc, liq) },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`AI HTTP ${res.status}: ${errText.slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('Empty AI response')
  return { text, source: meta.label }
}

/** Alias kept for scripts/tests that used the old name/order. */
export async function runAiChat(
  userMessage: string,
  mode: AiMode,
  settings: AiApiSettings,
  report: TaReport | null,
  smc: SmcReport | null,
  liq: LiquidityReport | null = null
): Promise<string> {
  const r = await callAiChat(userMessage, settings, mode, report, smc, liq)
  return r.text
}
