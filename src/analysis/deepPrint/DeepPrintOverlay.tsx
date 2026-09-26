/**
 * Deep Print overlay – Bid/Ask volume by price for one candle.
 *
 * Anti-pellicola:
 * - Stores candleTime + anchorPrice (logical only)
 * - Pixel position from CoordinateBridge on every pan/zoom/resize
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
  if (q >= 1000) return q.toFixed(1)
  if (q >= 1) return q.toFixed(3)
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
  const [pinned, setPinned] = useState(false) // click = pin, hover = temporary
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const modelRef = useRef<DeepPrintModel | null>(null)
  modelRef.current = model

  // Retain shared trade buffer while enabled
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
      const m = aggregatePrint(trades, candleTime, end, anchor)
      setModel(m)
    },
    [candles, exchange, symbol, interval]
  )

  // Recompute pixel position from logical coords (anti-pellicola)
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
    const chart = bridge.getChart()
    // Also subscribe crosshair / logical range if available via timeScale
    return () => {
      unsub()
      ro?.disconnect()
      void chart
    }
  }, [bridge, enabled, updatePosition, containerRef])

  // Live trades while print open → refresh aggregation for same candle
  useEffect(() => {
    if (!enabled || !model) return
    const id = window.setInterval(() => {
      if (modelRef.current) rebuildModel(modelRef.current.candleTime)
    }, 1000)
    return () => window.clearInterval(id)
  }, [enabled, model?.candleTime, rebuildModel])

  // Click / crosshair on chart
  useEffect(() => {
    if (!enabled || !bridge) return
    const chart = bridge.getChart()
    if (!chart) return

    const onClick = (param: any) => {
      if (!param?.time) return
      const t = typeof param.time === 'number' ? param.time : null
      if (t === null) return
      // Snap to candle open if we have data
      const candle = candles.find((c) => c.time === t) || findCandleCovering(candles, t, interval)
      if (!candle) return
      setPinned(true)
      rebuildModel(candle.time)
    }

    const onMove = (param: any) => {
      if (pinned) return // don't fight pinned selection
      if (!param?.time) {
        if (!pinned) setModel(null)
        return
      }
      const t = typeof param.time === 'number' ? param.time : null
      if (t === null) return
      const candle = candles.find((c) => c.time === t) || findCandleCovering(candles, t, interval)
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

  // Reset when disabled / symbol change
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
  const panelW = 160
  const panelH = Math.min(280, 40 + model.levels.length * 16)

  // Prefer right of candle; flip if near edge
  let left = pos.x + 12
  let top = pos.y - panelH / 2
  if (left + panelW > cw - 4) left = pos.x - panelW - 12
  if (left < 4) left = 4
  if (top < 4) top = 4
  if (top + panelH > ch - 4) top = Math.max(4, ch - panelH - 4)

  const maxSide = Math.max(
    ...model.levels.map((l) => Math.max(l.buyQty, l.sellQty)),
    0.0001
  )

  return (
    <div
      className="absolute z-20 pointer-events-auto select-none"
      style={{ left, top, width: panelW }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="bg-terminal-panel/95 border border-terminal-border rounded shadow-lg text-xxs font-mono-nums overflow-hidden">
        <div className="flex items-center justify-between px-1.5 py-1 border-b border-terminal-border bg-terminal-bg">
          <span className="text-terminal-muted">Deep Print</span>
          <span className="text-terminal-muted">
            {pinned ? 'pinned' : 'hover'} · {model.tradeCount} ticks
          </span>
          <button
            type="button"
            className="text-terminal-muted hover:text-terminal-text px-1"
            title="Close"
            onClick={() => {
              setModel(null)
              setPinned(false)
            }}
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-3 gap-0 px-1 py-0.5 text-terminal-muted border-b border-terminal-border/50">
          <span className="text-left text-terminal-red">SELL</span>
          <span className="text-center">PX</span>
          <span className="text-right text-terminal-green">BUY</span>
        </div>

        <div className="max-h-52 overflow-y-auto">
          {model.levels.length === 0 ? (
            <div className="px-2 py-3 text-terminal-muted text-center">
              No trades in buffer for this candle.
              <div className="mt-1 opacity-70">Wait for live ticks or select a recent bar.</div>
            </div>
          ) : (
            model.levels.map((l) => (
              <div
                key={l.price}
                className="grid grid-cols-3 gap-0 px-1 py-0.5 items-center relative"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-terminal-red/15"
                  style={{ width: (l.sellQty / maxSide) * 50 + '%' }}
                />
                <div
                  className="absolute inset-y-0 right-0 bg-terminal-green/15"
                  style={{ width: (l.buyQty / maxSide) * 50 + '%' }}
                />
                <span className="relative text-left text-terminal-red">
                  {l.sellQty > 0 ? formatQty(l.sellQty) : ''}
                </span>
                <span className="relative text-center text-terminal-text">{l.price}</span>
                <span className="relative text-right text-terminal-green">
                  {l.buyQty > 0 ? formatQty(l.buyQty) : ''}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-between px-1.5 py-1 border-t border-terminal-border text-terminal-muted">
          <span className="text-terminal-red">Σ {formatQty(model.totalSell)}</span>
          <span>tick {model.tickSize}</span>
          <span className="text-terminal-green">Σ {formatQty(model.totalBuy)}</span>
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
