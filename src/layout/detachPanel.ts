/**
 * Multi-monitor: open a lightweight chart view in a new browser window.
 * Shares nothing via memory – URL params only (symbol/interval/exchange).
 */

import type { ExchangeId, Interval } from '@/types'

export function detachChartPanel(opts: {
  symbol: string
  interval: Interval
  exchange: ExchangeId
}): Window | null {
  const q = new URLSearchParams({
    symbol: opts.symbol,
    interval: opts.interval,
    exchange: opts.exchange,
    detach: '1',
  })
  const url = `${window.location.origin}${window.location.pathname}?${q.toString()}`
  const w = window.open(
    url,
    `tt-${opts.symbol}-${opts.interval}`,
    'popup=yes,width=960,height=640'
  )
  return w
}
