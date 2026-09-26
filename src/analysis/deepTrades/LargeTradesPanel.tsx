/**
 * Large trades list – time, px, size, side, effective/trapped.
 * Click row → chartFocusStore centers chart on that print.
 */

import { useEffect, useState, useCallback } from 'react'
import type { Candle, ExchangeId, Interval } from '@/types'
import { retainTradeBuffer, queryTradesInRange } from '@/analysis/deepPrint/tradeBuffer'
import { intervalToSeconds } from '@/analysis/deepPrint/interval'
import { filterDeepTrades } from './filter'
import { classifyBubbles } from './classify'
import type { DeepTradesConfig, DeepTradeBubble } from './types'
import { DEFAULT_DEEP_TRADES_CONFIG } from './types'
import { useChartFocusStore } from '@/stores/chartFocusStore'

interface LargeTradesPanelProps {
  exchange: ExchangeId
  symbol: string
  interval: Interval
  candles: Candle[]
  config?: DeepTradesConfig
  maxRows?: number
}

function fmtQty(n: number): string {
  if (n >= 1000) return n.toFixed(2)
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}

export function LargeTradesPanel({
  exchange,
  symbol,
  interval,
  candles,
  config = DEFAULT_DEEP_TRADES_CONFIG,
  maxRows = 40,
}: LargeTradesPanelProps) {
  const [rows, setRows] = useState<DeepTradeBubble[]>([])
  const requestFocus = useChartFocusStore((s) => s.requestFocus)

  const rebuild = useCallback(() => {
    const now = Math.floor(Date.now() / 1000)
    const trades = queryTradesInRange(exchange, symbol, now - 172800, now + 60)
    const { bubbles } = filterDeepTrades(trades, config)
    const sec = intervalToSeconds(interval)
    let classified = classifyBubbles(bubbles, candles, sec)
    classified = [...classified].sort((a, b) => b.timeSec - a.timeSec).slice(0, maxRows)
    setRows(classified)
  }, [exchange, symbol, interval, candles, config, maxRows])

  useEffect(() => {
    const release = retainTradeBuffer(exchange, symbol)
    rebuild()
    const id = window.setInterval(rebuild, 1200)
    return () => {
      release()
      window.clearInterval(id)
    }
  }, [exchange, symbol, rebuild])

  const onRowClick = (b: DeepTradeBubble) => {
    const pad = intervalToSeconds(interval) * 20
    requestFocus(b.timeSec, { price: b.price, padSec: pad })
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xxs font-mono-nums">
        <thead className="sticky top-0 bg-terminal-panel text-terminal-muted">
          <tr>
            <th className="text-left px-2 py-1">Time</th>
            <th className="text-right px-2 py-1">Px</th>
            <th className="text-right px-2 py-1">Size</th>
            <th className="text-right px-2 py-1">Side</th>
            <th className="text-right px-2 py-1">Out</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const buy = b.aggressor === 'buy'
            const out =
              b.outcome === 'effective'
                ? 'EFF'
                : b.outcome === 'trapped'
                  ? 'TRP'
                  : '…'
            return (
              <tr
                key={b.id}
                className="border-t border-terminal-border/50 cursor-pointer hover:bg-[#1e2329]"
                onClick={() => onRowClick(b)}
                title="Click to center chart"
              >
                <td className="px-2 py-0.5">
                  {new Date(b.timeSec * 1000).toLocaleTimeString()}
                </td>
                <td
                  className={
                    'text-right px-2 py-0.5 ' +
                    (buy ? 'text-terminal-green' : 'text-terminal-red')
                  }
                >
                  {b.price.toFixed(2)}
                </td>
                <td className="text-right px-2 py-0.5">{fmtQty(b.qty)}</td>
                <td
                  className={
                    'text-right px-2 py-0.5 ' +
                    (buy ? 'text-terminal-green' : 'text-terminal-red')
                  }
                >
                  {buy ? 'BUY' : 'SELL'}
                </td>
                <td
                  className={
                    'text-right px-2 py-0.5 ' +
                    (b.outcome === 'effective'
                      ? 'text-[#0ecb81]'
                      : b.outcome === 'trapped'
                        ? 'text-[#848e9c]'
                        : 'text-[#5e6673]')
                  }
                >
                  {out}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="p-4 text-terminal-muted text-sm">
          No large trades in buffer yet. Enable Deep Trades or wait for ticks.
        </div>
      )}
    </div>
  )
}
