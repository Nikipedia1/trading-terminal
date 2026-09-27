/**
 * Deep Trades – real aggTrade bubbles, anti-pellicola.
 * Dense coverage · robust coordinates · LOD when zoomed out · layer L3.
 */

import { useEffect, useRef, useCallback } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { Candle, ExchangeId, Interval } from '@/types'
import {
  retainTradeBuffer,
  queryTradesInRange,
  queryTradesInRangeAsync,
  tradeBufferSize,
} from '@/analysis/deepPrint/tradeBuffer'
import { intervalToSeconds } from '@/analysis/deepPrint/interval'
import { filterDeepTrades, pickPerCandle } from './filter'
import { classifyBubbles } from './classify'
import type { DeepTradesConfig, DeepTradeBubble } from './types'
import type { AggressorTrade } from '@/data/shared'
import { lodFromVisibleBars, lodCap } from '@/analysis/lod'
import { LAYER_Z } from '@/charts/layerStack'
import { getSyncHighlight } from '@/stores/layoutStore'

interface DeepTradesOverlayProps {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  exchange: ExchangeId
  symbol: string
  config: DeepTradesConfig
  candles?: Candle[]
  interval?: Interval
  /** Sync group id for mirrored orderflow highlight */
  syncGroup?: string | null
}

const R_MIN = 5
const R_MAX = 16

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

function tradeToX(
  bridge: CoordinateBridge,
  timeSec: number,
  intervalSec: number,
  candles: Candle[]
): number | null {
  const t = Math.floor(timeSec)

  let x = bridge.timeToCoordinate(t as any)
  if (x !== null && Number.isFinite(x)) return x

  const barOpen = Math.floor(t / intervalSec) * intervalSec
  x = bridge.timeToCoordinate(barOpen as any)
  if (x !== null && Number.isFinite(x)) return x

  if (candles.length > 0) {
    let best = candles[0]
    let bestDist = Math.abs(candles[0].time - t)
    for (let i = 1; i < candles.length; i++) {
      const d = Math.abs(candles[i].time - t)
      if (d < bestDist) {
        bestDist = d
        best = candles[i]
      }
    }
    x = bridge.timeToCoordinate(best.time as any)
    if (x !== null && Number.isFinite(x)) return x
  }

  return null
}

function visibleBarCount(bridge: CoordinateBridge, intervalSec: number): number {
  try {
    const chart = bridge.getChart()
    if (!chart) return 120
    const range = chart.timeScale().getVisibleRange()
    if (!range || typeof range.from !== 'number' || typeof range.to !== 'number') return 120
    return Math.max(1, Math.ceil((range.to - range.from) / intervalSec))
  } catch {
    return 120
  }
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
  syncGroup = null,
}: DeepTradesOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bubblesRef = useRef<DeepTradeBubble[]>([])
  const thresholdRef = useRef(0)
  const maxQtyRef = useRef(1)
  const bufferCountRef = useRef(0)
  const archiveCacheRef = useRef<Map<string, AggressorTrade[]>>(new Map())

  useEffect(() => {
    if (!enabled) return
    return retainTradeBuffer(exchange, symbol)
  }, [enabled, exchange, symbol])

  useEffect(() => {
    if (!bridge || candles.length === 0) return
    bridge.setDataTimes(
      candles.map((c) => c.time),
      intervalToSeconds(interval)
    )
  }, [bridge, candles, interval])

  const applyTrades = useCallback(
    (trades: AggressorTrade[]) => {
      if (!enabled) {
        bubblesRef.current = []
        return
      }
      bufferCountRef.current = trades.length
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

      // LOD cap from visible bars
      const vis = bridge ? visibleBarCount(bridge, sec) : 120
      const lod = lodFromVisibleBars(vis)
      const capped = lodCap(
        [...classified].sort((a, b) => b.quoteQty - a.quoteQty),
        Math.min(lod.maxItems, 500),
        true
      )

      bubblesRef.current = capped
      thresholdRef.current = threshold
      maxQtyRef.current = Math.max(...capped.map((b) => b.qty), 1)
    },
    [enabled, config, candles, interval, bridge]
  )

  const rebuild = useCallback(() => {
    if (!enabled) {
      bubblesRef.current = []
      return
    }

    if (bridge && candles.length > 0) {
      bridge.setDataTimes(
        candles.map((c) => c.time),
        intervalToSeconds(interval)
      )
    }

    const now = Math.floor(Date.now() / 1000)
    const live = queryTradesInRange(exchange, symbol, now - 172_800, now + 120)
    bufferCountRef.current = tradeBufferSize(exchange, symbol)

    const merged = new Map<string, AggressorTrade>()
    for (const t of live) merged.set(t.id, t)
    for (const batch of archiveCacheRef.current.values()) {
      for (const t of batch) merged.set(t.id, t)
    }
    applyTrades(Array.from(merged.values()))

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
              const live2 = queryTradesInRange(
                exchange,
                symbol,
                now - 172_800,
                now + 120
              )
              const m = new Map<string, AggressorTrade>()
              for (const t of live2) m.set(t.id, t)
              for (const batch of archiveCacheRef.current.values()) {
                for (const t of batch) m.set(t.id, t)
              }
              applyTrades(Array.from(m.values()))
            })
          }
        }
      } catch {
        /* */
      }
    }
  }, [enabled, exchange, symbol, bridge, applyTrades, candles, interval])

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

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, w, h)
    ctx.clip()

    const sec = intervalToSeconds(interval)
    const vis = visibleBarCount(bridge, sec)
    const lod = lodFromVisibleBars(vis)
    const list = lodCap(bubblesRef.current, lod.maxItems, true)
    const maxQty = maxQtyRef.current
    const showLabels = config.showLabels !== false && lod.level === 0
    let drawn = 0
    let nEff = 0
    let nTrap = 0
    let nPend = 0

    const ordered = [...list].sort((a, b) => a.qty - b.qty)

    for (const b of ordered) {
      const x = tradeToX(bridge, b.timeSec, sec, candles)
      const y = bridge.priceToCoordinate(b.price)
      if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) continue

      const r = radiusForQty(b.qty, maxQty)
      const pad = r * 1.85 + 2
      if (x < pad || x > w - pad || y < r + 2 || y > h - r - 2) continue

      const buy = b.aggressor === 'buy'
      const outcome = b.outcome
      const baseRgb = buy ? '14, 203, 129' : '168, 85, 247'

      let fillA: number
      let strokeA: number
      let glowA: number
      let lineW: number

      if (outcome === 'effective') {
        fillA = 0.8
        strokeA = 1
        glowA = lod.level === 0 ? 0.18 : 0.08
        lineW = 1.75
        nEff += 1
      } else if (outcome === 'trapped') {
        fillA = 0.15
        strokeA = 0.55
        glowA = 0
        lineW = 1.2
        nTrap += 1
      } else {
        fillA = 0.55
        strokeA = 0.85
        glowA = lod.level === 0 ? 0.1 : 0
        lineW = 1.5
        nPend += 1
      }

      if (glowA > 0.01) {
        const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.8)
        g.addColorStop(0, `rgba(${baseRgb},${glowA})`)
        g.addColorStop(1, `rgba(${baseRgb},0)`)
        ctx.beginPath()
        ctx.arc(x, y, r * 1.8, 0, Math.PI * 2)
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
      body.addColorStop(0, `rgba(${baseRgb},${Math.min(1, fillA + 0.1)})`)
      body.addColorStop(1, `rgba(${baseRgb},${fillA * 0.55})`)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = body
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.lineWidth = lineW
      ctx.strokeStyle = `rgba(${baseRgb},${strokeA})`
      ctx.stroke()

      if (outcome === 'trapped' && lod.level === 0) {
        ctx.beginPath()
        ctx.setLineDash([2.5, 2])
        ctx.arc(x, y, r + 2, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${baseRgb},0.45)`
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.setLineDash([])
      }

      if (r >= 6 && (outcome === 'effective' || outcome === 'pending') && lod.level < 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
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

      if (showLabels && r >= 9) {
        const label = formatSize(b, config.sizeUnit)
        ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const tw = ctx.measureText(label).width
        const ly = y + r + 8
        if (ly + 6 < h && ly > 0 && x - tw / 2 > 4 && x + tw / 2 < w - 4) {
          ctx.fillStyle = 'rgba(11,14,17,0.6)'
          ctx.fillRect(x - tw / 2 - 3, ly - 6, tw + 6, 12)
          ctx.fillStyle = `rgba(${baseRgb},0.95)`
          ctx.fillText(label, x, ly)
        }
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }

      drawn += 1
    }

    // Synced orderflow highlight ring
    if (syncGroup) {
      const hl = getSyncHighlight(syncGroup)
      if (hl) {
        const hx = tradeToX(bridge, hl.timeSec, sec, candles)
        const hy = bridge.priceToCoordinate(hl.price)
        if (hx != null && hy != null) {
          const rgb = hl.aggressor === 'sell' ? '168, 85, 247' : '240, 185, 11'
          ctx.beginPath()
          ctx.arc(hx, hy, 14, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${rgb},0.95)`
          ctx.lineWidth = 2
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(hx, hy, 18, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${rgb},0.35)`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }
    }

    ctx.restore()

    {
      const unit = config.sizeUnit === 'quote' ? 'USDT' : 'base'
      const thr = thresholdRef.current
      const thrLabel =
        config.mode === 'percentile'
          ? `p${config.percentile}`
          : config.sizeUnit === 'quote'
            ? `≥${thr >= 1000 ? `${(thr / 1000).toFixed(0)}k` : thr.toFixed(0)}$`
            : `≥${thr}`

      const buf = bufferCountRef.current
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(11,14,17,0.75)'
      const hud =
        buf === 0 && list.length === 0
          ? `Deep Trades · buffer 0 tick – attendi stream live…`
          : `Trades ${drawn}/${list.length} · LOD${lod.level} · buf ${buf} · eff ${nEff} · trap ${nTrap} · pend ${nPend} · ${thrLabel} · ${unit}`
      const hw = ctx.measureText(hud).width
      ctx.fillRect(6, 4, hw + 10, 16)
      ctx.fillStyle =
        drawn > 0 ? 'rgba(234, 236, 239, 0.9)' : 'rgba(240, 185, 11, 0.95)'
      ctx.fillText(hud, 11, 15)
    }
  }, [bridge, containerRef, enabled, config, candles, interval, syncGroup])

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
    }, 500)

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
      className={`absolute inset-0 ${LAYER_Z.bubbles} pointer-events-none`}
      aria-hidden
    />
  )
}
