/**
 * Multi-monitor: open chart in a new window.
 * Config is stored in sessionStorage; URL only carries an opaque key (no symbol in query).
 */

import type { ExchangeId, Interval } from '@/types'

const SS_PREFIX = 'tt-detach:'

export interface DetachConfig {
  symbol: string
  interval: Interval
  exchange: ExchangeId
}

function randomKey(): string {
  const b = new Uint8Array(12)
  crypto.getRandomValues(b)
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export function detachChartPanel(opts: DetachConfig): Window | null {
  const key = randomKey()
  try {
    sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(opts))
  } catch {
    /* fallback */
  }
  const q = new URLSearchParams({ detach: '1', k: key })
  const url = `${window.location.origin}${window.location.pathname}?${q.toString()}`
  return window.open(url, `tt-detach-${key}`, 'popup=yes,width=960,height=640')
}

export function readDetachConfig(): DetachConfig | null {
  const q = new URLSearchParams(window.location.search)
  if (q.get('detach') !== '1') return null
  const key = q.get('k')
  if (key) {
    try {
      const raw = sessionStorage.getItem(SS_PREFIX + key)
      if (raw) {
        const cfg = JSON.parse(raw) as DetachConfig
        if (cfg?.symbol && cfg?.interval && cfg?.exchange) return cfg
      }
    } catch {
      /* */
    }
  }
  // Legacy fallback (old shared links)
  const symbol = (q.get('symbol') || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!symbol) return null
  return {
    symbol,
    interval: (q.get('interval') || '1m') as Interval,
    exchange: (q.get('exchange') || 'binance') as ExchangeId,
  }
}
