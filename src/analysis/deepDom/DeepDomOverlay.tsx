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

interface DeepDomOverlayProps {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  exchange: ExchangeId
  symbol: string
  config?: DeepDomConfig
}

/** Absolute size → color: dark teal (low) → yellow → red (high) */
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

/**
 * Delta color: positive Δ (refill) → yellow/orange intense;
 * negative Δ (pull) → cool blue/cyan.
 * t in [0,1] intensity of |delta|.
 */
function deltaToColor(delta: number, t: number, alpha = 0.6): string {
  const x = Math.max(0, Math.min(1, t))
  if (delta >= 0) {
    // yellow → orange → red
    const r = Math.round(240 + x * (246 - 240))
    const g = Math.round(185 - x * (185 - 90))
    const b = Math.round(11 + x * (20 - 11))
    return `rgba(${r},${g},${b},${0.3 + x * alpha})`
  }
  // cool cyan → blue
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
  }, [
    enabled,
    exchange,
    symbol,
    config.sampleMs,
    config.bandPct,
    config.surpriseFactor,
  ])

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

    const snaps = bufRef.current.list(undefined, config.windowMinutes)
    if (snaps.length === 0) {
      ctx.font = '11px sans-serif'
      ctx.fillStyle = 'rgba(234, 236, 239, 0.85)'
      ctx.fillText('DeepDom · waiting for L2 snapshots…', 8, 18)
      const note = L2_GRANULARITY_NOTES[exchange] || ''
      if (note) {
        ctx.fillStyle = 'rgba(132, 142, 156, 0.9)'
        ctx.fillText(note.slice(0, 100), 8, 34)
      }
      return
    }

    // Scale: absolute size (p95) and |delta| (p95 of abs deltas)
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
      const colW = Math.max(1, Math.abs(x1 - x0))
      const x = Math.min(x0, x1)

      for (const lvl of snap.levels) {
        const y = bridge.priceToCoordinate(lvl.price)
        if (y === null) continue
        if (y < -4 || y > h + 4) continue

        const y2 = bridge.priceToCoordinate(lvl.price * (lvl.side > 0 ? 1.00005 : 0.99995))
        const rowH = y2 != null ? Math.max(1, Math.abs(y2 - y)) : 2

        // Cell fill: delta mode or absolute size
        if (config.showDelta && (lvl.deltaQty !== 0 || lvl.qty === 0)) {
          const t = Math.min(1, Math.abs(lvl.deltaQty) / p95Delta)
          ctx.fillStyle = deltaToColor(lvl.deltaQty, t)
        } else if (lvl.qty > 0) {
          const t = Math.min(1, lvl.qty / p95Size)
          ctx.fillStyle = sizeToColor(t, 0.25 + t * 0.45)
        } else {
          continue // pure vanished pull with no delta paint already handled above
        }
        ctx.fillRect(x, y - rowH / 2, colW + 0.5, rowH)

        // Magnet outline: stable levels
        if (config.showMagnet && lvl.persistence >= magnetM && lvl.qty > 0) {
          ctx.strokeStyle = 'rgba(240, 185, 11, 0.85)'
          ctx.lineWidth = 1
          ctx.strokeRect(x + 0.5, y - rowH / 2 + 0.5, Math.max(0, colW - 1), Math.max(0, rowH - 1))
        }

        // Surprise markers (only on recent columns to avoid clutter)
        if (
          config.showSurprise &&
          lvl.surprise &&
          i >= snaps.length - 8
        ) {
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

    // Legend
    ctx.font = '11px sans-serif'
    ctx.fillStyle = 'rgba(234, 236, 239, 0.95)'
    const mode = config.showDelta ? 'Δ' : 'size'
    ctx.fillText(
      `DeepDom · ${snaps.length} samples · ${mode} · ±${(config.bandPct * 100).toFixed(2)}% · ${config.windowMinutes}m · K=${config.surpriseFactor} M=${config.magnetSamples}`,
      8,
      18
    )
    ctx.fillStyle = 'rgba(132, 142, 156, 0.9)'
    ctx.fillText(
      (L2_GRANULARITY_NOTES[exchange] || statusRef.current).slice(0, 110),
      8,
      34
    )

    // Color ramp
    const rampX = w - 130
    const rampY = 10
    if (config.showDelta) {
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = deltaToColor(-1, 1 - i / 19, 0.85)
        ctx.fillRect(rampX + i * 2, rampY, 2, 8)
      }
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = deltaToColor(1, i / 19, 0.85)
        ctx.fillRect(rampX + 40 + i * 2, rampY, 2, 8)
      }
      ctx.fillStyle = 'rgba(132, 142, 156, 0.9)'
      ctx.font = '9px sans-serif'
      ctx.fillText('pull', rampX - 22, rampY + 8)
      ctx.fillText('refill', rampX + 82, rampY + 8)
    } else {
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = sizeToColor(i / 39, 0.85)
        ctx.fillRect(rampX + i * 2, rampY, 2, 8)
      }
      ctx.fillStyle = 'rgba(132, 142, 156, 0.9)'
      ctx.font = '9px sans-serif'
      ctx.fillText('size', rampX - 22, rampY + 8)
    }
  }, [bridge, containerRef, enabled, config, exchange])

  useEffect(() => {
    if (!enabled) {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    const raf = requestAnimationFrame(() => paint())
    const unsub = bridge?.onVisibleRangeChange(() => paint())
    const parent = containerRef.current
    let ro: ResizeObserver | null = null
    if (parent) {
      ro = new ResizeObserver(() => paint())
      ro.observe(parent)
    }
    const id = window.setInterval(() => paint(), 500)

    return () => {
      cancelAnimationFrame(raf)
      unsub?.()
      ro?.disconnect()
      window.clearInterval(id)
    }
  }, [enabled, bridge, paint, containerRef])

  if (!enabled) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[3] pointer-events-none"
      aria-hidden
    />
  )
}
