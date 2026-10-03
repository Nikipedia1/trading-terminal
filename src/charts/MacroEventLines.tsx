/**
 * Vertical markers for high-impact macro events.
 * X only via CoordinateBridge.timeToCoordinate – no stored pixels.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import { useCalendarStore } from '@/stores/calendarStore'

interface MacroEventLinesProps {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
}

const LINE = 'rgba(246, 70, 93, 0.85)'
const LABEL_BG = 'rgba(246, 70, 93, 0.92)'

export function MacroEventLines({
  enabled,
  bridge,
  containerRef,
}: MacroEventLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const events = useCalendarStore((s) => s.events)
  const show = useCalendarStore((s) => s.showHighImpactLines)

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const parent = containerRef.current
    if (!canvas || !parent || !bridge || !enabled || !show) return

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

    const markers = useCalendarStore.getState().highImpactTimes()
    if (markers.length === 0) return

    ctx.font = '9px JetBrains Mono, monospace'

    for (const m of markers) {
      const x = bridge.timeToCoordinate(m.timeSec)
      if (x === null || x < -4 || x > w + 4) continue

      ctx.beginPath()
      ctx.strokeStyle = LINE
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.moveTo(x + 0.5, 0)
      ctx.lineTo(x + 0.5, h)
      ctx.stroke()
      ctx.setLineDash([])

      const label = m.label
      const tw = ctx.measureText(label).width
      const lx = Math.min(Math.max(2, x - tw / 2), w - tw - 4)
      ctx.fillStyle = LABEL_BG
      ctx.fillRect(lx - 2, 2, tw + 4, 12)
      ctx.fillStyle = '#0b0e11'
      ctx.fillText(label, lx, 11)
    }
  }, [bridge, containerRef, enabled, show, events])

  useEffect(() => {
    if (!enabled || !show) {
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
  }, [enabled, show, bridge, paint, containerRef])

  if (!enabled || !show) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[5] pointer-events-none"
      aria-hidden
    />
  )
}
