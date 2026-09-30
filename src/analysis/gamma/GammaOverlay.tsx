/**
 * Gamma levels overlay – horizontal lines at Deribit OI walls / flip / max pain.
 * Anti-pellicola: Y from priceToCoordinate; redraw on visible-range / resize.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { ExchangeId } from '@/types'
import { fetchDeribitOptionBook } from './deribit'
import { buildGammaModel } from './compute'
import {
  DEFAULT_GAMMA_CONFIG,
  symbolToDeribitCurrency,
  type GammaConfig,
  type GammaModel,
} from './types'

const COLORS: Record<string, string> = {
  call_wall: '#0ecb81',
  put_wall: '#a855f7',
  flip: '#f0b90b',
  max_pain: '#60a5fa',
  hvl: '#f59e0b',
}

export function GammaOverlay({
  enabled,
  bridge,
  containerRef,
  symbol,
  config = DEFAULT_GAMMA_CONFIG,
}: {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  exchange: ExchangeId
  symbol: string
  config?: GammaConfig
}) {
  const [model, setModel] = useState<GammaModel | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modelRef = useRef<GammaModel | null>(null)
  modelRef.current = model

  const currency = symbolToDeribitCurrency(symbol)

  useEffect(() => {
    if (!enabled || !currency) {
      setModel(null)
      setErr(null)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const rows = await fetchDeribitOptionBook(currency)
        if (cancelled) return
        const m = buildGammaModel(currency, rows, config)
        setModel(m)
        setErr(m ? null : 'Nessun livello OI disponibile')
      } catch (e: any) {
        if (cancelled) return
        setErr(e?.message || 'Deribit fetch failed')
        setModel(null)
      }
    }
    void load()
    const id = window.setInterval(load, Math.max(15, config.pollSec) * 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [enabled, currency, config.walls, config.flip, config.maxPain, config.pollSec])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const parent = containerRef.current
    const m = modelRef.current
    if (!canvas || !parent || !bridge || !m) return
    const w = parent.clientWidth
    const h = parent.clientHeight
    if (w <= 0 || h <= 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    for (const lv of m.levels) {
      const y = bridge.priceToCoordinate(lv.price)
      if (y == null || y < 0 || y > h) continue
      const color = COLORS[lv.kind] ?? '#848e9c'
      ctx.strokeStyle = color
      ctx.lineWidth = lv.kind === 'flip' ? 1.5 : 1
      ctx.setLineDash(
        lv.kind === 'max_pain' ? [6, 4] : lv.kind === 'flip' ? [4, 3] : []
      )
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w - 8, y)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.font = 'bold 10px ui-monospace, monospace'
      const text = lv.label
      const tw = ctx.measureText(text).width
      const bx = w - tw - 16
      const by = y - 8
      ctx.globalAlpha = 0.92
      ctx.fillStyle = '#0b0e11'
      ctx.fillRect(bx - 4, by - 2, tw + 10, 14)
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.strokeRect(bx - 4, by - 2, tw + 10, 14)
      ctx.fillStyle = color
      ctx.fillText(text, bx, by + 9)
    }
    ctx.globalAlpha = 1
  }, [bridge, containerRef])

  useEffect(() => {
    draw()
  }, [draw, model, tick])

  useEffect(() => {
    if (!enabled || !bridge) return
    const unsub = bridge.onVisibleRangeChange(() => setTick((t) => t + 1))
    const el = containerRef.current
    let ro: ResizeObserver | null = null
    if (el) {
      ro = new ResizeObserver(() => setTick((t) => t + 1))
      ro.observe(el)
    }
    return () => {
      unsub()
      ro?.disconnect()
    }
  }, [enabled, bridge, containerRef])

  if (!enabled) return null

  if (!currency) {
    return (
      <div className="absolute top-2 left-2 z-20 pointer-events-none">
        <div className="px-2 py-1 rounded bg-[#0b0e11]/90 border border-[#f0b90b]/40 text-[10px] text-[#f0b90b]">
          Gamma: disponibile su BTC/ETH (Deribit public OI) — simbolo corrente non
          mappato
        </div>
      </div>
    )
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[12] pointer-events-none"
        aria-hidden
      />
      <div className="absolute bottom-8 left-2 z-20 pointer-events-none max-w-xs">
        <div className="px-2 py-1 rounded bg-[#0b0e11]/90 border border-[#2b3139] text-[10px] text-[#848e9c]">
          {err ? (
            <span className="text-[#f6465d]">Gamma: {err}</span>
          ) : model ? (
            <span>
              Gamma {model.currency} · spot {model.spot.toFixed(0)} ·{' '}
              {model.levels.length} lv · live Deribit
              <span className="block text-[9px] text-[#5e6673] mt-0.5">
                {model.note}
              </span>
            </span>
          ) : (
            <span>Gamma: loading Deribit…</span>
          )}
        </div>
      </div>
    </>
  )
}
