/**
 * Cycles menu – dominant period, wave, phase marks, seasonality, STC readout.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Candle } from '@/types'
import { computeCycleModel } from './compute'
import type { CycleConfig } from './types'
import { DEFAULT_CYCLE_CONFIG } from './types'

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

export function CycleMenu({ config, candles, onChange }: CycleMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const cfg = { ...DEFAULT_CYCLE_CONFIG, ...config }

  const model = useMemo(() => {
    if (!open && !cfg.enabled) return null
    return computeCycleModel(candles, { ...cfg, enabled: true })
  }, [candles, cfg.enabled, cfg.minPeriod, cfg.maxPeriod, cfg.fixedPeriod, cfg.showSeasonality, open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
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
        title="Analisi ciclica"
      >
        Cycles{cfg.enabled ? ' · ON' : ''} {open ? '▴' : '▾'}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-[200] w-[320px] max-h-[min(70vh,560px)] overflow-y-auto bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-2xl p-2"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-[#5e6673] uppercase tracking-wider px-0.5 mb-1">
            Analisi ciclica
          </div>

          <div className="flex items-center gap-2 py-1.5 border-b border-[#2b3139]/60">
            <Toggle on={cfg.enabled} onChange={() => onChange({ enabled: !cfg.enabled })} />
            <span className="text-[12px] text-[#eaecef] font-medium">Overlay attivo</span>
          </div>

          <div className="flex items-center gap-2 py-1.5 border-b border-[#2b3139]/60">
            <Toggle on={cfg.showWave} onChange={() => onChange({ showWave: !cfg.showWave })} />
            <span className="text-[12px] text-[#848e9c]">Onda bandpass</span>
          </div>

          <div className="flex items-center gap-2 py-1.5 border-b border-[#2b3139]/60">
            <Toggle
              on={cfg.showPhaseMarks}
              onChange={() => onChange({ showPhaseMarks: !cfg.showPhaseMarks })}
            />
            <span className="text-[12px] text-[#848e9c]">Mark fase 0° / 180°</span>
          </div>

          <div className="py-2 space-y-1.5 border-b border-[#2b3139]/60">
            <div className="text-[10px] text-[#5e6673]">Periodo barre (auto o fisso)</div>
            <div className="flex gap-2 items-center">
              <label className="text-[10px] text-[#848e9c]">min</label>
              <input
                type="number"
                min={3}
                max={200}
                className="w-14 bg-[#12161c] border border-[#2b3139] rounded px-1 text-[11px] text-[#eaecef]"
                value={cfg.minPeriod}
                onChange={(e) => onChange({ minPeriod: Math.max(3, Number(e.target.value) || 8) })}
              />
              <label className="text-[10px] text-[#848e9c]">max</label>
              <input
                type="number"
                min={5}
                max={300}
                className="w-14 bg-[#12161c] border border-[#2b3139] rounded px-1 text-[11px] text-[#eaecef]"
                value={cfg.maxPeriod}
                onChange={(e) => onChange({ maxPeriod: Math.max(5, Number(e.target.value) || 80) })}
              />
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-[10px] text-[#848e9c]">fisso (0=auto)</label>
              <input
                type="number"
                min={0}
                max={300}
                className="w-16 bg-[#12161c] border border-[#2b3139] rounded px-1 text-[11px] text-[#eaecef]"
                value={cfg.fixedPeriod}
                onChange={(e) => onChange({ fixedPeriod: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
          </div>

          {model?.ready && (
            <div className="py-2 space-y-1 text-[11px] font-mono-nums border-b border-[#2b3139]/60">
              <div className="text-[#60a5fa]">
                P={model.period} · {model.periodSource} · str{' '}
                {(model.strength * 100).toFixed(0)}%
              </div>
              <div className="text-[#eaecef]">Phase {model.phaseDeg.toFixed(1)}°</div>
              <div className="text-[#848e9c]">
                STC{' '}
                {model.stc.length
                  ? model.stc[model.stc.length - 1].value.toFixed(1)
                  : '—'}
                {' · '}bars {model.barCount}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 py-1.5">
            <Toggle
              on={cfg.showSeasonality}
              onChange={() => onChange({ showSeasonality: !cfg.showSeasonality })}
            />
            <span className="text-[12px] text-[#848e9c]">Stagionalità weekday (UTC)</span>
          </div>

          {cfg.showSeasonality && model?.weekdayReturns && model.weekdayReturns.length > 0 && (
            <div className="grid grid-cols-2 gap-1 pb-1">
              {model.weekdayReturns.map((r) => (
                <div
                  key={r.dow}
                  className="flex justify-between px-1.5 py-0.5 rounded bg-[#0d1118] text-[10px] font-mono-nums"
                >
                  <span className="text-[#5e6673]">{DOW[r.dow]}</span>
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

          <p className="text-[9px] text-[#5e6673] leading-snug px-0.5 pt-1">
            Solo OHLCV reali · periodo dominante (autocorrelazione) · bandpass · fase · STC ·
            seasonality weekday UTC. Nessun dato sintetico.
          </p>
        </div>
      )}
    </div>
  )
}
