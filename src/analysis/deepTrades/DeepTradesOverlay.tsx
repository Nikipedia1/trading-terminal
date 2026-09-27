/**
 * Deep Trades – real aggTrade bubbles, anti-pellicola.
 * Dense coverage (top N per candle) · no edge-clipped monsters.
 */

import { useEffect, useRef, useCallback } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { Candle, ExchangeId, Interval } from '@/types'
import {
  retainTradeBuffer,
  queryTradesInRange,
  queryTradesInRangeAsync,
} from '@/analysis/deepPrint/tradeBuffer'
import { intervalToSeconds } from '@/analysis/deepPrint/interval'
import { filterDeepTrades, pickPerCandle } from './filter'
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

const R_MIN = 4
const R_MAX = 18

function radiusForQty(qty: number, maxQty: number): number {
  if (maxQty <= 0) return R_MIN
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
  const archiveCacheRef = useRef<Map<string, import('@/data/shared').AggressorTrade[]>>(
    new Map()
  )

  useEffect(() => {
    if (!enabled) return
    return retainTradeBuffer(exchange, symbol)
  }, [enabled, exchange, symbol])

  const applyTrades = useCallback(
    (trades: import('@/data/shared').AggressorTrade[]) => {
      if (!enabled) {
        bubblesRef.current = []
        return
      }
      const { bubbles, threshold } = filterDeepTrades(trades, config)
      const sec = intervalToSeconds(interval)
      let classified = classifyBubbles(
        bubbles,
        candles,
        sec,
        config.confirmBars ?? 1
      )

      if (config.onlyEffective) {
        classified = classified.filter((b) => b.outcome === 'effective')
      }

      const maxPer = config.maxPerCandle ?? 2
      if (maxPer > 0) {
        classified = pickPerCandle(classified, sec, maxPer)
      }

      // Hard cap for perf
      const capped =
        classified.length > 400
          ? [...classified].sort((a, b) => b.quoteQty - a.quoteQty).slice(0, 400)
          : classified

      bubblesRef.current = capped
      thresholdRef.current = threshold
      maxQtyRef.current = Math.max(...capped.map((b) => b.qty), 1)
    },
    [enabled, config, candles, interval]
  )

  const rebuild = useCallback(() => {
    if (!enabled) {
      bubblesRef.current = []
      return
    }

    // Always use full live buffer (48h ring) so every candle that has
    // buffered trades can show a print – not only the visible slice sample.
    const now = Math.floor(Date.now() / 1000)
    const live = queryTradesInRange(exchange, symbol, now - 172_800, now + 60)

    // Merge any archive cache for denser history
    const merged = new Map<string, import('@/data/shared').AggressorTrade>()
    for (const t of live) merged.set(t.id, t)
    for (const batch of archiveCacheRef.current.values()) {
      for (const t of batch) merged.set(t.id, t)
    }
    applyTrades(Array.from(merged.values()))

    // Async backfill from IndexedDB for the visible range (no invent)
    const chart = bridge?.getChart()
    if (chart) {
      try {
        const range = chart.timeScale().getVisibleRange()
        if (
          range &&
          typeof range.from === 'number' &&
          typeof range.to === 'number'
        ) {
          const key = `${Math.floor(range.from)}:${Math.floor(range.to)}`
          if (!archiveCacheRef.current.has(key)) {
            void queryTradesInRangeAsync(
              exchange,
              symbol,
              range.from - 600,
              range.to + 600
            ).then((archived) => {
              if (archived.length === 0) return
              archiveCacheRef.current.set(key, archived)
              // rebuild with new data
              const live2 = queryTradesInRange(
                exchange,
                symbol,
                now - 172_800,
                now + 60
              )
              const m = new Map<string, import('@/data/shared').AggressorTrade>()
              for (const t of live2) m.set(t.id, t)
              for (const batch of archiveCacheRef.current.values()) {
                for (const t of batch) m.set(t.id, t)
              }
              applyTrades(Array.from(m.values()))
              // trigger paint via interval / range sub – force next frame
            })
          }
        }
      } catch {
        /* */
      }
    }
  }, [enabled, exchange, symbol, bridge, applyTrades])

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

    const ordered = [...list].sort((a, b) => a.qty - b.qty)

    for (const b of ordered) {
      const x = bridge.timeToCoordinate(b.timeSec as any)
      const y = bridge.priceToCoordinate(b.price)
      if (x === null || y === null) continue
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue

      const r = radiusForQty(b.qty, maxQty)

      // STRICT: center must leave full radius inside the canvas.
      // No half-bubbles on left/right edge.
      if (x < r + 1 || x > w - r - 1 || y < r + 1 || y > h - r - 1) continue

      const buy = b.aggressor === 'buy'
      const outcome = b.outcome
      const baseRgb = buy ? '14, 203, 129' : '168, 85, 247'

      let fillA: number
      let strokeA: number
      let glowA: number
      let lineW: number

      if (outcome === 'effective') {
        fillA = 0.75
        strokeA = 0.95
        glowA = 0.18
        lineW = 1.75
        nEff += 1
      } else if (outcome === 'trapped') {
        fillA = 0.12
        strokeA = 0.5
        glowA = 0
        lineW = 1.15
        nTrap += 1
      } else {
        fillA = 0.38
        strokeA = 0.7
        glowA = 0.06
        lineW = 1.35
        nPend += 1
      }

      if (glowA > 0.01) {
        const g = ctx.createRadialGradient(x, y, r * 0.25, x, y, r * 1.9)
        g.addColorStop(0, `rgba(${baseRgb},${glowA})`)
        g.addColorStop(1, `rgba(${baseRgb},0)`)
        ctx.beginPath()
        ctx.arc(x, y, r * 1.9, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
      }

      const body = ctx.createRadialGradient(
        x - r * 0.25,
        y - r * 0.25,
        0,
        x,
        y,
        r
      )
      body.addColorStop(0, `rgba(${baseRgb},${Math.min(1, fillA + 0.12)})`)
      body.addColorStop(1, `rgba(${baseRgb},${fillA * 0.5})`)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = body
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.lineWidth = lineW
      ctx.strokeStyle = `rgba(${baseRgb},${strokeA})`
      ctx.stroke()

      if (outcome === 'trapped') {
        ctx.beginPath()
        ctx.setLineDash([2.5, 2])
        ctx.arc(x, y, r + 2, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${baseRgb},0.4)`
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.setLineDash([])
      }

      if (r >= 6 && outcome === 'effective') {
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.beginPath()
        if (buy) {
          ctx.moveTo(x, y - r * 0.32)
          ctx.lineTo(x - r * 0.26, y + r * 0.2)
          ctx.lineTo(x + r * 0.26, y + r * 0.2)
        } else {
          ctx.moveTo(x, y + r * 0.32)
          ctx.lineTo(x - r * 0.26, y - r * 0.2)
          ctx.lineTo(x + r * 0.26, y - r * 0.2)
        }
        ctx.closePath()
        ctx.fill()
      }

      if (showLabels && r >= 10) {
        const label = formatSize(b, config.sizeUnit)
        ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const tw = ctx.measureText(label).width
        const ly = y + r + 8
        if (ly + 6 < h) {
          ctx.fillStyle = 'rgba(11,14,17,0.55)'
          ctx.fillRect(x - tw / 2 - 3, ly - 6, tw + 6, 12)
          ctx.fillStyle = `rgba(${baseRgb},0.95)`
          ctx.fillText(label, x, ly)
        }
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }

      drawn += 1
    }

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
      const hud = `Trades ${drawn}/${list.length} · eff ${nEff} · trap ${nTrap} · pend ${nPend} · ${thrLabel} · ${unit}`
      const hw = ctx.measureText(hud).width
      ctx.fillRect(6, 4, hw + 10, 16)
      ctx.fillStyle = 'rgba(234, 236, 239, 0.88)'
      ctx.fillText(hud, 11, 15)
    }
  }, [bridge, containerRef, enabled, config])

  useEffect(() => {
    if (!enabled) {
      bubblesRef.current = []
      archiveCacheRef.current.clear()
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
    }, 600)

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
