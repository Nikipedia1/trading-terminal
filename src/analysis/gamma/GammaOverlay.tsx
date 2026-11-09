/**
 * Gamma Classic overlay – horizontal walls + left/right GEX profile bars.
 * Style inspired by retail GEX terminals (walls, dominants, profile).
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

const LEVEL_COLORS: Record<string, string> = {
  call_wall: '#00e5a0',
  put_wall: '#c084fc',
  flip: '#f0b90b',
  max_pain: '#60a5fa',
  hvl: '#f59e0b',
  dominant_pos: '#2dd4bf',
  dominant_neg: '#f472b6',
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
  }, [
    enabled,
    currency,
    config.walls,
    config.flip,
    config.maxPain,
    config.profile,
    config.zones,
    config.pollSec,
  ])

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

    const profile = m.profile ?? []
    const maxAbs = Math.max(
      1,
      ...profile.map((p) => Math.max(Math.abs(p.gex), p.callOi, p.putOi))
    )
    const barMax = Math.min(72, w * 0.12)

    if (config.profile && profile.length) {
      for (const row of profile) {
        const y = bridge.priceToCoordinate(row.strike)
        if (y == null || y < -20 || y > h + 20) continue
        const mag = Math.abs(row.gex) / maxAbs
        const bw = Math.max(2, mag * barMax)
        ctx.globalAlpha = 0.55 + mag * 0.35
        ctx.fillStyle = row.gex >= 0 ? '#14b8a6' : '#e11d48'
        ctx.fillRect(0, y - 2, bw, 4)
      }
      ctx.globalAlpha = 1

      for (const row of profile) {
        const y = bridge.priceToCoordinate(row.strike)
        if (y == null || y < -20 || y > h + 20) continue
        const cW = (row.callOi / maxAbs) * barMax
        const pW = (row.putOi / maxAbs) * barMax
        if (cW > 1) {
          ctx.globalAlpha = 0.5
          ctx.fillStyle = '#2dd4bf'
          ctx.fillRect(w - cW, y - 3, cW, 3)
        }
        if (pW > 1) {
          ctx.globalAlpha = 0.5
          ctx.fillStyle = '#c084fc'
          ctx.fillRect(w - pW, y + 1, pW, 3)
        }
      }
      ctx.globalAlpha = 1
    }

    for (const lv of m.levels) {
      const y = bridge.priceToCoordinate(lv.price)
      if (y == null || y < 0 || y > h) continue
      const color = LEVEL_COLORS[lv.kind] ?? '#848e9c'
      const thick =
        lv.kind === 'call_wall' || lv.kind === 'put_wall'
          ? 2.5
          : lv.kind === 'flip'
            ? 1.5
            : 1

      if (config.zones && (lv.kind === 'call_wall' || lv.kind === 'put_wall')) {
        ctx.fillStyle = color
        ctx.globalAlpha = 0.12
        ctx.fillRect(0, y - 6, w, 12)
        ctx.globalAlpha = 1
      }

      ctx.strokeStyle = color
      ctx.lineWidth = thick
      ctx.setLineDash(lv.kind === 'flip' ? [6, 4] : [])
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
      ctx.setLineDash([])

      const text = lv.label
      ctx.font = 'bold 10px ui-monospace, monospace'
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
      ctx.globalAlpha = 1
    }

    const sy = bridge.priceToCoordinate(m.spot)
    if (sy != null && sy >= 0 && sy <= h) {
      ctx.strokeStyle = '#eaecef'
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.35
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(0, sy)
      ctx.lineTo(w, sy)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }
  }, [bridge, containerRef, config.profile, config.zones, tick])

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
          Gamma Classic: BTC/ETH only (Deribit public OI)
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
              GEX {model.currency} · spot {model.spot.toFixed(0)} · net{' '}
              <span className={model.netGex >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                {model.netGex >= 0 ? '+' : ''}
                {(model.netGex / 1000).toFixed(1)}k
              </span>
              {' · '}{model.levels.length} lv
              <span className="block text-[9px] text-[#5e6673] mt-0.5">{model.note}</span>
            </span>
          ) : (
            <span>Gamma: loading Deribit…</span>
          )}
        </div>
      </div>
    </>
  )
}
