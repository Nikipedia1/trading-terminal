/**
 * Position / balance reconciliation vs exchange (Binance signed REST).
 * Detects desync, writes audit trail. Paper uses local ledger only.
 */

import { getSessionCredentials, type LiveVenue } from '@/trading/credentials/vault'
import { auditAppend } from '@/trading/audit/auditLog'
import type { OmsBalanceSnapshot, OmsPositionSnapshot } from '@/trading/oms/types'

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

async function signedGet(
  venue: LiveVenue,
  path: string,
  extra: Record<string, string> = {}
): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
  const creds = getSessionCredentials(venue)
  if (!creds) return { ok: false, error: 'Unlock vault first' }

  const base = venue === 'binance_futures' ? FAPI : SPOT
  const params = new URLSearchParams({
    ...extra,
    timestamp: String(Date.now()),
    recvWindow: '5000',
  })
  const qs = params.toString()
  const signature = await hmacSha256(creds.apiSecret, qs)
  try {
    const res = await fetch(`${base}${path}?${qs}&signature=${signature}`, {
      headers: { 'X-MBX-APIKEY': creds.apiKey },
    })
    const body = await res.json()
    if (!res.ok) return { ok: false, error: body?.msg || `HTTP ${res.status}` }
    return { ok: true, body }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' }
  }
}

export interface ReconcileResult {
  ok: boolean
  venue: LiveVenue
  positions: OmsPositionSnapshot[]
  balances: OmsBalanceSnapshot[]
  desyncNotes: string[]
  error?: string
  at: number
}

export async function reconcileVenue(venue: LiveVenue): Promise<ReconcileResult> {
  const at = Date.now()
  const desyncNotes: string[] = []
  const positions: OmsPositionSnapshot[] = []
  const balances: OmsBalanceSnapshot[] = []

  if (venue === 'binance_futures') {
    const posRes = await signedGet(venue, '/fapi/v2/positionRisk')
    if (!posRes.ok) {
      auditAppend({
        mode: 'live',
        action: 'error',
        detail: `reconcile positions failed: ${posRes.error}`,
        ok: false,
      })
      return { ok: false, venue, positions, balances, desyncNotes, error: posRes.error, at }
    }
    const arr = Array.isArray(posRes.body) ? posRes.body : []
    for (const row of arr as any[]) {
      const qty = Math.abs(Number(row.positionAmt) || 0)
      if (qty < 1e-12) continue
      const amt = Number(row.positionAmt)
      positions.push({
        venue: 'binance_futures',
        symbol: String(row.symbol || ''),
        side: amt > 0 ? 'long' : 'short',
        qty,
        entryPrice: Number(row.entryPrice) || 0,
        unrealizedPnl: Number(row.unRealizedProfit) || 0,
        marginMode: String(row.marginType || '').toLowerCase() === 'isolated' ? 'isolated' : 'cross',
        leverage: Number(row.leverage) || undefined,
        updatedAt: at,
      })
    }

    const balRes = await signedGet(venue, '/fapi/v2/balance')
    if (balRes.ok && Array.isArray(balRes.body)) {
      for (const row of balRes.body as any[]) {
        const free = Number(row.availableBalance ?? row.balance) || 0
        const bal = Number(row.balance) || 0
        if (Math.abs(bal) < 1e-10 && Math.abs(free) < 1e-10) continue
        balances.push({
          venue: 'binance_futures',
          asset: String(row.asset || ''),
          free,
          locked: Math.max(0, bal - free),
          updatedAt: at,
        })
      }
    } else if (!balRes.ok) {
      desyncNotes.push(`balance: ${balRes.error}`)
    }
  } else {
    const acc = await signedGet(venue, '/api/v3/account')
    if (!acc.ok) {
      auditAppend({
        mode: 'live',
        action: 'error',
        detail: `reconcile account failed: ${acc.error}`,
        ok: false,
      })
      return { ok: false, venue, positions, balances, desyncNotes, error: acc.error, at }
    }
    const body = acc.body as any
    for (const b of body.balances || []) {
      const free = Number(b.free) || 0
      const locked = Number(b.locked) || 0
      if (free + locked < 1e-10) continue
      balances.push({
        venue: 'binance_spot',
        asset: String(b.asset),
        free,
        locked,
        updatedAt: at,
      })
    }
  }

  auditAppend({
    mode: 'live',
    action: 'place',
    detail: `reconcile ${venue}: ${positions.length} pos, ${balances.length} bal${desyncNotes.length ? ` notes=${desyncNotes.join(';')}` : ''}`,
    ok: true,
  })

  return { ok: true, venue, positions, balances, desyncNotes, at }
}

/** Compare local OMS open orders vs exchange open orders. */
export async function fetchOpenOrders(
  venue: LiveVenue,
  symbol?: string
): Promise<{ ok: true; orders: unknown[] } | { ok: false; error: string }> {
  const path = venue === 'binance_futures' ? '/fapi/v1/openOrders' : '/api/v3/openOrders'
  const extra = symbol ? { symbol: symbol.toUpperCase() } : {}
  const res = await signedGet(venue, path, extra)
  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, orders: Array.isArray(res.body) ? res.body : [] }
}
