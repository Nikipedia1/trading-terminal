/**
 * Paper position / TP / SL lines on the price chart.
 * Anti-pellicola: Y only via CoordinateBridge.priceToCoordinate – never store pixels.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import { usePaperStore } from './paperStore'

interface PaperPositionLinesProps {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  symbol: string
}

const ENTRY_LONG = 'rgba(14, 203, 129, 0.95)'
const ENTRY_SHORT = 'rgba(246, 70, 93, 0.95)'
const TP = 'rgba(240, 185, 11, 0.9)'
const SL = 'rgba(168, 85, 247, 0.9)'

export function PaperPositionLines({
  enabled,
  bridge,
  containerRef,
  symbol,
}: PaperPositionLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const positions = usePaperStore((s) => s.positions)

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

    const sym = symbol.toUpperCase()
    const list = positions.filter((p) => p.symbol === sym)
    if (list.length === 0) return

    const drawLine = (price: number, color: string, label: string, dashed = false) => {
      const y = bridge.priceToCoordinate(price)
      if (y === null || y < -2 || y > h + 2) return
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      if (dashed) ctx.setLineDash([6, 4])
      else ctx.setLineDash([])
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(w - 56, y + 0.5)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.font = '10px JetBrains Mono, monospace'
      ctx.fillStyle = color
      const text = `${label} ${price < 1 ? price.toPrecision(6) : price.toFixed(2)}`
      const tw = ctx.measureText(text).width
      ctx.fillRect(w - tw - 10, y - 7, tw + 8, 14)
      ctx.fillStyle = '#0b0e11'
      ctx.fillText(text, w - tw - 6, y + 3)
    }

    for (const p of list) {
      const entryColor = p.side === 'long' ? ENTRY_LONG : ENTRY_SHORT
      const tag = p.side === 'long' ? 'L' : 'S'
      drawLine(p.entryPrice, entryColor, `${tag}·${p.leverage}x`, false)
      if (p.takeProfit != null && p.takeProfit > 0) {
        drawLine(p.takeProfit, TP, 'TP', true)
      }
      if (p.stopLoss != null && p.stopLoss > 0) {
        drawLine(p.stopLoss, SL, 'SL', true)
      }
    }
  }, [bridge, containerRef, enabled, positions, symbol])

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
    // price scale can move without time-range event – light poll
    const id = window.setInterval(() => paint(), 400)
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
      className="absolute inset-0 z-[6] pointer-events-none"
      aria-hidden
    />
  )
}
