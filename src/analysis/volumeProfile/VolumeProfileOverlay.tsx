/**
 * Volume Profile – developing + optional fixed overlay.
 * POC / VAH / VAL / LVN: full-width horizontal lines (anti-pellicola via priceToCoordinate).
 * Labels monospace.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { ExchangeId } from '@/types'
import { retainTradeBuffer, queryTradesInRange } from '@/analysis/deepPrint/tradeBuffer'
import { buildVolumeProfile, resolveWindowRange } from './compute'
import type {
  ProfileConfig,
  ProfileWindow,
  VolumeProfileModel,
} from './types'
import {
  DEFAULT_PROFILE_CONFIG,
  PROFILE_WINDOW_LABELS,
  SESSION_NOTE,
} from './types'

interface VolumeProfileOverlayProps {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  exchange: ExchangeId
  symbol: string
  windowMode?: ProfileWindow
  config?: ProfileConfig
}

const BAR_MAX_DEV = 100
const BAR_MAX_FIXED = 70
const RIGHT_PAD = 6
const MONO = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace'
const MONO_SM = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace'

export function VolumeProfileOverlay({
  enabled,
  bridge,
  containerRef,
  exchange,
  symbol,
  windowMode,
  config = DEFAULT_PROFILE_CONFIG,
}: VolumeProfileOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const developingRef = useRef<VolumeProfileModel | null>(null)
  const fixedRef = useRef<VolumeProfileModel | null>(null)
  const [hint, setHint] = useState('')

  const developingWindow = config.developing || windowMode || 'visible'
  const vaTarget = config.vaTarget ?? 0.7

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
    return {
      from: typeof range.from === 'number' ? range.from : null,
      to: typeof range.to === 'number' ? range.to : null,
    }
  }, [bridge])

  const rebuild = useCallback(() => {
    if (!enabled) {
      developingRef.current = null
      fixedRef.current = null
      return
    }
    const { from, to } = getVisibleRange()

    const devRange = resolveWindowRange(developingWindow, from, to)
    const devTrades = queryTradesInRange(
      exchange,
      symbol,
      devRange.fromSec,
      devRange.toSec
    )
    developingRef.current = buildVolumeProfile(
      devTrades,
      developingWindow,
      devRange.fromSec,
      devRange.toSec,
      vaTarget
    )

    if (config.fixed && config.fixed !== 'none') {
      const fixRange = resolveWindowRange(config.fixed, from, to)
      const fixTrades = queryTradesInRange(
        exchange,
        symbol,
        fixRange.fromSec,
        fixRange.toSec
      )
      fixedRef.current = buildVolumeProfile(
        fixTrades,
        config.fixed,
        fixRange.fromSec,
        fixRange.toSec,
        vaTarget
      )
    } else {
      fixedRef.current = null
    }

    const d = developingRef.current
    setHint(
      !d || d.tradeCount === 0
        ? `Profile: 0 trades (${PROFILE_WINDOW_LABELS[developingWindow]})`
        : `Dev ${d.tradeCount} · POC ${d.poc}`
    )
  }, [
    enabled,
    exchange,
    symbol,
    developingWindow,
    vaTarget,
    config.fixed,
    getVisibleRange,
  ])

  const paintProfileBars = (
    ctx: CanvasRenderingContext2D,
    bridge: CoordinateBridge,
    model: VolumeProfileModel,
    w: number,
    h: number,
    maxBarW: number,
    palette: {
      poc: string
      va: string
      outer: string
      lvn: string
      hvn: string
    }
  ) => {
    const maxVol = Math.max(...model.buckets.map((b) => b.volume), 0.0001)
    for (const b of model.buckets) {
      const y = bridge.priceToCoordinate(b.price)
      if (y === null || y < 0 || y > h) continue
      const barW = (b.volume / maxVol) * maxBarW
      const inVA = b.price >= model.val && b.price <= model.vah
      const isPoc = b.price === model.poc

      if (b.isLvn) ctx.fillStyle = palette.lvn
      else if (b.isHvn) ctx.fillStyle = palette.hvn
      else if (isPoc) ctx.fillStyle = palette.poc
      else if (inVA) ctx.fillStyle = palette.va
      else ctx.fillStyle = palette.outer

      const x = w - RIGHT_PAD - barW
      const yTop = bridge.priceToCoordinate(b.price + model.tickSize / 2)
      const yBot = bridge.priceToCoordinate(b.price - model.tickSize / 2)
      let bh = 3
      if (yTop != null && yBot != null) bh = Math.max(1.5, Math.abs(yBot - yTop))
      ctx.fillRect(x, y - bh / 2, barW, bh)
    }
  }

  /**
   * Full-width levels: POC / VAH / VAL / LVN span almost entire chart width.
   * Y from priceToCoordinate (anti-pellicola).
   */
  const paintLevelsFullWidth = (
    ctx: CanvasRenderingContext2D,
    bridge: CoordinateBridge,
    model: VolumeProfileModel,
    w: number,
    colors: { vah: string; val: string; poc: string },
    labelPrefix = ''
  ) => {
    const xLeft = 8
    const xRight = Math.max(xLeft + 40, w - BAR_MAX_DEV - 12)

    const draw = (price: number, color: string, label: string, lw = 1.25) => {
      const y = bridge.priceToCoordinate(price)
      if (y === null) return
      ctx.strokeStyle = color
      ctx.lineWidth = lw
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(xLeft, y)
      ctx.lineTo(xRight, y)
      ctx.stroke()
      ctx.setLineDash([])

      const text = `${labelPrefix}${label} ${price}`
      ctx.font = MONO
      const tw = ctx.measureText(text).width
      const lx = Math.max(xLeft + 2, Math.min(xRight - tw - 6, xRight - tw - 8))
      ctx.fillStyle = 'rgba(11, 14, 17, 0.85)'
      ctx.fillRect(lx - 3, y - 9, tw + 6, 15)
      ctx.fillStyle = color
      ctx.textAlign = 'left'
      ctx.fillText(text, lx, y + 3)
    }

    draw(model.vah, colors.vah, 'VAH')
    draw(model.val, colors.val, 'VAL')
    draw(model.poc, colors.poc, 'POC', 1.6)

    for (const p of model.lvns) {
      const y = bridge.priceToCoordinate(p)
      if (y === null) continue
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(xLeft, y)
      ctx.lineTo(xRight, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(168, 85, 247, 0.95)'
      ctx.font = MONO_SM
      ctx.textAlign = 'left'
      ctx.fillText(`LVN ${p}`, xLeft + 2, y - 3)
    }
    for (const p of model.hvns) {
      const y = bridge.priceToCoordinate(p)
      if (y === null) continue
      ctx.strokeStyle = 'rgba(240, 185, 11, 0.4)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(xLeft, y)
      ctx.lineTo(xRight, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(240, 185, 11, 0.9)'
      ctx.font = MONO_SM
      ctx.textAlign = 'left'
      ctx.fillText(`HVN ${p}`, xLeft + 2, y - 3)
    }
  }

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

    const fixed = fixedRef.current
    const dev = developingRef.current

    if (fixed && fixed.buckets.length > 0 && fixed.totalVolume > 0) {
      paintProfileBars(ctx, bridge, fixed, w - 8, h, BAR_MAX_FIXED, {
        poc: 'rgba(96, 165, 250, 0.55)',
        va: 'rgba(59, 130, 246, 0.28)',
        outer: 'rgba(59, 130, 246, 0.12)',
        lvn: 'rgba(168, 85, 247, 0.25)',
        hvn: 'rgba(96, 165, 250, 0.4)',
      })
      paintLevelsFullWidth(
        ctx,
        bridge,
        fixed,
        w,
        {
          vah: 'rgba(96, 165, 250, 0.85)',
          val: 'rgba(96, 165, 250, 0.85)',
          poc: 'rgba(147, 197, 253, 1)',
        },
        'F '
      )
    }

    if (dev && dev.buckets.length > 0 && dev.totalVolume > 0) {
      paintProfileBars(ctx, bridge, dev, w, h, BAR_MAX_DEV, {
        poc: 'rgba(240, 185, 11, 0.6)',
        va: 'rgba(14, 203, 129, 0.32)',
        outer: 'rgba(132, 142, 156, 0.16)',
        lvn: 'rgba(168, 85, 247, 0.28)',
        hvn: 'rgba(240, 185, 11, 0.35)',
      })
      paintLevelsFullWidth(ctx, bridge, dev, w, {
        vah: 'rgba(14, 203, 129, 0.95)',
        val: 'rgba(14, 203, 129, 0.95)',
        poc: 'rgba(240, 185, 11, 1)',
      })
    } else {
      ctx.fillStyle = 'rgba(132, 142, 156, 0.75)'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(hint || 'Profile: no trades in window', w - 12, 20)
    }

    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(234, 236, 239, 0.85)'
    const vaPct = Math.round(vaTarget * 100)
    let legend = `Dev · VA ${vaPct}%`
    if (fixed && fixed.tradeCount > 0) legend += ` · Fixed(${PROFILE_WINDOW_LABELS[fixed.window]})`
    ctx.fillText(legend, w - 10, 16)
    ctx.fillStyle = 'rgba(132, 142, 156, 0.75)'
    ctx.font = '9px sans-serif'
    ctx.fillText(SESSION_NOTE, w - 10, 30)
  }, [bridge, containerRef, enabled, hint, vaTarget])

  useEffect(() => {
    if (!enabled) {
      developingRef.current = null
      fixedRef.current = null
      const canvas = canvasRef.current
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    rebuild()
    paint()

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
    }, 1000)

    return () => {
      unsub?.()
      ro?.disconnect()
      window.clearInterval(id)
    }
  }, [enabled, bridge, exchange, symbol, rebuild, paint, containerRef])

  if (!enabled) return null

  return (
    <canvas ref={canvasRef} className="absolute inset-0 z-[4] pointer-events-none" aria-hidden />
  )
}
