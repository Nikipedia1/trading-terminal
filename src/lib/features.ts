/**
 * Feature flags – Vite build env + runtime localStorage overrides for rollback.
 * Runtime key: tt-feature-flags:v1
 */

function envFlag(key: string, defaultOn = false): boolean {
  try {
    const v = (import.meta as { env?: Record<string, string> }).env?.[key]
    if (v === '1' || v === 'true') return true
    if (v === '0' || v === 'false') return false
  } catch {
    /* */
  }
  return defaultOn
}

type FlagKey =
  | 'allowGuest'
  | 'autoCloudLayout'
  | 'liveKeysUi'
  | 'indicatorPlugins'
  | 'newsPanel'
  | 'aiAnalyze'
  | 'liveTrading'
  | 'opsPanel'

const RUNTIME_KEY = 'tt-feature-flags:v1'

function readRuntime(): Partial<Record<FlagKey, boolean>> {
  try {
    const raw = localStorage.getItem(RUNTIME_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Partial<Record<FlagKey, boolean>>
  } catch {
    return {}
  }
}

function resolve(key: FlagKey, envKey: string, defaultOn: boolean): boolean {
  const rt = readRuntime()
  if (typeof rt[key] === 'boolean') return rt[key]!
  return envFlag(envKey, defaultOn)
}

export const FEATURES = {
  get allowGuest() {
    return resolve('allowGuest', 'VITE_ALLOW_GUEST', false)
  },
  get autoCloudLayout() {
    return resolve('autoCloudLayout', 'VITE_AUTO_CLOUD_LAYOUT', true)
  },
  get liveKeysUi() {
    return resolve('liveKeysUi', 'VITE_LIVE_KEYS_UI', true)
  },
  get indicatorPlugins() {
    return resolve('indicatorPlugins', 'VITE_INDICATOR_PLUGINS', true)
  },
  get newsPanel() {
    return resolve('newsPanel', 'VITE_NEWS_PANEL', true)
  },
  get aiAnalyze() {
    return resolve('aiAnalyze', 'VITE_AI_ANALYZE', true)
  },
  get liveTrading() {
    return resolve('liveTrading', 'VITE_LIVE_TRADING', true)
  },
  get opsPanel() {
    return resolve('opsPanel', 'VITE_OPS_PANEL', true)
  },
} as const

export function setFeatureOverride(key: FlagKey, value: boolean | null) {
  const cur = readRuntime()
  if (value === null) delete cur[key]
  else cur[key] = value
  try {
    localStorage.setItem(RUNTIME_KEY, JSON.stringify(cur))
  } catch {
    /* */
  }
}

export function listFeatureOverrides(): Partial<Record<FlagKey, boolean>> {
  return readRuntime()
}

export type { FlagKey }
