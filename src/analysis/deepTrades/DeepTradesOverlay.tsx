/**
 * Deep Trades – large semi-transparent bubbles (guide-style radius).
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

const BUY_FILL = 'rgba(14, 203, 129, 0.38)'
const BUY_STROKE = 'rgba(14, 203, 129, 0.9)'
const SELL_FILL = 'rgba(168, 85, 247, 0.38)'
const SELL_STROKE = 'rgba(168, 85, 247, 0.9)'

const R_MIN = 9
const R_MAX = 36

function radiusForQty(qty: number, maxQty: number): number {
  if (maxQty <= 0) return R_MIN
  const t = Math.pow(Math.min(1, qty / maxQty), 0.45)
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
    const normalized = bubbles.map((b) => ({
      ...b,
      timeSec: Math.floor(b.timeSec),
    }))
    // Less clutter: keep top 120 by size among recent
    const capped =
      normalized.length > 120
        ? [...normalized].sort((a, b) => b.qty - a.qty).slice(0, 120)
        : normalized
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
      let x = bridge.timeToCoordinate(b.timeSec as any)
      const y = bridge.priceToCoordinate(b.price)
      if (x === null) {
        const chart = bridge.getChart()
        if (chart) x = chart.timeScale().timeToCoordinate(b.timeSec as any)
      }
      if (x === null || y === null) continue
      if (x < -50 || x > w + 50 || y < -50 || y > h + 50) continue

      const r = radiusForQty(b.qty, maxQty)
      const buy = b.aggressor === 'buy'

      ctx.beginPath()
      ctx.arc(x, y, r + 4, 0, Math.PI * 2)
      ctx.fillStyle = buy ? 'rgba(14, 203, 129, 0.12)' : 'rgba(168, 85, 247, 0.12)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = buy ? BUY_FILL : SELL_FILL
      ctx.fill()
      ctx.lineWidth = 1.75
      ctx.strokeStyle = buy ? BUY_STROKE : SELL_STROKE
      ctx.stroke()

      drawn += 1
    }

    // Minimal badge
    if (drawn > 0 || list.length > 0) {
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(234, 236, 239, 0.75)'
      ctx.fillText(`Trades ${drawn}`, 8, 14)
    }
  }, [bridge, containerRef, enabled])

  useEffect(() => {
    if (!enabled) {
      bubblesRef.current = []
      const canvas = canvasRef.current
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    rebuild()
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
    <canvas ref={canvasRef} className="absolute inset-0 z-[6] pointer-events-none" aria-hidden />
  )
}
