/**
 * Deep Trades – large prints as bubbles on canvas.
 * Anti-pellicola: logical (time, price) → timeToCoordinate / priceToCoordinate.
 */

import { useEffect, useRef, useCallback } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { ExchangeId } from '@/types'
import { retainTradeBuffer, queryTradesInRange } from '@/analysis/deepPrint/tradeBuffer'
import { filterDeepTrades } from './filter'
import type { DeepTradesConfig, DeepTradeBubble } from './types'

function queryAllBuffered(
  exchange: ExchangeId,
  symbol: string
): import('@/data/shared').AggressorTrade[] {
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

// High-contrast KuCoin-like palette
const BUY_FILL = 'rgba(14, 203, 129, 0.72)'
const BUY_STROKE = '#0ecb81'
const SELL_FILL = 'rgba(168, 85, 247, 0.72)'
const SELL_STROKE = '#a855f7'

const R_MIN = 6
const R_MAX = 28

function radiusForQty(qty: number, maxQty: number): number {
  if (maxQty <= 0) return R_MIN
  const t = Math.sqrt(Math.min(1, qty / maxQty))
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
  const drawnRef = useRef(0)

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
    // Integer UTC seconds – LWC timeToCoordinate is reliable with whole seconds
    const normalized = bubbles.map((b) => ({
      ...b,
      timeSec: Math.floor(b.timeSec),
    }))
    const capped = normalized.length > 500 ? normalized.slice(-500) : normalized
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
    let drawn = 0

    for (const b of list) {
      // Prefer bridge helpers (series + timeScale)
      let x = bridge.timeToCoordinate(b.timeSec as any)
      let y = bridge.priceToCoordinate(b.price)

      // Fallback: direct chart API if bridge returns null
      if (x === null || y === null) {
        const chart = bridge.getChart()
        if (chart && x === null) {
          x = chart.timeScale().timeToCoordinate(b.timeSec as any)
        }
      }

      if (x === null || y === null) continue
      if (x < -40 || x > w + 40 || y < -40 || y > h + 40) continue

      const r = radiusForQty(b.qty, maxQty)
      const buy = b.aggressor === 'buy'

      // Soft glow
      ctx.beginPath()
      ctx.arc(x, y, r + 3, 0, Math.PI * 2)
      ctx.fillStyle = buy ? 'rgba(14, 203, 129, 0.15)' : 'rgba(168, 85, 247, 0.15)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = buy ? BUY_FILL : SELL_FILL
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = buy ? BUY_STROKE : SELL_STROKE
      ctx.stroke()

      drawn += 1
    }

    drawnRef.current = drawn

    // Badge
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(234, 236, 239, 0.95)'
    const modeLabel =
      config.mode === 'fixed'
        ? `min ≥ ${thresholdRef.current}`
        : `p${config.percentile} ≥ ${Number(thresholdRef.current).toPrecision(4)}`
    ctx.fillText(
      `Deep Trades · ${drawn}/${list.length} on chart · ${modeLabel}`,
      8,
      18
    )
    ctx.fillStyle = BUY_STROKE
    ctx.fillText('● buy', 8, 34)
    ctx.fillStyle = SELL_STROKE
    ctx.fillText('● sell', 55, 34)
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
    // Delay first paint one frame so LWC has laid out scales
    const raf = requestAnimationFrame(() => paint())

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
    }, 700)

    return () => {
      cancelAnimationFrame(raf)
      unsub?.()
      ro?.disconnect()
      window.clearInterval(id)
    }
  }, [enabled, bridge, exchange, symbol, config, rebuild, paint, containerRef])

  if (!enabled) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[6] pointer-events-none"
      aria-hidden
    />
  )
}
