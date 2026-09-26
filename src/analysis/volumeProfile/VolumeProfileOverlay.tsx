/**
 * Volume Profile canvas overlay – horizontal histogram by price.
 * Anti-pellicola: every bar Y from priceToCoordinate; redraw on
 * visible-range-change, resize, and new trades.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { ExchangeId } from '@/types'
import { retainTradeBuffer, queryTradesInRange } from '@/analysis/deepPrint/tradeBuffer'
import { buildVolumeProfile, resolveWindowRange } from './compute'
import type { ProfileWindow, VolumeProfileModel } from './types'
import { PROFILE_WINDOW_LABELS } from './types'

interface VolumeProfileOverlayProps {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  exchange: ExchangeId
  symbol: string
  windowMode: ProfileWindow
}

const BAR_MAX_WIDTH = 120
const PROFILE_RIGHT_PAD = 8

export function VolumeProfileOverlay({
  enabled,
  bridge,
  containerRef,
  exchange,
  symbol,
  windowMode,
}: VolumeProfileOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modelRef = useRef<VolumeProfileModel | null>(null)
  const [hint, setHint] = useState('')

  useEffect(() => {
    if (!enabled) return
    return retainTradeBuffer(exchange, symbol)
  }, [enabled, exchange, symbol])

  const getVisibleRange = useCallback((): { from: number | null; to: number | null } => {
    if (!bridge) return { from: null, to: null }
    const chart = bridge.getChart()
    if (!chart) return { from: null, to: null }
    const range = chart.timeScale().getVisibleRange()
    if (!range) return { from: null, to: null }
    const from = typeof range.from === 'number' ? range.from : null
    const to = typeof range.to === 'number' ? range.to : null
    return { from, to }
  }, [bridge])

  const rebuildModel = useCallback(() => {
    if (!enabled) {
      modelRef.current = null
      return
    }
    const { from, to } = getVisibleRange()
    const { fromSec, toSec } = resolveWindowRange(windowMode, from, to)
    const trades = queryTradesInRange(exchange, symbol, fromSec, toSec)
    modelRef.current = buildVolumeProfile(trades, windowMode, fromSec, toSec)
    setHint(
      trades.length === 0
        ? `Profile: 0 trades (${PROFILE_WINDOW_LABELS[windowMode]})`
        : `Profile: ${trades.length} trades · POC ${modelRef.current?.poc}`
    )
  }, [enabled, exchange, symbol, windowMode, getVisibleRange])

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

    const model = modelRef.current
    if (!model || model.buckets.length === 0 || model.totalVolume <= 0) {
      // subtle empty label
      ctx.fillStyle = 'rgba(132, 142, 156, 0.7)'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(hint || 'Profile: no trades in window', w - 12, 20)
      return
    }

    const maxVol = Math.max(...model.buckets.map((b) => b.volume), 0.0001)

    // Bars grow from the right edge leftward
    for (const b of model.buckets) {
      const y = bridge.priceToCoordinate(b.price)
      if (y === null || y < 0 || y > h) continue

      const barW = (b.volume / maxVol) * BAR_MAX_WIDTH
      const inVA = b.price >= model.val && b.price <= model.vah
      const isPoc = b.price === model.poc

      ctx.fillStyle = isPoc
        ? 'rgba(240, 185, 11, 0.55)'
        : inVA
          ? 'rgba(14, 203, 129, 0.28)'
          : 'rgba(132, 142, 156, 0.18)'

      const x = w - PROFILE_RIGHT_PAD - barW
      // approximate bucket height from neighbor spacing
      const yTop = bridge.priceToCoordinate(b.price + model.tickSize / 2)
      const yBot = bridge.priceToCoordinate(b.price - model.tickSize / 2)
      let bh = 3
      if (yTop != null && yBot != null) {
        bh = Math.max(1, Math.abs(yBot - yTop))
      }
      ctx.fillRect(x, y - bh / 2, barW, bh)
    }

    // POC / VAH / VAL lines
    const drawLevel = (price: number, color: string, label: string) => {
      const y = bridge.priceToCoordinate(price)
      if (y === null) return
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(w - BAR_MAX_WIDTH - 24, y)
      ctx.lineTo(w - 4, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = color
      ctx.font = '10px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`${label} ${price}`, w - BAR_MAX_WIDTH - 28, y + 3)
    }

    drawLevel(model.poc, 'rgba(240, 185, 11, 0.95)', 'POC')
    drawLevel(model.vah, 'rgba(14, 203, 129, 0.9)', 'VAH')
    drawLevel(model.val, 'rgba(14, 203, 129, 0.9)', 'VAL')
  }, [bridge, containerRef, enabled, hint])

  // Rebuild + paint pipeline
  useEffect(() => {
    if (!enabled) {
      modelRef.current = null
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx?.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    rebuildModel()
    paint()

    const unsub = bridge?.onVisibleRangeChange(() => {
      rebuildModel()
      paint()
    })

    const parent = containerRef.current
    let ro: ResizeObserver | null = null
    if (parent) {
      ro = new ResizeObserver(() => {
        paint()
      })
      ro.observe(parent)
    }

    // New trades
    const id = window.setInterval(() => {
      rebuildModel()
      paint()
    }, 1000)

    return () => {
      unsub?.()
      ro?.disconnect()
      window.clearInterval(id)
    }
  }, [enabled, bridge, exchange, symbol, windowMode, rebuildModel, paint, containerRef])

  if (!enabled) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[4] pointer-events-none"
      aria-hidden
    />
  )
}
