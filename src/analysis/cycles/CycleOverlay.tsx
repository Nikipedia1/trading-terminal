/**
 * Cycle overlay – bandpass wave + phase marks on real candles.
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
      ctx.fillStyle = 'rgba(132, 142, 156, 0.8)'
      ctx.font = MONO
      ctx.textAlign = 'left'
      ctx.fillText('Cycles: need more bars', 10, 18)
      return
    }

    // Wave
    if (config.showWave && model.wave.length > 1) {
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.85)'
      ctx.lineWidth = 1.4
      let started = false
      for (const p of model.wave) {
        const x = bridge.timeToCoordinate(p.time)
        const y = bridge.priceToCoordinate(p.value)
        if (x == null || y == null) continue
        if (!started) {
          ctx.moveTo(x, y)
          started = true
        } else ctx.lineTo(x, y)
      }
      if (started) ctx.stroke()
    }

    // Phase marks
    if (config.showPhaseMarks) {
      for (const t of model.cycleHighTimes) {
        const x = bridge.timeToCoordinate(t)
        if (x == null) continue
        ctx.strokeStyle = 'rgba(14, 203, 129, 0.45)'
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
        ctx.strokeStyle = 'rgba(246, 70, 93, 0.45)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // HUD
    const stcLast = model.stc.length ? model.stc[model.stc.length - 1].value : null
    ctx.font = MONO
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(11, 14, 17, 0.75)'
    ctx.fillRect(6, 6, 220, 40)
    ctx.fillStyle = '#60a5fa'
    ctx.fillText(
      `Cycle P=${model.period} (${model.periodSource}) · str ${(model.strength * 100).toFixed(0)}%`,
      12,
      22
    )
    ctx.fillStyle = '#eaecef'
    ctx.fillText(
      `Phase ${model.phaseDeg.toFixed(0)}°` +
        (stcLast != null ? ` · STC ${stcLast.toFixed(1)}` : ''),
      12,
      38
    )
  }, [bridge, containerRef, enabled, config.showWave, config.showPhaseMarks])

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
