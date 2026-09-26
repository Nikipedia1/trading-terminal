/**
 * DeepDom – resting liquidity heatmap (time × price).
 * Anti-pellicola: X = timeToCoordinate, Y = priceToCoordinate.
 * Deep Trades stay on their own overlay (higher z) for aggression vs passive liquidity.
 */

import { useEffect, useRef, useCallback } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { ExchangeId } from '@/types'
import { subscribeOrderBookFeed } from '@/data/shared'
import { DomSnapshotBuffer } from './buffer'
import { sampleBookBand } from './sample'
import type { DeepDomConfig } from './types'
import { DEFAULT_DEEP_DOM_CONFIG, L2_GRANULARITY_NOTES } from './types'

interface DeepDomOverlayProps {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  exchange: ExchangeId
  symbol: string
  config?: DeepDomConfig
}

/** Size → color: dark teal (low) → yellow → red (high) */
function sizeToColor(t: number, alpha = 0.55): string {
  const x = Math.max(0, Math.min(1, t))
  // 0 → blue-green, 0.5 → yellow, 1 → red
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
  const statusRef = useRef('' )

  useEffect(() => {
    bufRef.current.reconfigure(config)
  }, [config])

  useEffect(() => {
    if (!enabled) {
      bufRef.current.clear()
      lastBookRef.current = null
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
      const snap = sampleBookBand(book, config.bandPct)
      if (snap) bufRef.current.push(snap)
    }, config.sampleMs)

    return () => {
      sub.unsubscribe()
      window.clearInterval(sampleId)
    }
  }, [enabled, exchange, symbol, config.sampleMs, config.bandPct])

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
        ctx.fillText(note.slice(0, 90), 8, 34)
      }
      return
    }

    // Max size for color scale (robust: p95)
    const sizes: number[] = []
    for (const s of snaps) for (const l of s.levels) sizes.push(l.qty)
    sizes.sort((a, b) => a - b)
    const p95 = sizes[Math.min(sizes.length - 1, Math.floor(sizes.length * 0.95))] || 1

    // Column width from adjacent sample times
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

        // Approximate row height from neighboring price step
        const y2 = bridge.priceToCoordinate(lvl.price * (lvl.side > 0 ? 1.00005 : 0.99995))
        const rowH = y2 != null ? Math.max(1, Math.abs(y2 - y)) : 2

        const t = Math.min(1, lvl.qty / p95)
        ctx.fillStyle = sizeToColor(t, 0.25 + t * 0.45)
        ctx.fillRect(x, y - rowH / 2, colW + 0.5, rowH)
      }
    }

    // Legend
    ctx.font = '11px sans-serif'
    ctx.fillStyle = 'rgba(234, 236, 239, 0.95)'
    ctx.fillText(
      `DeepDom · ${snaps.length} samples · ±${(config.bandPct * 100).toFixed(2)}% · ${config.windowMinutes}m`,
      8,
      18
    )
    ctx.fillStyle = 'rgba(132, 142, 156, 0.9)'
    ctx.fillText(L2_GRANULARITY_NOTES[exchange] || statusRef.current, 8, 34)

    // Color ramp
    const rampX = w - 120
    const rampY = 10
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = sizeToColor(i / 39, 0.85)
      ctx.fillRect(rampX + i * 2, rampY, 2, 8)
    }
    ctx.fillStyle = 'rgba(132, 142, 156, 0.9)'
    ctx.font = '9px sans-serif'
    ctx.fillText('size', rampX - 22, rampY + 8)
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
