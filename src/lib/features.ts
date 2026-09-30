/**
 * Runtime feature flags (Vite env at build time).
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

export const FEATURES = {
  allowGuest: envFlag('VITE_ALLOW_GUEST', true),
  autoCloudLayout: envFlag('VITE_AUTO_CLOUD_LAYOUT', true),
  liveKeysUi: envFlag('VITE_LIVE_KEYS_UI', true),
  indicatorPlugins: envFlag('VITE_INDICATOR_PLUGINS', true),
} as const
