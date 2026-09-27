/**
 * Footprint overlay – cells + bar delta/POC/unfinished auction.
 * Real aggressor trades only. See FORMULAS.md.
 */

import { useEffect, useRef, useCallback } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { Candle, ExchangeId, Interval } from '@/types'
import { retainTradeBuffer, queryTradesInRange } from '@/analysis/deepPrint/tradeBuffer'
import { intervalToSeconds } from '@/analysis/deepPrint/interval'
import { buildFootprintCells, buildFootprintBars } from './compute'
import type { FootprintConfig } from './types'
import { DEFAULT_FOOTPRINT_CONFIG, FOOTPRINT_NOTE } from './types'

interface FootprintOverlayProps {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  exchange: ExchangeId
  symbol: string
  interval: Interval
  candles: Candle[]
  config?: FootprintConfig
}

export function FootprintOverlay({
  enabled,
  bridge,
  containerRef,
  exchange,
  symbol,
  interval,
  candles,
  config = DEFAULT_FOOTPRINT_CONFIG,
}: FootprintOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!enabled) return
    return retainTradeBuffer(exchange, symbol)
  }, [enabled, exchange, symbol])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const parent = containerRef.current
    if (!canvas || !parent || !bridge || !enabled) return

    const w = parent.clientWidth
    const h = parent.clientHeight
    if (w <= 0 || h <= 0) return

    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const slice = candles.slice(-config.maxCandles)
    if (slice.length === 0) return

    const sec = intervalToSeconds(interval)
    const fromSec = slice[0].time
    const toSec = slice[slice.length - 1].time + sec
    const trades = queryTradesInRange(exchange, symbol, fromSec, toSec)
    const times = slice.map((c) => c.time)
    const cells = buildFootprintCells(trades, times, interval)
    const bars = buildFootprintBars(cells)

    if (cells.length === 0) {
      ctx.font = '10px sans-serif'
      ctx.fillStyle = 'rgba(132, 142, 156, 0.85)'
      ctx.fillText('Footprint: no ticks — ' + FOOTPRINT_NOTE.slice(0, 50), 8, h - 12)
      return
    }

    const maxCell = Math.max(...cells.map((c) => c.buyQty + c.sellQty), 0.0001)
    const minQty = maxCell * (config.minCellPct / 100)

    for (const cell of cells) {
      const tot = cell.buyQty + cell.sellQty
      if (tot < minQty) continue

      const x0 = bridge.timeToCoordinate(cell.timeSec as any)
      const x1 = bridge.timeToCoordinate((cell.timeSec + sec) as any)
      if (x0 == null) continue
      const colW = x1 != null ? Math.max(4, Math.abs(x1 - x0) * 0.85) : 8
      const y = bridge.priceToCoordinate(cell.price)
      if (y == null || y < -4 || y > h + 4) continue
      const y2 = bridge.priceToCoordinate(cell.price * 1.00008)
      const rowH = y2 != null ? Math.max(2, Math.abs(y2 - y)) : 3
      const half = colW / 2
      const buyW = (cell.buyQty / maxCell) * half
      const sellW = (cell.sellQty / maxCell) * half

      if (cell.sellQty > 0) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.5)'
        ctx.fillRect(x0 + half - sellW, y - rowH / 2, sellW, rowH)
      }
      if (cell.buyQty > 0) {
        ctx.fillStyle = 'rgba(14, 203, 129, 0.5)'
        ctx.fillRect(x0 + half, y - rowH / 2, buyW, rowH)
      }
    }

    // Bar metrics: POC mark + unfinished auction flags + delta sign
    if (config.showBarMetrics) {
      for (const bar of bars) {
        const x0 = bridge.timeToCoordinate(bar.timeSec as any)
        if (x0 == null) continue
        const yp = bridge.priceToCoordinate(bar.poc)
        if (yp != null) {
          ctx.fillStyle = 'rgba(240, 185, 11, 0.9)'
          ctx.fillRect(x0 - 2, yp - 2, 4, 4)
        }
        if (bar.unfinishedHigh) {
          const y = bridge.priceToCoordinate(
            Math.max(...cells.filter((c) => c.timeSec === bar.timeSec).map((c) => c.price))
          )
          if (y != null) {
            ctx.strokeStyle = 'rgba(14, 203, 129, 0.9)'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.moveTo(x0 - 4, y)
            ctx.lineTo(x0 + 8, y)
            ctx.stroke()
            ctx.font = '8px monospace'
            ctx.fillStyle = 'rgba(14, 203, 129, 0.95)'
            ctx.fillText('UA↑', x0 + 10, y + 3)
          }
        }
        if (bar.unfinishedLow) {
          const y = bridge.priceToCoordinate(
            Math.min(...cells.filter((c) => c.timeSec === bar.timeSec).map((c) => c.price))
          )
          if (y != null) {
            ctx.strokeStyle = 'rgba(246, 70, 93, 0.9)'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.moveTo(x0 - 4, y)
            ctx.lineTo(x0 + 8, y)
            ctx.stroke()
            ctx.font = '8px monospace'
            ctx.fillStyle = 'rgba(246, 70, 93, 0.95)'
            ctx.fillText('UA↓', x0 + 10, y + 3)
          }
        }
      }
    }

    ctx.font = '9px sans-serif'
    ctx.fillStyle = 'rgba(132, 142, 156, 0.9)'
    ctx.fillText(
      `Footprint · ${cells.length} cells · ${bars.length} bars · ${trades.length} ticks`,
      8,
      h - 12
    )
  }, [bridge, containerRef, enabled, exchange, symbol, interval, candles, config])

  useEffect(() => {
    if (!enabled) {
      const canvas = canvasRef.current
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    paint()
    const unsub = bridge?.onVisibleRangeChange(() => paint())
    const parent = containerRef.current
    let ro: ResizeObserver | null = null
    if (parent) {
      ro = new ResizeObserver(() => paint())
      ro.observe(parent)
    }
    const id = window.setInterval(paint, 1000)
    return () => {
      unsub?.()
      ro?.disconnect()
      window.clearInterval(id)
    }
  }, [enabled, bridge, paint, containerRef])

  if (!enabled) return null
  return (
    <canvas ref={canvasRef} className="absolute inset-0 z-[5] pointer-events-none" aria-hidden />
  )
}
