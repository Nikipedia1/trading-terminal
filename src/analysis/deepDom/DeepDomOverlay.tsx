/**
 * DeepDom – resting liquidity heatmap (time × price) + delta / surprise / magnet.
 * Anti-pellicola: X = timeToCoordinate, Y = priceToCoordinate.
 * Deep Trades stay on their own overlay (higher z) for aggression vs passive liquidity.
 */

import { useEffect, useRef, useCallback } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { ExchangeId } from '@/types'
import { subscribeOrderBookFeed } from '@/data/shared'
import { DomSnapshotBuffer } from './buffer'
import { sampleBookBand, toPrevMap } from './sample'
import type { DeepDomConfig, DomLevel } from './types'
import { DEFAULT_DEEP_DOM_CONFIG, L2_GRANULARITY_NOTES } from './types'

const DEEPDOM_DEBUG =
  typeof localStorage !== 'undefined' && localStorage.getItem('DEEPDOM_DEBUG') === '1'

interface DeepDomOverlayProps {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  exchange: ExchangeId
  symbol: string
  config?: DeepDomConfig
}

function sizeToColor(t: number, alpha = 0.55): string {
  const x = Math.max(0, Math.min(1, t))
  let r: number, g: number, b: number
  if (x < 0.5) {
    const u = x / 0.5
    r = Math.round(20 + u * (240 - 20))
    g = Math.round(80 + u * (185 - 80))
    b = Math.round(120 + u * (11 - 120))
  } else {
    const u = (x - 0.5) / 0.5
    r = Math.round(240 + u * (246 - 240))
    g = Math.round(185 + u * (70 - 185))
    b = Math.round(11 + u * (93 - 11))
  }
  return `rgba(${r},${g},${b},${alpha})`
}

function deltaToColor(delta: number, t: number, alpha = 0.6): string {
  const x = Math.max(0, Math.min(1, t))
  if (delta >= 0) {
    const r = Math.round(240 + x * (246 - 240))
    const g = Math.round(185 - x * (185 - 90))
    const b = Math.round(11 + x * (20 - 11))
    return `rgba(${r},${g},${b},${0.3 + x * alpha})`
  }
  const r = Math.round(30 + x * (40 - 30))
  const g = Math.round(140 + x * (100 - 140))
  const b = Math.round(200 + x * (220 - 200))
  return `rgba(${r},${g},${b},${0.3 + x * alpha})`
}

export function DeepDomOverlay({
  enabled,
  bridge,
  containerRef,
  exchange,
  symbol,
  config = DEFAULT_DEEP_DOM_CONFIG,
}: DeepDomOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bufRef = useRef(new DomSnapshotBuffer(config.windowMinutes, config.sampleMs))
  const lastBookRef = useRef<import('@/data/shared').OrderBookSnapshot | null>(null)
  const prevMapRef = useRef(toPrevMap(null))
  const statusRef = useRef('')
  const lastPaintAtRef = useRef(0)

  useEffect(() => {
    bufRef.current.reconfigure(config)
  }, [config])

  useEffect(() => {
    if (!enabled) {
      bufRef.current.clear()
      lastBookRef.current = null
      prevMapRef.current = toPrevMap(null)
      return
    }

    const sub = subscribeOrderBookFeed(exchange, symbol, {
      onBook: (b) => {
        if (b.ready) lastBookRef.current = b
      },
      onStatus: (s) => {
        statusRef.current = s.status + (s.detail ? ` ${s.detail}` : '')
      },
    })

    const sampleId = window.setInterval(() => {
      const book = lastBookRef.current
      if (!book) return
      const snap = sampleBookBand(
        book,
        config.bandPct,
        prevMapRef.current,
        config.surpriseFactor
      )
      if (snap) {
        bufRef.current.push(snap)
        prevMapRef.current = toPrevMap(snap)
      }
    }, config.sampleMs)

    return () => {
      sub.unsubscribe()
      window.clearInterval(sampleId)
    }
  }, [enabled, exchange, symbol, config.sampleMs, config.bandPct, config.surpriseFactor])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const parent = containerRef.current
    if (!canvas || !parent || !bridge || !enabled) return

    const w = parent.clientWidth
    const h = parent.clientHeight
    if (w <= 0 || h <= 0) return

    if (DEEPDOM_DEBUG) {
      const now = performance.now()
      const gap = lastPaintAtRef.current ? now - lastPaintAtRef.current : 0
      lastPaintAtRef.current = now
      console.debug(
        `[DeepDom] paint Δ=${gap.toFixed(1)}ms | buffer=${bufRef.current.size}`
      )
    }

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

    const snaps = bufRef.current.getSnapshots()
    if (snaps.length === 0) {
      ctx.font = '12px sans-serif'
      ctx.fillStyle = 'rgba(234, 236, 239, 0.7)'
      ctx.fillText('DeepDom · waiting for L2 snapshots…', 8, 18)
      return
    }

    const sizes: number[] = []
    const absDeltas: number[] = []
    for (const s of snaps) {
      for (const l of s.levels) {
        if (l.qty > 0) sizes.push(l.qty)
        if (l.deltaQty !== 0) absDeltas.push(Math.abs(l.deltaQty))
      }
    }
    sizes.sort((a, b) => a - b)
    absDeltas.sort((a, b) => a - b)
    const p95Size = sizes[Math.min(sizes.length - 1, Math.floor(sizes.length * 0.95))] || 1
    const p95Delta =
      absDeltas[Math.min(absDeltas.length - 1, Math.floor(absDeltas.length * 0.95))] || 1
    const magnetM = Math.max(2, config.magnetSamples)

    for (let i = 0; i < snaps.length; i++) {
      const snap = snaps[i]
      const x0 = bridge.timeToCoordinate(snap.timeSec as any)
      if (x0 === null) continue

      let x1: number
      if (i + 1 < snaps.length) {
        const xn = bridge.timeToCoordinate(snaps[i + 1].timeSec as any)
        x1 = xn != null ? xn : x0 + 3
      } else {
        x1 = x0 + Math.max(2, (w / Math.max(snaps.length, 1)) * 0.8)
      }
      const colW = Math.max(2.5, Math.abs(x1 - x0))
      const x = Math.min(x0, x1)

      const sortedY: number[] = []
      for (const lvl of snap.levels) {
        const yy = bridge.priceToCoordinate(lvl.price)
        if (yy != null && yy >= -4 && yy <= h + 4) sortedY.push(yy)
      }
      sortedY.sort((a, b) => a - b)
      let medianPitch = 3
      if (sortedY.length >= 2) {
        const gaps: number[] = []
        for (let k = 1; k < sortedY.length; k++) {
          const g = sortedY[k] - sortedY[k - 1]
          if (g > 0.5) gaps.push(g)
        }
        if (gaps.length) {
          gaps.sort((a, b) => a - b)
          medianPitch = gaps[Math.floor(gaps.length / 2)]
        }
      }
      const baseRowH = Math.max(2.5, Math.min(12, medianPitch * 0.88))

      for (const lvl of snap.levels) {
        const y = bridge.priceToCoordinate(lvl.price)
        if (y === null) continue
        if (y < -4 || y > h + 4) continue

        const y2 = bridge.priceToCoordinate(lvl.price * (lvl.side > 0 ? 1.00008 : 0.99992))
        let rowH = y2 != null ? Math.abs(y2 - y) : baseRowH
        rowH = Math.max(baseRowH, rowH)
        rowH = Math.min(rowH, 14)

        if (config.showDelta && (lvl.deltaQty !== 0 || lvl.qty === 0)) {
          const t = Math.min(1, Math.abs(lvl.deltaQty) / p95Delta)
          ctx.fillStyle = deltaToColor(lvl.deltaQty, t)
        } else if (lvl.qty > 0) {
          const t = Math.min(1, lvl.qty / p95Size)
          ctx.fillStyle = sizeToColor(t, 0.25 + t * 0.45)
        } else {
          continue
        }
        ctx.fillRect(x, y - rowH / 2, colW + 0.5, rowH)

        if (config.showMagnet && lvl.persistence >= magnetM && lvl.qty > 0) {
          ctx.strokeStyle = 'rgba(240, 185, 11, 0.85)'
          ctx.lineWidth = 1
          ctx.strokeRect(x + 0.5, y - rowH / 2 + 0.5, Math.max(0, colW - 1), Math.max(0, rowH - 1))
        }

        if (config.showSurprise && lvl.surprise && i >= snaps.length - 8) {
          const label = lvl.surprise === 'refill' ? 'R' : 'P'
          ctx.font = 'bold 9px sans-serif'
          ctx.fillStyle =
            lvl.surprise === 'refill'
              ? 'rgba(246, 185, 11, 0.95)'
              : 'rgba(96, 165, 250, 0.95)'
          ctx.fillText(label, x + 1, y - rowH / 2 - 1)
        }
      }
    }

    ctx.font = '11px sans-serif'
    ctx.fillStyle = 'rgba(234, 236, 239, 0.95)'
    const mode = config.showDelta ? 'Δ' : 'size'
    ctx.fillText(
      `DeepDom · ${snaps.length} samples · ${mode} · ±${(config.bandPct * 100).toFixed(2)}% · ${config.windowMinutes}m`,
      8,
      18
    )
    ctx.fillStyle = 'rgba(132, 142, 156, 0.9)'
    ctx.fillText((L2_GRANULARITY_NOTES[exchange] || statusRef.current).slice(0, 110), 8, 34)
  }, [bridge, enabled, containerRef, config, exchange])

  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => paint(), 500)
    paint()
    return () => window.clearInterval(id)
  }, [enabled, paint])

  useEffect(() => {
    if (!bridge || !enabled) return
    const unsub = bridge.subscribe?.(() => paint())
    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [bridge, enabled, paint])

  if (!enabled) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 6 }}
    />
  )
}
