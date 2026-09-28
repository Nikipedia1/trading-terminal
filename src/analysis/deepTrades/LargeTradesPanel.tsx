/**
 * Large trades tape – notional filter, time decay, sound, click-to-chart.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import type { Candle, ExchangeId, Interval } from '@/types'
import { SymbolBadge } from '@/ui/SymbolBadge'
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
  maxRows = 50,
}: LargeTradesPanelProps) {
  const [rows, setRows] = useState<DeepTradeBubble[]>([])
  const [minNotional, setMinNotional] = useState(0)
  const [sound, setSound] = useState(false)
  const seen = useRef<Set<string>>(new Set())
  const requestFocus = useChartFocusStore((s) => s.requestFocus)

  const beep = () => {
    try {
      const ctx = new AudioContext()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.value = 0.04
      o.start()
      o.stop(ctx.currentTime + 0.08)
    } catch {
      /* autoplay */
    }
  }

  const rebuild = useCallback(() => {
    const now = Math.floor(Date.now() / 1000)
    const trades = queryTradesInRange(exchange, symbol, now - 172800, now + 60)
    const { bubbles } = filterDeepTrades(trades, config)
    const sec = intervalToSeconds(interval)
    let classified = classifyBubbles(bubbles, candles, sec)
    if (minNotional > 0) {
      classified = classified.filter((b) => b.price * b.baseQty >= minNotional)
    }
    classified = [...classified].sort((a, b) => b.timeSec - a.timeSec).slice(0, maxRows)

    if (sound) {
      for (const b of classified.slice(0, 5)) {
        if (!seen.current.has(b.id)) {
          seen.current.add(b.id)
          beep()
          break
        }
      }
    }
    setRows(classified)
  }, [exchange, symbol, interval, candles, config, maxRows, minNotional, sound])

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

  const nowSec = Date.now() / 1000

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 px-2 py-1 flex flex-wrap gap-2 items-center border-b border-terminal-border text-[10px] text-[#848e9c]">
        <SymbolBadge symbol={symbol} size="sm" showName={false} />
        <label className="flex items-center gap-1">
          min $
          <input
            type="number"
            min={0}
            className="w-16 bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px] text-[#eaecef]"
            value={minNotional}
            onChange={(e) => setMinNotional(Number(e.target.value) || 0)}
            title="Filter by price × base qty (USDT approx)"
          />
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            className="accent-[#f0b90b]"
            checked={sound}
            onChange={(e) => setSound(e.target.checked)}
          />
          sound
        </label>
        <span className="text-[#5e6673]">click → chart · EFF/TRP</span>
      </div>
      <div className="overflow-auto flex-1 min-h-0">
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
              const age = nowSec - b.timeSec
              const opacity = Math.max(0.35, 1 - age / 3600)
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
                  style={{ opacity }}
                  onClick={() => onRowClick(b)}
                  title={`Notional≈${(b.price * b.baseQty).toFixed(0)} · click to center`}
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
            No large trades in buffer. Lower threshold or wait for ticks.
          </div>
        )}
      </div>
    </div>
  )
}
