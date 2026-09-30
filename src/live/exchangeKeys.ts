const KEY = 'tt-live-keys:v1'

export interface ExchangeKeyBlob {
  exchange: string
  apiKey: string
  apiSecret: string
  passphrase?: string
  disclosureAcceptedAt?: number
}

export function loadLiveKeys(): ExchangeKeyBlob | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as ExchangeKeyBlob
  } catch {
    return null
  }
}

export function saveLiveKeys(blob: ExchangeKeyBlob) {
  sessionStorage.setItem(KEY, JSON.stringify(blob))
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* */
  }
}

export function clearLiveKeys() {
  try {
    sessionStorage.removeItem(KEY)
    localStorage.removeItem(KEY)
  } catch {
    /* */
  }
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const LIVE_DISCLOSURE = `
LIVE TRADING DISCLOSURE

• API keys and secrets are stored only in this browser tab (sessionStorage).
• They are never transmitted to trading-terminal / Cloudflare backend in clear text.
• Any signed live order requests go directly from your browser to the exchange.
• You are solely responsible for key permissions (prefer trade-only, IP-restricted keys).
• Paper mode remains the default. Enabling live is at your own risk.
• Past performance and paper results do not guarantee live results.
`.trim()
