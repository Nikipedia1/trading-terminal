/**
 * Deep Trades – real aggTrade bubbles, anti-pellicola.
 * Precise time/price placement, multi-bar effective/trapped, clean visuals.
 */

import { useEffect, useRef, useCallback } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { Candle, ExchangeId, Interval } from '@/types'
import { retainTradeBuffer, queryTradesInRange } from '@/analysis/deepPrint/tradeBuffer'
import { intervalToSeconds } from '@/analysis/deepPrint/interval'
import { filterDeepTrades } from './filter'
import { classifyBubbles } from './classify'
import type { DeepTradesConfig, DeepTradeBubble } from './types'

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

const R_MIN = 5
const R_MAX = 22

function radiusForQty(qty: number, maxQty: number): number {
  if (maxQty <= 0) return R_MIN
  // log scale → big prints stand out without covering the chart
  const t = Math.log1p(qty) / Math.log1p(maxQty)
  return R_MIN + Math.min(1, Math.max(0, t)) * (R_MAX - R_MIN)
}

function formatSize(b: DeepTradeBubble, unit: 'base' | 'quote'): string {
  if (unit === 'quote') {
    const q = b.quoteQty
    if (q >= 1_000_000) return `${(q / 1_000_000).toFixed(1)}M`
    if (q >= 1_000) return `${(q / 1_000).toFixed(0)}k`
    return q.toFixed(0)
  }
  const q = b.baseQty
  if (q >= 100) return q.toFixed(0)
  if (q >= 1) return q.toFixed(2)
  return q.toFixed(3)
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

    // Prefer visible time window so classification stays aligned with what you see
    let startSec = Math.floor(Date.now() / 1000) - 86_400
    let endSec = Math.floor(Date.now() / 1000) + 120
    const chart = bridge?.getChart()
    if (chart) {
      try {
        const range = chart.timeScale().getVisibleRange()
        if (
          range &&
          typeof range.from === 'number' &&
          typeof range.to === 'number'
        ) {
          // pad so edge bubbles still classify
          const pad = Math.max(300, (range.to - range.from) * 0.15)
          startSec = range.from - pad
          endSec = range.to + pad
        }
      } catch {
        /* keep defaults */
      }
    }

    const trades = queryTradesInRange(exchange, symbol, startSec, endSec)
    // Fallback: if visible window empty (just opened), use full buffer recent
    const all =
      trades.length > 0
        ? trades
        : queryTradesInRange(
            exchange,
            symbol,
            Math.floor(Date.now() / 1000) - 172_800,
            Math.floor(Date.now() / 1000) + 60
          )

    const { bubbles, threshold } = filterDeepTrades(all, config)
    const sec = intervalToSeconds(interval)
    let classified = classifyBubbles(
      bubbles,
      candles,
      sec,
      config.confirmBars ?? 2
    )

    if (config.onlyEffective) {
      classified = classified.filter((b) => b.outcome === 'effective')
    }

    // Cap for draw perf – keep largest by notional
    const capped =
      classified.length > 150
        ? [...classified].sort((a, b) => b.quoteQty - a.quoteQty).slice(0, 150)
        : classified

    bubblesRef.current = capped
    thresholdRef.current = threshold
    maxQtyRef.current = Math.max(...capped.map((b) => b.qty), 1)
  }, [enabled, exchange, symbol, config, candles, interval, bridge])

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
    const showLabels = config.showLabels !== false
    let drawn = 0
    let nEff = 0
    let nTrap = 0
    let nPend = 0

    // Draw smallest first so large prints sit on top
    const ordered = [...list].sort((a, b) => a.qty - b.qty)

    for (const b of ordered) {
      const x = bridge.timeToCoordinate(b.timeSec as any)
      const y = bridge.priceToCoordinate(b.price)
      if (x === null || y === null) continue

      const r = radiusForQty(b.qty, maxQty)

      // Fully off-screen (with radius margin) → skip (no clipped monsters)
      if (x + r < 0 || x - r > w || y + r < 0 || y - r > h) continue

      const buy = b.aggressor === 'buy'
      const outcome = b.outcome

      // Edge fade: reduce opacity near borders
      let edgeAlpha = 1
      const margin = r + 4
      if (x < margin) edgeAlpha = Math.max(0.15, x / margin)
      else if (x > w - margin) edgeAlpha = Math.max(0.15, (w - x) / margin)
      if (y < margin) edgeAlpha = Math.min(edgeAlpha, Math.max(0.15, y / margin))
      else if (y > h - margin)
        edgeAlpha = Math.min(edgeAlpha, Math.max(0.15, (h - y) / margin))

      const baseRgb = buy ? '14, 203, 129' : '168, 85, 247'

      let fillA: number
      let strokeA: number
      let glowA: number
      let lineW: number

      if (outcome === 'effective') {
        fillA = 0.78 * edgeAlpha
        strokeA = 0.95 * edgeAlpha
        glowA = 0.22 * edgeAlpha
        lineW = 2
        nEff += 1
      } else if (outcome === 'trapped') {
        fillA = 0.1 * edgeAlpha
        strokeA = 0.55 * edgeAlpha
        glowA = 0
        lineW = 1.25
        nTrap += 1
      } else {
        fillA = 0.32 * edgeAlpha
        strokeA = 0.65 * edgeAlpha
        glowA = 0.08 * edgeAlpha
        lineW = 1.5
        nPend += 1
      }

      // Soft outer glow (effective only)
      if (glowA > 0.01) {
        const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.2)
        g.addColorStop(0, `rgba(${baseRgb},${glowA})`)
        g.addColorStop(1, `rgba(${baseRgb},0)`)
        ctx.beginPath()
        ctx.arc(x, y, r * 2.2, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
      }

      // Body
      const body = ctx.createRadialGradient(
        x - r * 0.25,
        y - r * 0.25,
        0,
        x,
        y,
        r
      )
      body.addColorStop(0, `rgba(${baseRgb},${Math.min(1, fillA + 0.15)})`)
      body.addColorStop(1, `rgba(${baseRgb},${fillA * 0.55})`)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = body
      ctx.fill()

      // Ring
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.lineWidth = lineW
      ctx.strokeStyle = `rgba(${baseRgb},${strokeA})`
      ctx.stroke()

      // Trapped: dashed outer ring
      if (outcome === 'trapped') {
        ctx.beginPath()
        ctx.setLineDash([2.5, 2])
        ctx.arc(x, y, r + 2.5, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${baseRgb},${0.45 * edgeAlpha})`
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Direction tick (small triangle)
      if (r >= 7 && outcome === 'effective') {
        ctx.fillStyle = `rgba(255,255,255,${0.85 * edgeAlpha})`
        ctx.beginPath()
        if (buy) {
          ctx.moveTo(x, y - r * 0.35)
          ctx.lineTo(x - r * 0.28, y + r * 0.22)
          ctx.lineTo(x + r * 0.28, y + r * 0.22)
        } else {
          ctx.moveTo(x, y + r * 0.35)
          ctx.lineTo(x - r * 0.28, y - r * 0.22)
          ctx.lineTo(x + r * 0.28, y - r * 0.22)
        }
        ctx.closePath()
        ctx.fill()
      }

      // Size label on larger bubbles
      if (showLabels && r >= 11 && edgeAlpha > 0.4) {
        const label = formatSize(b, config.sizeUnit)
        ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = `rgba(11,14,17,${0.55 * edgeAlpha})`
        const tw = ctx.measureText(label).width
        ctx.fillRect(x - tw / 2 - 3, y + r + 2, tw + 6, 12)
        ctx.fillStyle = `rgba(${baseRgb},${0.95 * edgeAlpha})`
        ctx.fillText(label, x, y + r + 8)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }

      drawn += 1
    }

    // HUD
    if (drawn > 0 || list.length > 0) {
      const unit = config.sizeUnit === 'quote' ? 'USDT' : 'base'
      const thr = thresholdRef.current
      const thrLabel =
        config.mode === 'percentile'
          ? `p${config.percentile}`
          : config.sizeUnit === 'quote'
            ? `≥${thr >= 1000 ? `${(thr / 1000).toFixed(0)}k` : thr.toFixed(0)}$`
            : `≥${thr}`

      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(11,14,17,0.72)'
      const hud = `Trades ${drawn} · eff ${nEff} · trap ${nTrap} · pend ${nPend} · ${thrLabel} · ${unit}`
      const hw = ctx.measureText(hud).width
      ctx.fillRect(6, 4, hw + 10, 16)
      ctx.fillStyle = 'rgba(234, 236, 239, 0.88)'
      ctx.fillText(hud, 11, 15)
    }
  }, [bridge, containerRef, enabled, config])

  useEffect(() => {
    if (!enabled) {
      bubblesRef.current = []
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    rebuild()
    const raf = requestAnimationFrame(() => paint())
    const unsub = bridge?.onVisibleRangeChange(() => {
      rebuild()
      paint()
    })
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
