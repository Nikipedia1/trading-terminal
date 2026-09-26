/**
 * Range vs Discovery label – annotation only.
 * Uses developing profile VA when available + last candle close + recent delta.
 */

import { useEffect, useState } from 'react'
import type { ExchangeId, Candle, Interval } from '@/types'
import { retainTradeBuffer, queryTradesInRange } from '@/analysis/deepPrint/tradeBuffer'
import { computeCandleDeltas } from '@/analysis/deepPrint/aggregate'
import { buildVolumeProfile, resolveWindowRange } from './compute'
import { classifyRangeDiscovery, type ModeResult } from './rangeDiscovery'
import type { ProfileWindow } from './types'

interface RangeDiscoveryBadgeProps {
  enabled: boolean
  exchange: ExchangeId
  symbol: string
  interval: Interval
  candles: Candle[]
  profileWindow?: ProfileWindow
}

export function RangeDiscoveryBadge({
  enabled,
  exchange,
  symbol,
  interval,
  candles,
  profileWindow = 'session',
}: RangeDiscoveryBadgeProps) {
  const [result, setResult] = useState<ModeResult | null>(null)

  useEffect(() => {
    if (!enabled) return
    return retainTradeBuffer(exchange, symbol)
  }, [enabled, exchange, symbol])

  useEffect(() => {
    if (!enabled || candles.length === 0) {
      setResult(null)
      return
    }

    const tick = () => {
      const last = candles[candles.length - 1]
      if (!last) return

      const range = resolveWindowRange(profileWindow, null, null)
      const trades = queryTradesInRange(exchange, symbol, range.fromSec, range.toSec)
      const model = buildVolumeProfile(
        trades,
        profileWindow,
        range.fromSec,
        range.toSec,
        0.7
      )

      if (model.tradeCount === 0 || model.val <= 0) {
        setResult({
          mode: 'unknown',
          label: '—',
          detail: 'Waiting for profile trades…',
        })
        return
      }

      // Recent closed candle delta
      let recentDelta: number | null = null
      if (candles.length >= 2) {
        const closed = candles[candles.length - 2]
        const bars = computeCandleDeltas(exchange, symbol, [closed.time], interval)
        if (bars[0]) recentDelta = bars[0].delta
      }

      setResult(
        classifyRangeDiscovery(last.close, model.val, model.vah, recentDelta)
      )
    }

    tick()
    const id = window.setInterval(tick, 2000)
    return () => window.clearInterval(id)
  }, [enabled, exchange, symbol, interval, candles, profileWindow])

  if (!enabled || !result) return null

  const colors: Record<string, string> = {
    range: 'bg-[#1e2329] text-[#848e9c] border-[#2b3139]',
    discovery_up: 'bg-[#0ecb81]/15 text-[#0ecb81] border-[#0ecb81]/40',
    discovery_down: 'bg-[#f6465d]/15 text-[#f6465d] border-[#f6465d]/40',
    unknown: 'bg-[#1e2329] text-[#5e6673] border-[#2b3139]',
  }

  return (
    <div
      className={`absolute top-2 left-2 z-[9] pointer-events-none px-2 py-1 rounded border text-[10px] font-semibold tracking-wide ${colors[result.mode]}`}
      title={result.detail}
    >
      {result.label}
      <span className="font-normal opacity-70 ml-1.5 hidden sm:inline">{result.detail.slice(0, 48)}</span>
    </div>
  )
}
