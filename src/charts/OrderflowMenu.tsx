/**
 * Compact Orderflow dropdown – Print / Delta / Profile / Trades / Dom / Footprint / Replay.
 */

import { useEffect, useRef, useState } from 'react'
import type {
  ProfileWindow,
  ProfileConfig,
  FixedProfileKind,
} from '@/analysis/volumeProfile'
import {
  PROFILE_WINDOW_LABELS,
  FIXED_PROFILE_LABELS,
  SESSION_NOTE,
} from '@/analysis/volumeProfile'
import type {
  DeepTradesConfig,
  ThresholdMode,
  SizeUnit,
} from '@/analysis/deepTrades'
import type { DeepDomConfig } from '@/analysis/deepDom'
import { L2_GRANULARITY_NOTES } from '@/analysis/deepDom'
import type { DeltaPrintConfig } from '@/analysis/deltaPrint'
import { FOOTPRINT_NOTE } from '@/analysis/footprint'
import type { ExchangeId } from '@/types'

const DEVELOPING_WINDOWS: ProfileWindow[] = [
  'visible',
  'session',
  'last_30m',
  'session_open_30m',
]

const FIXED_OPTIONS: FixedProfileKind[] = ['none', 'session_open_30m', 'previous_day']

export interface OrderflowState {
  print: boolean
  delta: boolean
  deltaCfg: DeltaPrintConfig
  profile: boolean
  profileCfg: ProfileConfig
  trades: boolean
  tradesCfg: DeepTradesConfig
  dom: boolean
  domCfg: DeepDomConfig
  footprint: boolean
  replay: boolean
}

interface OrderflowMenuProps {
  state: OrderflowState
  exchange: ExchangeId
  onChange: (patch: Partial<OrderflowState>) => void
  onPrintToggle: () => void
}

export function OrderflowMenu({
  state,
  exchange,
  onChange,
  onPrintToggle,
}: OrderflowMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const anyOn =
    state.print ||
    state.delta ||
    state.profile ||
    state.trades ||
    state.dom ||
    state.footprint ||
    state.replay

  const row = (
    label: string,
    on: boolean,
    toggle: () => void,
    extra?: React.ReactNode
  ) => (
    <div className="flex items-center gap-2 py-1.5 border-b border-[#2b3139]/60 last:border-0">
      <button
        type="button"
        className={`w-9 h-5 rounded-full relative shrink-0 transition-colors ${
          on ? 'bg-[#0ecb81]' : 'bg-[#2b3139]'
        }`}
        onClick={toggle}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
            on ? 'left-4' : 'left-0.5'
          }`}
        />
      </button>
      <span className="text-[12px] text-[#eaecef] font-medium flex-1">{label}</span>
      {extra}
    </div>
  )

  return (
    <div className="relative ml-2" ref={ref}>
      <button
        type="button"
        className={`shrink-0 px-2.5 py-0.5 text-xs rounded border font-semibold ${
          anyOn || open
            ? 'bg-[#1e2329] text-[#f0b90b] border-[#f0b90b]/50'
            : 'text-[#eaecef] border-[#2b3139] hover:bg-[#1e2329]'
        }`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        Orderflow {open ? '▴' : '▾'}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 w-[320px] bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-2xl p-2"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {row('Deep Print', state.print, onPrintToggle)}
          {row('Delta (histogram)', state.delta, () => onChange({ delta: !state.delta }))}

          {state.delta && (
            <div className="pl-11 pb-2 space-y-1.5 border-b border-[#2b3139]/60">
              <label className="flex items-center gap-2 text-[11px] text-[#848e9c] cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-[#f0b90b]"
                  checked={state.deltaCfg.cvd}
                  onChange={(e) =>
                    onChange({ deltaCfg: { ...state.deltaCfg, cvd: e.target.checked } })
                  }
                />
                CVD line
              </label>
              <label className="flex items-center gap-2 text-[11px] text-[#848e9c] cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-[#f0b90b]"
                  checked={state.deltaCfg.divergence}
                  onChange={(e) =>
                    onChange({
                      deltaCfg: { ...state.deltaCfg, divergence: e.target.checked },
                    })
                  }
                />
                Δ divergence flags
              </label>
              <label className="flex items-center gap-2 text-[11px] text-[#848e9c] cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-[#f0b90b]"
                  checked={state.deltaCfg.absorption !== false}
                  onChange={(e) =>
                    onChange({
                      deltaCfg: { ...state.deltaCfg, absorption: e.target.checked },
                    })
                  }
                />
                Abs / Agg tags
              </label>
              <div className="flex items-center gap-2 text-[11px] text-[#848e9c]">
                <span className="shrink-0">Min bar %</span>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={5}
                  className="flex-1 h-1 accent-[#0ecb81]"
                  value={state.deltaCfg.minBarPct}
                  onChange={(e) =>
                    onChange({
                      deltaCfg: { ...state.deltaCfg, minBarPct: Number(e.target.value) },
                    })
                  }
                />
                <span className="w-8 text-[#eaecef] tabular-nums">{state.deltaCfg.minBarPct}%</span>
              </div>
            </div>
          )}

          {row('Profile', state.profile, () => onChange({ profile: !state.profile }))}

          {state.profile && (
            <div className="pl-11 pb-2 space-y-1.5 border-b border-[#2b3139]/60">
              <div className="flex items-center gap-2 text-[11px] text-[#848e9c]">
                <span className="w-16 shrink-0">Developing</span>
                <select
                  className="flex-1 bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px]"
                  value={state.profileCfg.developing}
                  onChange={(e) =>
                    onChange({
                      profileCfg: {
                        ...state.profileCfg,
                        developing: e.target.value as ProfileWindow,
                      },
                    })
                  }
                >
                  {DEVELOPING_WINDOWS.map((w) => (
                    <option key={w} value={w}>
                      {PROFILE_WINDOW_LABELS[w]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#848e9c]">
                <span className="w-16 shrink-0">Fixed</span>
                <select
                  className="flex-1 bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px]"
                  value={state.profileCfg.fixed}
                  onChange={(e) =>
                    onChange({
                      profileCfg: {
                        ...state.profileCfg,
                        fixed: e.target.value as FixedProfileKind,
                      },
                    })
                  }
                >
                  {FIXED_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {FIXED_PROFILE_LABELS[f]}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[9px] text-[#5e6673] leading-snug">{SESSION_NOTE}</p>
            </div>
          )}

          {row('Deep Trades', state.trades, () => onChange({ trades: !state.trades }))}

          {state.trades && (
            <div className="pl-11 pb-2 text-[9px] text-[#5e6673] border-b border-[#2b3139]/60">
              Effective / Trapped after 1 candle · Solo Effective in submenu options via mode.
            </div>
          )}

          {row('DeepDom + ladder', state.dom, () => onChange({ dom: !state.dom }))}

          {state.dom && (
            <div className="pl-11 pb-2 space-y-1.5 border-b border-[#2b3139]/60">
              <label className="flex items-center gap-2 text-[11px] text-[#848e9c] cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-[#f0b90b]"
                  checked={state.domCfg.showDelta}
                  onChange={(e) =>
                    onChange({ domCfg: { ...state.domCfg, showDelta: e.target.checked } })
                  }
                />
                Δ heatmap + Surprise R/P + Magnet
              </label>
              <p className="text-[9px] text-[#5e6673] leading-snug">
                {L2_GRANULARITY_NOTES[exchange]} Book surprise is conservative (flash F),
                not institutional spoofing.
              </p>
            </div>
          )}

          {row('Footprint grid', state.footprint, () =>
            onChange({ footprint: !state.footprint })
          )}
          {state.footprint && (
            <p className="pl-11 pb-2 text-[9px] text-[#5e6673] leading-snug border-b border-[#2b3139]/60">
              {FOOTPRINT_NOTE}
            </p>
          )}

          {row('Replay (IDB archive)', state.replay, () =>
            onChange({ replay: !state.replay })
          )}
          {state.replay && (
            <p className="pl-11 pb-1 text-[9px] text-[#5e6673] leading-snug">
              Seek stored ticks beyond ring buffer. Centers primary chart — no synthetic fills.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
