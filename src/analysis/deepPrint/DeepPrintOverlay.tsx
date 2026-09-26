/**
 * Deep Print – Bid/Ask footprint beside the candle (guide-style).
 * SELL | PX | BUY with thick bars + Delta as horizontal bars.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { Candle, ExchangeId, Interval } from '@/types'
import { retainTradeBuffer, queryTradesInRange } from './tradeBuffer'
import { aggregatePrint } from './aggregate'
import { intervalToSeconds } from './interval'
import type { DeepPrintModel } from './types'

interface DeepPrintOverlayProps {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  exchange: ExchangeId
  symbol: string
  interval: Interval
  candles: Candle[]
}

function formatQty(q: number): string {
  if (Math.abs(q) >= 1000) return q.toFixed(2)
  if (Math.abs(q) >= 1) return q.toFixed(3)
  if (Math.abs(q) >= 0.01) return q.toFixed(4)
  return q.toFixed(5)
}

export function DeepPrintOverlay({
  enabled,
  bridge,
  containerRef,
  exchange,
  symbol,
  interval,
  candles,
}: DeepPrintOverlayProps) {
  const [model, setModel] = useState<DeepPrintModel | null>(null)
  const [pinned, setPinned] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const modelRef = useRef<DeepPrintModel | null>(null)
  modelRef.current = model

  useEffect(() => {
    if (!enabled) return
    return retainTradeBuffer(exchange, symbol)
  }, [enabled, exchange, symbol])

  const rebuildModel = useCallback(
    (candleTime: number) => {
      const candle = candles.find((c) => c.time === candleTime)
      if (!candle) {
        setModel(null)
        return
      }
      const sec = intervalToSeconds(interval)
      const end = candleTime + sec
      const trades = queryTradesInRange(exchange, symbol, candleTime, end)
      const anchor = (candle.high + candle.low) / 2
      setModel(aggregatePrint(trades, candleTime, end, anchor))
    },
    [candles, exchange, symbol, interval]
  )

  const updatePosition = useCallback(() => {
    const m = modelRef.current
    if (!m || !bridge) {
      setPos(null)
      return
    }
    const x = bridge.timeToCoordinate(m.candleTime as any)
    const y = bridge.priceToCoordinate(m.anchorPrice)
    if (x === null || y === null) {
      setPos(null)
      return
    }
    setPos({ x, y })
  }, [bridge])

  useEffect(() => {
    updatePosition()
  }, [model, updatePosition])

  useEffect(() => {
    if (!bridge || !enabled) return
    const unsub = bridge.onVisibleRangeChange(() => updatePosition())
    const parent = containerRef.current
    let ro: ResizeObserver | null = null
    if (parent) {
      ro = new ResizeObserver(() => updatePosition())
      ro.observe(parent)
    }
    return () => {
      unsub()
      ro?.disconnect()
    }
  }, [bridge, enabled, updatePosition, containerRef])

  useEffect(() => {
    if (!enabled || !model) return
    const id = window.setInterval(() => {
      if (modelRef.current) rebuildModel(modelRef.current.candleTime)
    }, 1000)
    return () => window.clearInterval(id)
  }, [enabled, model?.candleTime, rebuildModel])

  useEffect(() => {
    if (!enabled || !bridge) return
    const chart = bridge.getChart()
    if (!chart) return

    const onClick = (param: any) => {
      if (!param?.time) return
      const t = typeof param.time === 'number' ? param.time : null
      if (t === null) return
      const candle =
        candles.find((c) => c.time === t) || findCandleCovering(candles, t, interval)
      if (!candle) return
      setPinned(true)
      rebuildModel(candle.time)
    }

    const onMove = (param: any) => {
      if (pinned) return
      if (!param?.time) {
        setModel(null)
        return
      }
      const t = typeof param.time === 'number' ? param.time : null
      if (t === null) return
      const candle =
        candles.find((c) => c.time === t) || findCandleCovering(candles, t, interval)
      if (!candle) return
      rebuildModel(candle.time)
    }

    chart.subscribeClick(onClick)
    chart.subscribeCrosshairMove(onMove)
    return () => {
      chart.unsubscribeClick(onClick)
      chart.unsubscribeCrosshairMove(onMove)
    }
  }, [enabled, bridge, candles, interval, pinned, rebuildModel])

  useEffect(() => {
    if (!enabled) {
      setModel(null)
      setPinned(false)
      setPos(null)
    }
  }, [enabled, symbol, exchange, interval])

  if (!enabled || !model || !pos) return null

  const parent = containerRef.current
  const cw = parent?.clientWidth ?? 0
  const ch = parent?.clientHeight ?? 0
  const panelW = 248
  const rowH = 20
  const panelH = Math.min(340, 56 + Math.max(1, model.levels.length) * rowH)

  let left = pos.x + 14
  let top = pos.y - panelH / 2
  if (left + panelW > cw - 8) left = pos.x - panelW - 14
  if (left < 4) left = 4
  if (top < 4) top = 4
  if (top + panelH > ch - 4) top = Math.max(4, ch - panelH - 4)

  const maxSide = Math.max(
    ...model.levels.map((l) => Math.max(l.buyQty, l.sellQty)),
    0.0001
  )
  const maxAbsDelta = Math.max(...model.levels.map((l) => Math.abs(l.delta)), 0.0001)

  return (
    <div
      className="absolute z-20 pointer-events-auto select-none"
      style={{ left, top, width: panelW }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="bg-[#0b0e11]/96 border border-[#2b3139] rounded-md shadow-xl overflow-hidden font-mono">
        {/* Header */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#2b3139] bg-[#12161c]">
          <span className="text-[11px] font-semibold text-[#eaecef]">Deep Print</span>
          <span
            className={`text-[11px] font-bold ${
              model.totalDelta >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
            }`}
          >
            Δ {formatQty(model.totalDelta)}
          </span>
          <span className="text-[10px] text-[#848e9c]">
            {pinned ? 'pinned' : 'hover'} · {model.tradeCount}
          </span>
          <button
            type="button"
            className="text-[#848e9c] hover:text-[#eaecef] text-xs px-1"
            onClick={() => {
              setModel(null)
              setPinned(false)
            }}
          >
            ✕
          </button>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_56px_1fr_52px] gap-0 px-1.5 py-1 text-[10px] font-semibold border-b border-[#2b3139]/80">
          <span className="text-left text-[#f6465d]">SELL</span>
          <span className="text-center text-[#848e9c]">PRICE</span>
          <span className="text-right text-[#0ecb81]">BUY</span>
          <span className="text-right text-[#848e9c]">Δ</span>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {model.levels.length === 0 ? (
            <div className="px-3 py-4 text-[11px] text-[#848e9c] text-center leading-relaxed">
              No trades in buffer for this candle.
              <div className="mt-1 opacity-70">Wait for live ticks or select a recent bar.</div>
            </div>
          ) : (
            model.levels.map((l) => {
              const sellPct = (l.sellQty / maxSide) * 100
              const buyPct = (l.buyQty / maxSide) * 100
              const dPct = (Math.abs(l.delta) / maxAbsDelta) * 100
              const dPos = l.delta >= 0
              return (
                <div
                  key={l.price}
                  className="grid grid-cols-[1fr_56px_1fr_52px] gap-0 px-1.5 items-stretch border-b border-[#1e2329]/60"
                  style={{ minHeight: rowH }}
                >
                  {/* SELL bar + qty */}
                  <div className="relative flex items-center justify-end pr-1">
                    <div
                      className="absolute inset-y-0.5 right-0 rounded-sm bg-[#f6465d]/35"
                      style={{ width: `${Math.max(l.sellQty > 0 ? 8 : 0, sellPct)}%` }}
                    />
                    <span className="relative text-[11px] font-medium text-[#f6465d] tabular-nums">
                      {l.sellQty > 0 ? formatQty(l.sellQty) : ''}
                    </span>
                  </div>

                  {/* PRICE */}
                  <div className="flex items-center justify-center text-[11px] font-semibold text-[#eaecef] tabular-nums">
                    {l.price}
                  </div>

                  {/* BUY bar + qty */}
                  <div className="relative flex items-center justify-start pl-1">
                    <div
                      className="absolute inset-y-0.5 left-0 rounded-sm bg-[#0ecb81]/35"
                      style={{ width: `${Math.max(l.buyQty > 0 ? 8 : 0, buyPct)}%` }}
                    />
                    <span className="relative text-[11px] font-medium text-[#0ecb81] tabular-nums">
                      {l.buyQty > 0 ? formatQty(l.buyQty) : ''}
                    </span>
                  </div>

                  {/* DELTA horizontal bar */}
                  <div className="relative flex items-center justify-end gap-0.5 pl-0.5">
                    <div className="relative flex-1 h-3 flex items-center justify-end">
                      <div
                        className="h-2.5 rounded-sm"
                        style={{
                          width: `${Math.max(l.delta !== 0 ? 12 : 0, dPct)}%`,
                          backgroundColor: dPos ? '#0ecb81' : '#a855f7',
                          opacity: 0.85,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="flex justify-between px-2 py-1.5 border-t border-[#2b3139] text-[10px] text-[#848e9c]">
          <span className="text-[#f6465d] font-medium">Σ {formatQty(model.totalSell)}</span>
          <span>tick {model.tickSize}</span>
          <span className="text-[#0ecb81] font-medium">Σ {formatQty(model.totalBuy)}</span>
        </div>
      </div>
    </div>
  )
}

function findCandleCovering(
  candles: Candle[],
  timeSec: number,
  interval: Interval
): Candle | undefined {
  const sec = intervalToSeconds(interval)
  return candles.find((c) => timeSec >= c.time && timeSec < c.time + sec)
}
