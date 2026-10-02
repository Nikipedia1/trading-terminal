/**
 * Cycle overlay – professional bandpass wave, amplitude envelope,
 * phase marks, secondary cycle, projected turns. Real OHLCV only.
 * STATIC-ish layer: rebuild on candles / range, not every tick.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { Candle } from '@/types'
import { LAYER_Z } from '@/charts/layerStack'
import { computeCycleModel } from './compute'
import type { CycleConfig, CycleModel } from './types'
import { DEFAULT_CYCLE_CONFIG } from './types'

interface CycleOverlayProps {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  candles: Candle[]
  config?: CycleConfig
}

const MONO = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
const MONO_SM = '10px ui-monospace, SFMono-Regular, Menlo, monospace'

function strokePath(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  pts: { time: number; value: number }[],
  color: string,
  width: number,
  dash?: number[]
) {
  if (pts.length < 2) return
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  if (dash) ctx.setLineDash(dash)
  let started = false
  for (const p of pts) {
    const x = bridge.timeToCoordinate(p.time)
    const y = bridge.priceToCoordinate(p.value)
    if (x == null || y == null) continue
    if (!started) {
      ctx.moveTo(x, y)
      started = true
    } else ctx.lineTo(x, y)
  }
  if (started) ctx.stroke()
  if (dash) ctx.setLineDash([])
}

function fillEnvelope(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  upper: { time: number; value: number }[],
  lower: { time: number; value: number }[],
  fill: string
) {
  if (upper.length < 2 || lower.length < 2) return
  const coords: { x: number; yu: number; yl: number }[] = []
  const n = Math.min(upper.length, lower.length)
  for (let i = 0; i < n; i++) {
    const x = bridge.timeToCoordinate(upper[i].time)
    const yu = bridge.priceToCoordinate(upper[i].value)
    const yl = bridge.priceToCoordinate(lower[i].value)
    if (x == null || yu == null || yl == null) continue
    coords.push({ x, yu, yl })
  }
  if (coords.length < 2) return
  ctx.beginPath()
  ctx.moveTo(coords[0].x, coords[0].yu)
  for (let i = 1; i < coords.length; i++) ctx.lineTo(coords[i].x, coords[i].yu)
  for (let i = coords.length - 1; i >= 0; i--) ctx.lineTo(coords[i].x, coords[i].yl)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

export function CycleOverlay({
  enabled,
  bridge,
  containerRef,
  candles,
  config = DEFAULT_CYCLE_CONFIG,
}: CycleOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modelRef = useRef<CycleModel | null>(null)

  const rebuild = useCallback(() => {
    if (!enabled || candles.length < 30) {
      modelRef.current = null
      return
    }
    modelRef.current = computeCycleModel(candles, { ...config, enabled: true })
  }, [enabled, candles, config])

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
    if (!model?.ready) {
      ctx.fillStyle = 'rgba(132, 142, 156, 0.85)'
      ctx.font = MONO
      ctx.textAlign = 'left'
      ctx.fillText('Cycles: need more bars (≥30)', 10, 18)
      return
    }

    const op = Math.max(0.25, Math.min(1, config.waveOpacity ?? 0.85))

    if (config.showAmplitude && model.ampUpper.length > 1) {
      fillEnvelope(
        ctx,
        bridge,
        model.ampUpper,
        model.ampLower,
        `rgba(96, 165, 250, ${0.08 * op})`
      )
      strokePath(ctx, bridge, model.ampUpper, `rgba(96, 165, 250, ${0.25 * op})`, 0.8, [2, 3])
      strokePath(ctx, bridge, model.ampLower, `rgba(96, 165, 250, ${0.25 * op})`, 0.8, [2, 3])
    }

    if (config.showSecondary && model.wave2.length > 1) {
      strokePath(ctx, bridge, model.wave2, `rgba(167, 139, 250, ${0.45 * op})`, 1, [3, 3])
    }

    if (config.showWave && model.wave.length > 1) {
      strokePath(ctx, bridge, model.wave, `rgba(96, 165, 250, ${op})`, 1.5)
    }

    if (config.showPhaseMarks) {
      for (const t of model.cycleHighTimes) {
        const x = bridge.timeToCoordinate(t)
        if (x == null) continue
        ctx.strokeStyle = 'rgba(14, 203, 129, 0.4)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
        ctx.setLineDash([])
      }
      for (const t of model.cycleLowTimes) {
        const x = bridge.timeToCoordinate(t)
        if (x == null) continue
        ctx.strokeStyle = 'rgba(246, 70, 93, 0.4)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    if (config.showProjections) {
      const drawProj = (t: number | null, color: string, label: string) => {
        if (t == null) return
        const x = bridge.timeToCoordinate(t)
        if (x == null) return
        ctx.strokeStyle = color
        ctx.lineWidth = 1.2
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.font = MONO_SM
        ctx.fillStyle = color
        ctx.textAlign = 'center'
        ctx.fillText(label, x, 14)
      }
      drawProj(model.nextHighTime, 'rgba(14, 203, 129, 0.7)', '↑ H')
      drawProj(model.nextLowTime, 'rgba(246, 70, 93, 0.7)', '↓ L')
    }

    if (config.showHud) {
      const stcLast = model.stc.length ? model.stc[model.stc.length - 1].value : null
      const lines = [
        `P=${model.period}${model.secondaryPeriod ? `/${model.secondaryPeriod}` : ''} (${model.periodSource}) · str ${(model.strength * 100).toFixed(0)}%`,
        `Phase ${model.phaseDeg.toFixed(0)}° · Amp ${model.amplitude.toPrecision(4)}` +
          (stcLast != null ? ` · STC ${stcLast.toFixed(1)}` : ''),
      ]
      if (model.barsToNextTurn != null && model.nextTurnKind) {
        lines.push(
          `Next ${model.nextTurnKind} ~${model.barsToNextTurn.toFixed(1)} bars`
        )
      }
      const boxH = 12 + lines.length * 14
      ctx.fillStyle = 'rgba(11, 14, 17, 0.78)'
      ctx.fillRect(6, 6, 268, boxH)
      ctx.font = MONO
      ctx.textAlign = 'left'
      lines.forEach((line, i) => {
        ctx.fillStyle = i === 0 ? '#60a5fa' : '#eaecef'
        ctx.fillText(line, 12, 20 + i * 14)
      })
    }
  }, [
    bridge,
    containerRef,
    enabled,
    config.showWave,
    config.showPhaseMarks,
    config.showAmplitude,
    config.showProjections,
    config.showSecondary,
    config.showHud,
    config.waveOpacity,
  ])

  useEffect(() => {
    if (!enabled) {
      modelRef.current = null
      const c = canvasRef.current
      c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
      return
    }
    rebuild()
    paint()
    const unsub = bridge?.onVisibleRangeChange(() => paint())
    const parent = containerRef.current
    let ro: ResizeObserver | null = null
    if (parent) {
      ro = new ResizeObserver(() => paint())
      ro.observe(parent)
    }
    return () => {
      unsub?.()
      ro?.disconnect()
    }
  }, [enabled, bridge, rebuild, paint, containerRef, candles])

  if (!enabled) return null
  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 ${LAYER_Z.cycles} pointer-events-none`}
      aria-hidden
    />
  )
}
