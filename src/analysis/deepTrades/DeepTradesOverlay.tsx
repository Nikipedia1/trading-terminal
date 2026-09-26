/**
 * Deep Trades – bubbles with Effective / Trapped styling.
 * Anti-pellicola: timeToCoordinate / priceToCoordinate.
 */

import { useEffect, useRef, useCallback } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { Candle, ExchangeId, Interval } from '@/types'
import { retainTradeBuffer, queryTradesInRange } from '@/analysis/deepPrint/tradeBuffer'
import { intervalToSeconds } from '@/analysis/deepPrint/interval'
import { filterDeepTrades } from './filter'
import { classifyBubbles } from './classify'
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
  candles?: Candle[]
  interval?: Interval
}

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
  candles = [],
  interval = '1m',
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
    const sec = intervalToSeconds(interval)
    let classified = classifyBubbles(bubbles, candles, sec)

    if (config.onlyEffective) {
      classified = classified.filter((b) => b.outcome === 'effective')
    }

    // Cap for draw perf – prefer largest
    const capped =
      classified.length > 120
        ? [...classified].sort((a, b) => b.qty - a.qty).slice(0, 120)
        : classified

    bubblesRef.current = capped
    thresholdRef.current = threshold
    maxQtyRef.current = Math.max(...capped.map((b) => b.qty), 1)
  }, [enabled, exchange, symbol, config, candles, interval])

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
    let nEff = 0
    let nTrap = 0

    for (const b of list) {
      let x = bridge.timeToCoordinate(Math.floor(b.timeSec) as any)
      const y = bridge.priceToCoordinate(b.price)
      if (x === null) {
        const chart = bridge.getChart()
        if (chart) x = chart.timeScale().timeToCoordinate(Math.floor(b.timeSec) as any)
      }
      if (x === null || y === null) continue
      if (x < -50 || x > w + 50 || y < -50 || y > h + 50) continue

      const r = radiusForQty(b.qty, maxQty)
      const buy = b.aggressor === 'buy'
      const outcome = b.outcome

      // Style by outcome
      let fill: string
      let stroke: string
      let lineW = 1.75

      if (outcome === 'effective') {
        fill = buy ? 'rgba(14, 203, 129, 0.72)' : 'rgba(168, 85, 247, 0.72)'
        stroke = buy ? '#0ecb81' : '#a855f7'
        lineW = 2.25
        nEff += 1
      } else if (outcome === 'trapped') {
        fill = buy ? 'rgba(14, 203, 129, 0.08)' : 'rgba(168, 85, 247, 0.08)'
        stroke = buy ? 'rgba(14, 203, 129, 0.55)' : 'rgba(168, 85, 247, 0.55)'
        lineW = 1.5
        nTrap += 1
      } else {
        // pending – soft
        fill = buy ? 'rgba(14, 203, 129, 0.28)' : 'rgba(168, 85, 247, 0.28)'
        stroke = buy ? 'rgba(14, 203, 129, 0.7)' : 'rgba(168, 85, 247, 0.7)'
      }

      ctx.beginPath()
      ctx.arc(x, y, r + 3, 0, Math.PI * 2)
      ctx.fillStyle =
        outcome === 'effective'
          ? buy
            ? 'rgba(14, 203, 129, 0.14)'
            : 'rgba(168, 85, 247, 0.14)'
          : 'transparent'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.lineWidth = lineW
      ctx.strokeStyle = stroke
      ctx.stroke()

      // Dashed ring for trapped
      if (outcome === 'trapped') {
        ctx.beginPath()
        ctx.setLineDash([3, 2])
        ctx.arc(x, y, r + 2, 0, Math.PI * 2)
        ctx.strokeStyle = stroke
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.setLineDash([])
      }

      drawn += 1
    }

    if (drawn > 0 || list.length > 0) {
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(234, 236, 239, 0.8)'
      const unit = config.sizeUnit === 'quote' ? 'USDT' : 'base'
      ctx.fillText(
        `Trades ${drawn} · eff ${nEff} · trap ${nTrap} · ${unit}`,
        8,
        14
      )
    }
  }, [bridge, containerRef, enabled, config.sizeUnit])

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
    }, 800)

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
