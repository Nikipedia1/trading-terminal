/**
 * Cycles menu – professional controls, live readouts, presets, seasonality.
 * Dropdown via fixed portal so toolbar overflow does not clip it.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Candle } from '@/types'
import { computeCycleModel } from './compute'
import type { CycleConfig } from './types'
import { DEFAULT_CYCLE_CONFIG, CYCLE_PRESETS } from './types'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface CycleMenuProps {
  config: CycleConfig
  candles: Candle[]
  onChange: (patch: Partial<CycleConfig>) => void
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      className={`w-8 h-[18px] rounded-full relative shrink-0 transition-colors ${
        on ? 'bg-[#0ecb81]' : 'bg-[#2b3139]'
      }`}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
    >
      <span
        className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all ${
          on ? 'left-[14px]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}

function Meter({
  label,
  value,
  max = 1,
  color = '#60a5fa',
}: {
  label: string
  value: number
  max?: number
  color?: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-[#5e6673]">{label}</span>
        <span className="font-mono-nums text-[#eaecef]">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded bg-[#12161c] overflow-hidden">
        <div className="h-full rounded" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function CycleMenu({ config, candles, onChange }: CycleMenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const cfg = { ...DEFAULT_CYCLE_CONFIG, ...config }

  const model = useMemo(() => {
    if (!open && !cfg.enabled) return null
    return computeCycleModel(candles, { ...cfg, enabled: true })
  }, [
    candles,
    cfg.enabled,
    cfg.minPeriod,
    cfg.maxPeriod,
    cfg.fixedPeriod,
    cfg.showSeasonality,
    open,
  ])

  const updatePos = () => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const width = 340
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    const top = Math.min(r.bottom + 4, window.innerHeight - 80)
    setPos({ top, left })
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePos()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onResize = () => updatePos()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (menuRef.current?.contains(t)) return
      if (btnRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onDoc)
    }, 0)
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const menuMaxH = Math.max(
    160,
    Math.min(620, (typeof window !== 'undefined' ? window.innerHeight : 600) - (pos?.top ?? 80) - 16),
  )

  const dropdown =
    open && pos
      ? createPortal(
          <div
            ref={menuRef}
            className="w-[340px] overflow-y-auto bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-2xl p-2.5"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              maxHeight: menuMaxH,
              zIndex: 100000,
              overscrollBehavior: 'contain',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[10px] text-[#5e6673] uppercase tracking-wider">
                Analisi ciclica
              </div>
              <div className="flex gap-1">
                {Object.entries(CYCLE_PRESETS).map(([key, p]) => (
                  <button
                    key={key}
                    type="button"
                    className="text-[9px] px-1.5 py-0.5 rounded border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] hover:border-[#60a5fa]/40"
                    onClick={() => onChange(p.patch)}
                    title={p.label}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 py-1.5 border-b border-[#2b3139]/50">
              <Toggle
                on={!!cfg.enabled}
                onChange={() => onChange({ enabled: !cfg.enabled })}
              />
              <span className="text-[12px] font-medium text-[#eaecef]">Enabled</span>
            </div>

            {model && (
              <div className="py-2 space-y-1.5 border-b border-[#2b3139]/50">
                <Meter label="Strength" value={model.strength} color="#60a5fa" />
                <Meter label="Secondary" value={model.secondaryStrength} color="#a78bfa" />
                <div className="grid grid-cols-2 gap-1 text-[10px] text-[#848e9c]">
                  <span>Period</span>
                  <span className="text-right text-[#eaecef]">
                    {model.period} ({model.periodSource})
                  </span>
                  <span>Phase</span>
                  <span className="text-right text-[#eaecef]">{model.phaseDeg.toFixed(0)}°</span>
                  <span>Next high</span>
                  <span className="text-right text-[#0ecb81]">
                    {model.nextHighTime
                      ? new Date(model.nextHighTime * 1000).toLocaleString()
                      : '—'}
                  </span>
                  <span>Next low</span>
                  <span className="text-right text-[#f6465d]">
                    {model.nextLowTime
                      ? new Date(model.nextLowTime * 1000).toLocaleString()
                      : '—'}
                  </span>
                </div>
              </div>
            )}

            <div className="py-1.5 space-y-1 border-b border-[#2b3139]/50">
              <label className="flex items-center justify-between text-[11px] text-[#848e9c]">
                <span>Min period</span>
                <input
                  type="number"
                  className="w-16 bg-[#12161c] border border-[#2b3139] rounded px-1 text-[#eaecef]"
                  value={cfg.minPeriod}
                  min={2}
                  onChange={(e) => onChange({ minPeriod: Number(e.target.value) || 2 })}
                />
              </label>
              <label className="flex items-center justify-between text-[11px] text-[#848e9c]">
                <span>Max period</span>
                <input
                  type="number"
                  className="w-16 bg-[#12161c] border border-[#2b3139] rounded px-1 text-[#eaecef]"
                  value={cfg.maxPeriod}
                  min={4}
                  onChange={(e) => onChange({ maxPeriod: Number(e.target.value) || 4 })}
                />
              </label>
              <label className="flex items-center justify-between text-[11px] text-[#848e9c]">
                <span>Fixed period (0=auto)</span>
                <input
                  type="number"
                  className="w-16 bg-[#12161c] border border-[#2b3139] rounded px-1 text-[#eaecef]"
                  value={cfg.fixedPeriod ?? 0}
                  min={0}
                  onChange={(e) => onChange({ fixedPeriod: Number(e.target.value) || 0 })}
                />
              </label>
            </div>

            <div className="flex items-center gap-2 py-1.5 border-b border-[#2b3139]/50">
              <Toggle
                on={!!cfg.showSeasonality}
                onChange={() => onChange({ showSeasonality: !cfg.showSeasonality })}
              />
              <span className="text-[12px] text-[#848e9c]">Seasonality UTC</span>
            </div>

            {cfg.showSeasonality && model?.seasonality && model.seasonality.length > 0 && (
              <div className="py-1.5 space-y-0.5 border-b border-[#2b3139]/50">
                {model.seasonality.map((r) => (
                  <div key={r.dow} className="flex justify-between text-[10px]">
                    <span className="text-[#5e6673]">{DOW[r.dow] ?? r.dow}</span>
                    <span
                      className={
                        r.avgPct > 0.01
                          ? 'text-[#0ecb81]'
                          : r.avgPct < -0.01
                            ? 'text-[#f6465d]'
                            : 'text-[#848e9c]'
                      }
                    >
                      {r.avgPct >= 0 ? '+' : ''}
                      {r.avgPct.toFixed(3)}% ({r.samples})
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[9px] text-[#5e6673] leading-snug px-0.5 pt-1.5">
              Solo OHLCV reali · autocorrelazione (P1/P2) · bandpass · fase · ampiezza RMS ·
              proiezione turn · STC · seasonality UTC. Nessun dato sintetico.
            </p>
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        className={`px-2.5 py-0.5 text-xs rounded border font-semibold whitespace-nowrap ${
          cfg.enabled || open
            ? 'bg-[#1e2329] text-[#60a5fa] border-[#60a5fa]/50'
            : 'text-[#eaecef] border-[#2b3139] hover:bg-[#1e2329]'
        }`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title="Analisi ciclica professionale"
      >
        Cycles{cfg.enabled ? ' · ON' : ''} {open ? '▴' : '▾'}
      </button>
      {dropdown}
    </div>
  )
}
