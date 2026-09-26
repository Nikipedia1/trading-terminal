/**
 * Deep Trades – large prints as bubbles on canvas.
 *
 * LWC series markers cannot scale radius by volume, so we use a custom
 * canvas overlay with the same anti-pellicola pattern as Volume Profile:
 * store logical (time, price), map via timeToCoordinate / priceToCoordinate
 * on every visible-range-change / resize / new trade.
 */

import { useEffect, useRef, useCallback } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { ExchangeId } from '@/types'
import { retainTradeBuffer, queryTradesInRange } from '@/analysis/deepPrint/tradeBuffer'
import { filterDeepTrades } from './filter'
import type { DeepTradesConfig, DeepTradeBubble } from './types'
import { feedKey } from '@/data/shared'

// Access full buffer length via range query over a wide window
function queryAllBuffered(
  exchange: ExchangeId,
  symbol: string
): import('@/data/shared').AggressorTrade[] {
  // Wide window: last ~48h of buffer (ring already capped)
  const now = Math.floor(Date.now() / 1000)
  return queryTradesInRange(exchange, symbol, now - 172800, now + 60)
}

interface DeepTradesOverlayProps {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  exchange: ExchangeId
  symbol: string
  config: DeepTradesConfig
}

const BUY_FILL = 'rgba(14, 203, 129, 0.45)'
const BUY_STROKE = 'rgba(14, 203, 129, 0.95)'
const SELL_FILL = 'rgba(168, 85, 247, 0.45)' // violet
const SELL_STROKE = 'rgba(168, 85, 247, 0.95)'

const R_MIN = 3
const R_MAX = 22

function radiusForQty(qty: number, maxQty: number): number {
  if (maxQty <= 0) return R_MIN
  const t = Math.sqrt(qty / maxQty) // dampen extremes
  return R_MIN + t * (R_MAX - R_MIN)
}

export function DeepTradesOverlay({
  enabled,
  bridge,
  containerRef,
  exchange,
  symbol,
  config,
}: DeepTradesOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bubblesRef = useRef<DeepTradeBubble[]>([])
  const thresholdRef = useRef(0)
  const maxQtyRef = useRef(1)

  useEffect(() => {
    if (!enabled) return
    return retainTradeBuffer(exchange, symbol)
  }, [enabled, exchange, symbol])

  const rebuild = useCallback(() => {
    if (!enabled) {
      bubblesRef.current = []
      return
    }
    const trades = queryAllBuffered(exchange, symbol)
    const { bubbles, threshold } = filterDeepTrades(trades, config)
    // Keep last N for draw performance
    const capped = bubbles.length > 400 ? bubbles.slice(-400) : bubbles
    bubblesRef.current = capped
    thresholdRef.current = threshold
    maxQtyRef.current = Math.max(...capped.map((b) => b.qty), 1)
  }, [enabled, exchange, symbol, config])

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

    const list = bubblesRef.current
    const maxQty = maxQtyRef.current

    for (const b of list) {
      const x = bridge.timeToCoordinate(b.timeSec as any)
      const y = bridge.priceToCoordinate(b.price)
      if (x === null || y === null) continue
      if (x < -30 || x > w + 30 || y < -30 || y > h + 30) continue

      const r = radiusForQty(b.qty, maxQty)
      const buy = b.aggressor === 'buy'

      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = buy ? BUY_FILL : SELL_FILL
      ctx.fill()
      ctx.lineWidth = 1.25
      ctx.strokeStyle = buy ? BUY_STROKE : SELL_STROKE
      ctx.stroke()
    }

    // Legend / threshold badge
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(132, 142, 156, 0.9)'
    const modeLabel =
      config.mode === 'fixed'
        ? `min ≥ ${thresholdRef.current}`
        : `p${config.percentile} ≥ ${thresholdRef.current.toPrecision(4)}`
    ctx.fillText(`Deep Trades · ${list.length} · ${modeLabel}`, 8, 16)
  }, [bridge, containerRef, enabled, config])

  useEffect(() => {
    if (!enabled) {
      bubblesRef.current = []
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    rebuild()
    paint()

    const unsub = bridge?.onVisibleRangeChange(() => paint())
    const parent = containerRef.current
    let ro: ResizeObserver | null = null
    if (parent) {
      ro = new ResizeObserver(() => paint())
      ro.observe(parent)
    }

    const id = window.setInterval(() => {
      rebuild()
      paint()
    }, 800)

    return () => {
      unsub?.()
      ro?.disconnect()
      window.clearInterval(id)
    }
  }, [enabled, bridge, exchange, symbol, config, rebuild, paint, containerRef])

  // silence unused import warning for feedKey in some bundlers
  void feedKey

  if (!enabled) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[4] pointer-events-none"
      aria-hidden
    />
  )
}
