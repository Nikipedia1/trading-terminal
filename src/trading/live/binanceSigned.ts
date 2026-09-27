/**
 * Binance signed REST – client-side only, opt-in live.
 * Requires unlocked session credentials from vault.
 * Never logs apiSecret. Rate limits / IP restrictions apply.
 */

import { getSessionCredentials, type LiveVenue } from '@/trading/credentials/vault'
import { auditAppend } from '@/trading/audit/auditLog'

const SPOT = 'https://api.binance.com'
const FAPI = 'https://fapi.binance.com'

async function hmacSha256(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface LiveOrderRequest {
  venue: LiveVenue
  symbol: string
  side: 'BUY' | 'SELL'
  type: 'MARKET' | 'LIMIT'
  quantity: number
  price?: number
  /** Futures only */
  reduceOnly?: boolean
  timeInForce?: 'GTC' | 'IOC' | 'FOK'
}

export async function placeLiveOrder(
  req: LiveOrderRequest
): Promise<{ ok: true; orderId: string; raw: unknown } | { ok: false; error: string }> {
  const creds = getSessionCredentials(req.venue)
  if (!creds) {
    return { ok: false, error: 'Unlock vault and arm live first' }
  }

  const base = req.venue === 'binance_futures' ? FAPI : SPOT
  const path =
    req.venue === 'binance_futures' ? '/fapi/v1/order' : '/api/v3/order'

  const params = new URLSearchParams()
  params.set('symbol', req.symbol.toUpperCase())
  params.set('side', req.side)
  params.set('type', req.type)
  params.set('quantity', String(req.quantity))
  if (req.type === 'LIMIT') {
    if (req.price == null || !(req.price > 0)) {
      return { ok: false, error: 'Limit price required' }
    }
    params.set('price', String(req.price))
    params.set('timeInForce', req.timeInForce ?? 'GTC')
  }
  if (req.venue === 'binance_futures' && req.reduceOnly) {
    params.set('reduceOnly', 'true')
  }
  params.set('timestamp', String(Date.now()))
  params.set('recvWindow', '5000')

  const qs = params.toString()
  const signature = await hmacSha256(creds.apiSecret, qs)
  const url = `${base}${path}?${qs}&signature=${signature}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': creds.apiKey },
    })
    const body = await res.json()
    if (!res.ok) {
      const err = body?.msg || `HTTP ${res.status}`
      auditAppend({
        mode: 'live',
        action: 'error',
        symbol: req.symbol,
        detail: `place failed: ${err}`,
        ok: false,
      })
      return { ok: false, error: err }
    }
    const orderId = String(body.orderId ?? body.clientOrderId ?? '')
    auditAppend({
      mode: 'live',
      action: 'place',
      symbol: req.symbol,
      detail: `${req.side} ${req.type} qty=${req.quantity} id=${orderId}`,
      ok: true,
    })
    return { ok: true, orderId, raw: body }
  } catch (e: any) {
    auditAppend({
      mode: 'live',
      action: 'error',
      symbol: req.symbol,
      detail: e?.message || 'Network error',
      ok: false,
    })
    return { ok: false, error: e?.message || 'Network error' }
  }
}

export async function cancelAllLiveOrders(
  venue: LiveVenue,
  symbol: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const creds = getSessionCredentials(venue)
  if (!creds) return { ok: false, error: 'Not unlocked' }

  const base = venue === 'binance_futures' ? FAPI : SPOT
  const path =
    venue === 'binance_futures' ? '/fapi/v1/allOpenOrders' : '/api/v3/openOrders'
  const params = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    timestamp: String(Date.now()),
    recvWindow: '5000',
  })
  const qs = params.toString()
  const signature = await hmacSha256(creds.apiSecret, qs)
  try {
    const res = await fetch(`${base}${path}?${qs}&signature=${signature}`, {
      method: 'DELETE',
      headers: { 'X-MBX-APIKEY': creds.apiKey },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: body?.msg || `HTTP ${res.status}` }
    }
    auditAppend({
      mode: 'live',
      action: 'cancel_all',
      symbol,
      detail: 'cancel all open orders',
      ok: true,
    })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' }
  }
}

export const LIVE_NOTES = [
  'Keys encrypted in localStorage (AES-GCM); unlock only in memory for the session.',
  'Never paste keys into chat or commit them. Prefer withdraw-disabled API keys.',
  'Browser CORS: Binance REST from localhost may require a local proxy for some setups.',
  'Paper and live ledgers are strictly separate.',
] as const
