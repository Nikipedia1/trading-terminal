/**
 * Cycles menu – professional controls, live readouts, presets, seasonality.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
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

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-[#2b3139]/50">
      {children}
      <span className="text-[12px] text-[#848e9c]">{label}</span>
    </div>
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
        <span className="font-mono-nums text-[#eaecef]">{(pct).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded bg-[#12161c] overflow-hidden">
        <div className="h-full rounded" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function CycleMenu({ config, candles, onChange }: CycleMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
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
        title="Analisi ciclica professionale"
      >
        Cycles{cfg.enabled ? ' · ON' : ''} {open ? '▴' : '▾'}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-[200] w-[340px] max-h-[min(75vh,620px)] overflow-y-auto bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-2xl p-2.5"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
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

          <Row label="Overlay attivo">
            <Toggle on={cfg.enabled} onChange={() => onChange({ enabled: !cfg.enabled })} />
          </Row>
          <Row label="Onda bandpass">
            <Toggle on={cfg.showWave} onChange={() => onChange({ showWave: !cfg.showWave })} />
          </Row>
          <Row label="Inviluppo ampiezza">
            <Toggle
              on={cfg.showAmplitude}
              onChange={() => onChange({ showAmplitude: !cfg.showAmplitude })}
            />
          </Row>
          <Row label="Ciclo secondario">
            <Toggle
              on={cfg.showSecondary}
              onChange={() => onChange({ showSecondary: !cfg.showSecondary })}
            />
          </Row>
          <Row label="Mark fase 0° / 180°">
            <Toggle
              on={cfg.showPhaseMarks}
              onChange={() => onChange({ showPhaseMarks: !cfg.showPhaseMarks })}
            />
          </Row>
          <Row label="Proiezione next H/L">
            <Toggle
              on={cfg.showProjections}
              onChange={() => onChange({ showProjections: !cfg.showProjections })}
            />
          </Row>
          <Row label="HUD on-chart">
            <Toggle on={cfg.showHud} onChange={() => onChange({ showHud: !cfg.showHud })} />
          </Row>

          <div className="py-2 space-y-1.5 border-b border-[#2b3139]/50">
            <div className="text-[10px] text-[#5e6673]">Periodo barre (auto o fisso)</div>
            <div className="flex gap-2 items-center flex-wrap">
              <label className="text-[10px] text-[#848e9c]">min</label>
              <input
                type="number"
                min={3}
                max={200}
                className="w-14 bg-[#12161c] border border-[#2b3139] rounded px-1 text-[11px] text-[#eaecef]"
                value={cfg.minPeriod}
                onChange={(e) =>
                  onChange({ minPeriod: Math.max(3, Number(e.target.value) || 8) })
                }
              />
              <label className="text-[10px] text-[#848e9c]">max</label>
              <input
                type="number"
                min={5}
                max={300}
                className="w-14 bg-[#12161c] border border-[#2b3139] rounded px-1 text-[11px] text-[#eaecef]"
                value={cfg.maxPeriod}
                onChange={(e) =>
                  onChange({ maxPeriod: Math.max(5, Number(e.target.value) || 80) })
                }
              />
              <label className="text-[10px] text-[#848e9c]">fisso</label>
              <input
                type="number"
                min={0}
                max={300}
                className="w-14 bg-[#12161c] border border-[#2b3139] rounded px-1 text-[11px] text-[#eaecef]"
                value={cfg.fixedPeriod}
                onChange={(e) =>
                  onChange({ fixedPeriod: Math.max(0, Number(e.target.value) || 0) })
                }
                title="0 = auto dominante"
              />
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-[10px] text-[#848e9c] w-16">opacity</label>
              <input
                type="range"
                min={0.25}
                max={1}
                step={0.05}
                className="flex-1 accent-[#60a5fa]"
                value={cfg.waveOpacity}
                onChange={(e) => onChange({ waveOpacity: Number(e.target.value) })}
              />
              <span className="text-[10px] font-mono-nums text-[#848e9c] w-8">
                {Math.round(cfg.waveOpacity * 100)}%
              </span>
            </div>
          </div>

          {model?.ready && (
            <div className="py-2 space-y-2 border-b border-[#2b3139]/50">
              <div className="text-[10px] text-[#5e6673] uppercase tracking-wider">Live</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono-nums">
                <div>
                  <span className="text-[#5e6673]">P1 </span>
                  <span className="text-[#60a5fa] font-semibold">{model.period}</span>
                  <span className="text-[#5e6673]"> · {model.periodSource}</span>
                </div>
                <div>
                  <span className="text-[#5e6673]">P2 </span>
                  <span className="text-[#a78bfa]">
                    {model.secondaryPeriod > 0 ? model.secondaryPeriod : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[#5e6673]">Phase </span>
                  <span className="text-[#eaecef]">{model.phaseDeg.toFixed(1)}°</span>
                </div>
                <div>
                  <span className="text-[#5e6673]">Amp </span>
                  <span className="text-[#eaecef]">{model.amplitude.toPrecision(3)}</span>
                </div>
                <div>
                  <span className="text-[#5e6673]">STC </span>
                  <span className="text-[#eaecef]">
                    {model.stc.length
                      ? model.stc[model.stc.length - 1].value.toFixed(1)
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[#5e6673]">Bars </span>
                  <span className="text-[#eaecef]">{model.barCount}</span>
                </div>
              </div>
              <Meter label="Strength P1" value={model.strength} color="#60a5fa" />
              {model.secondaryPeriod > 0 && (
                <Meter
                  label="Strength P2"
                  value={model.secondaryStrength}
                  color="#a78bfa"
                />
              )}
              {model.barsToNextTurn != null && model.nextTurnKind && (
                <div
                  className={`text-[11px] font-mono-nums px-1.5 py-1 rounded ${
                    model.nextTurnKind === 'high'
                      ? 'bg-[#0ecb81]/10 text-[#0ecb81]'
                      : 'bg-[#f6465d]/10 text-[#f6465d]'
                  }`}
                >
                  Next {model.nextTurnKind.toUpperCase()} in ~{model.barsToNextTurn.toFixed(1)}{' '}
                  bars
                </div>
              )}
            </div>
          )}

          <Row label="Stagionalità weekday (UTC)">
            <Toggle
              on={cfg.showSeasonality}
              onChange={() => onChange({ showSeasonality: !cfg.showSeasonality })}
            />
          </Row>
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

          <p className="text-[9px] text-[#5e6673] leading-snug px-0.5 pt-1.5">
            Solo OHLCV reali · autocorrelazione (P1/P2) · bandpass · fase · ampiezza RMS ·
            proiezione turn · STC · seasonality UTC. Nessun dato sintetico.
          </p>
        </div>
      )}
    </div>
  )
}
