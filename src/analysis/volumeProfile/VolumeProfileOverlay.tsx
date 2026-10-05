/**
 * Volume Profile – developing + optional fixed overlay (STATIC layer L1).
 * Bars: split buy (green) / sell (purple). Rebuild on range change / 1s, not every tick.
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
import { LAYER_Z } from '@/charts/layerStack'

interface VolumeProfileOverlayProps {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  exchange: ExchangeId
  symbol: string
  windowMode?: ProfileWindow
  config?: ProfileConfig
}

const BAR_MAX_DEV = 160
const BAR_MAX_FIXED = 100
const RIGHT_PAD = 8
const BAR_MIN_H = 2.5
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

  const developingWindow = (config as { developing?: ProfileWindow }).developing || windowMode || 'visible'
  const vaTarget = (config as { vaTarget?: number }).vaTarget ?? 0.7

  useEffect(() => {
    if (!enabled || !exchange || !symbol) return
    return retainTradeBuffer(exchange, symbol)
  }, [enabled, exchange, symbol])

  const getVisibleRange = useCallback((): { from: number | null; to: number | null } => {
    if (!bridge) return { from: null, to: null }
    const chart = bridge.getChart?.() ?? (bridge as { getChart?: () => { timeScale: () => { getVisibleRange: () => { from: number; to: number } | null } } | null }).getChart?.()
    if (!chart) return { from: null, to: null }
    try {
      const range = chart.timeScale().getVisibleRange()
      if (!range) return { from: null, to: null }
      return {
        from: typeof range.from === 'number' ? range.from : null,
        to: typeof range.to === 'number' ? range.to : null,
      }
    } catch {
      return { from: null, to: null }
    }
  }, [bridge])

  const rebuild = useCallback(() => {
    if (!enabled || !exchange || !symbol) {
      developingRef.current = null
      fixedRef.current = null
      return
    }
    const { from, to } = getVisibleRange()
    const devRange = resolveWindowRange(developingWindow as any, from, to)
    const devTrades = queryTradesInRange(exchange, symbol, devRange.fromSec, devRange.toSec)
    developingRef.current = buildVolumeProfile(
      devTrades,
      developingWindow as any,
      devRange.fromSec,
      devRange.toSec,
      vaTarget
    )

    const fixedWin = (config as { fixed?: ProfileWindow | null }).fixed
    if (fixedWin && fixedWin !== ('none' as any)) {
      const fixRange = resolveWindowRange(fixedWin as any, from, to)
      const fixTrades = queryTradesInRange(exchange, symbol, fixRange.fromSec, fixRange.toSec)
      fixedRef.current = buildVolumeProfile(
        fixTrades,
        fixedWin as any,
        fixRange.fromSec,
        fixRange.toSec,
        vaTarget
      )
    } else {
      fixedRef.current = null
    }

    const dev = developingRef.current
    if (dev) {
      setHint(
        `${PROFILE_WINDOW_LABELS[developingWindow as keyof typeof PROFILE_WINDOW_LABELS] || developingWindow} · ${dev.buckets?.length ?? 0} bins · POC ${dev.poc}`
      )
    }
  }, [enabled, exchange, symbol, developingWindow, vaTarget, config, getVisibleRange])

  useEffect(() => {
    if (!enabled) return
    rebuild()
    const id = window.setInterval(rebuild, 1000)
    return () => window.clearInterval(id)
  }, [enabled, rebuild])

  const paintProfileBars = (
    ctx: CanvasRenderingContext2D,
    br: CoordinateBridge,
    model: VolumeProfileModel,
    w: number,
    h: number,
    maxBarW: number,
    muted: boolean
  ) => {
    if (!model?.buckets?.length) return
    const maxVol = Math.max(...model.buckets.map((b) => b.volume), 0.0001)
    const capW = Math.max(48, Math.min(maxBarW, w * 0.22))
    for (const b of model.buckets) {
      const y = br.priceToCoordinate(b.price)
      if (y === null || y < -2 || y > h + 2) continue

      const yTop = br.priceToCoordinate(b.price + model.tickSize / 2)
      const yBot = br.priceToCoordinate(b.price - model.tickSize / 2)
      let bh = BAR_MIN_H
      if (yTop != null && yBot != null) {
        bh = Math.max(BAR_MIN_H, Math.abs(yBot - yTop) * 0.92)
      }
      bh = Math.min(bh, 14)

      const totalW = (b.volume / maxVol) * capW
      const buyShare = b.volume > 0 ? b.buyVolume / b.volume : 0.5
      const sellShare = 1 - buyShare
      const sellW = totalW * sellShare
      const buyW = totalW * buyShare
      const xRight = w - RIGHT_PAD
      const sellAlpha = muted ? 0.35 : b.isLvn ? 0.55 : 0.7
      const buyAlpha = muted ? 0.35 : b.isHvn || b.price === model.poc ? 0.85 : 0.65

      if (sellW > 0.5) {
        ctx.fillStyle = `rgba(168, 85, 247, ${sellAlpha})`
        ctx.fillRect(xRight - sellW, y - bh / 2, sellW, bh)
      }
      if (buyW > 0.5) {
        ctx.fillStyle = `rgba(14, 203, 129, ${buyAlpha})`
        ctx.fillRect(xRight - sellW - buyW, y - bh / 2, buyW, bh)
      }
      if (b.price === model.poc && !muted) {
        ctx.strokeStyle = 'rgba(240, 185, 11, 0.9)'
        ctx.lineWidth = 1
        ctx.strokeRect(xRight - totalW - 0.5, y - bh / 2 - 0.5, totalW + 1, bh + 1)
      }
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
    if (fixed && fixed.buckets?.length > 0 && fixed.totalVolume > 0) {
      paintProfileBars(ctx, bridge, fixed, w, h, BAR_MAX_FIXED, true)
    }
    if (dev && dev.buckets?.length > 0 && dev.totalVolume > 0) {
      paintProfileBars(ctx, bridge, dev, w, h, BAR_MAX_DEV, false)
      const drawLevel = (price: number, color: string, label: string) => {
        const y = bridge.priceToCoordinate(price)
        if (y == null) return
        ctx.strokeStyle = color
        ctx.lineWidth = 1.25
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(8, y)
        ctx.lineTo(Math.max(48, w - BAR_MAX_DEV - 12), y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = color
        ctx.font = MONO_SM
        ctx.textAlign = 'left'
        ctx.fillText(label, 10, y - 3)
      }
      if (dev.poc != null) drawLevel(dev.poc, 'rgba(240,185,11,0.95)', `POC ${dev.poc}`)
      if (dev.vah != null) drawLevel(dev.vah, 'rgba(14,203,129,0.85)', `VAH ${dev.vah}`)
      if (dev.val != null) drawLevel(dev.val, 'rgba(246,70,93,0.85)', `VAL ${dev.val}`)
    }
    if (hint) {
      ctx.font = '10px sans-serif'
      ctx.fillStyle = 'rgba(132,142,156,0.9)'
      ctx.textAlign = 'right'
      ctx.fillText(hint, w - 10, 16)
    }
  }, [bridge, enabled, containerRef, hint])

  useEffect(() => {
    paint()
    const id = window.setInterval(paint, 250)
    return () => window.clearInterval(id)
  }, [paint])

  if (!enabled) return null
  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 ${LAYER_Z.profile} pointer-events-none`}
    />
  )
}
