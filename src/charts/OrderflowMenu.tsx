/**
 * Orderflow toolbar – single segmented group:
 * Print | Delta | Profile▾ | Trades▾ | Dom▾
 * Keeps drawing tools room; settings in small popovers.
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
import type { DeepTradesConfig, ThresholdMode, SizeUnit } from '@/analysis/deepTrades'
import type { DeepDomConfig } from '@/analysis/deepDom'
import { L2_GRANULARITY_NOTES } from '@/analysis/deepDom'
import type { DeltaPrintConfig } from '@/analysis/deltaPrint'
import { FOOTPRINT_NOTE } from '@/analysis/footprint'
import type { ExchangeId } from '@/types'
import { BUY } from '@/ui/palette'

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

type Pop = 'profile' | 'trades' | 'dom' | 'more' | null

function Chip({
  label,
  on,
  onClick,
  hasMenu,
  menuOpen,
}: {
  label: string
  on: boolean
  onClick: () => void
  hasMenu?: boolean
  menuOpen?: boolean
}) {
  return (
    <button
      type="button"
      className={`px-2 py-0.5 text-[11px] font-semibold border-r border-[#2b3139] last:border-r-0 transition-colors ${
        on
          ? 'bg-[#1e2329] text-[#f0b90b]'
          : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#12161c]'
      }`}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {label}
      {hasMenu ? (menuOpen ? ' ▴' : ' ▾') : ''}
    </button>
  )
}

export function OrderflowMenu({
  state,
  exchange,
  onChange,
  onPrintToggle,
}: OrderflowMenuProps) {
  const [pop, setPop] = useState<Pop>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pop) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPop(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [pop])

  const togglePop = (p: Pop) => setPop((cur) => (cur === p ? null : p))

  return (
    <div className="relative flex items-center shrink-0" ref={ref}>
      <div className="flex items-stretch rounded border border-[#2b3139] overflow-hidden bg-[#0b0e11]">
        <Chip label="Print" on={state.print} onClick={onPrintToggle} />
        <Chip
          label="Delta"
          on={state.delta}
          onClick={() => onChange({ delta: !state.delta })}
        />
        <Chip
          label="Profile"
          on={state.profile}
          hasMenu
          menuOpen={pop === 'profile'}
          onClick={() => {
            if (!state.profile) onChange({ profile: true })
            else if (pop !== 'profile') togglePop('profile')
            else onChange({ profile: false })
            if (state.profile) togglePop('profile')
            else setPop('profile')
          }}
        />
        <Chip
          label="Trades"
          on={state.trades}
          hasMenu
          menuOpen={pop === 'trades'}
          onClick={() => {
            if (!state.trades) {
              onChange({ trades: true })
              setPop('trades')
            } else if (pop === 'trades') {
              onChange({ trades: false })
              setPop(null)
            } else {
              setPop('trades')
            }
          }}
        />
        <Chip
          label="Dom"
          on={state.dom}
          hasMenu
          menuOpen={pop === 'dom'}
          onClick={() => {
            if (!state.dom) {
              onChange({ dom: true })
              setPop('dom')
            } else if (pop === 'dom') {
              onChange({ dom: false })
              setPop(null)
            } else {
              setPop('dom')
            }
          }}
        />
        <Chip
          label="More"
          on={state.footprint || state.replay || state.delta}
          hasMenu
          menuOpen={pop === 'more'}
          onClick={() => togglePop('more')}
        />
      </div>

      {/* Profile popover */}
      {pop === 'profile' && (
        <div
          className="absolute left-0 top-full mt-1 z-50 w-[280px] bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-2xl p-2.5"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-1.5">Profile</div>
          <div className="flex items-center gap-2 text-[11px] text-[#848e9c] mb-1.5">
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
          <div className="flex items-center gap-2 text-[11px] text-[#848e9c] mb-1.5">
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

      {/* Trades popover */}
      {pop === 'trades' && (
        <div
          className="absolute left-12 top-full mt-1 z-50 w-[260px] bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-2xl p-2.5"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-1.5">Deep Trades</div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#848e9c] mb-1.5">
            <select
              className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px]"
              value={state.tradesCfg.mode}
              onChange={(e) =>
                onChange({
                  tradesCfg: { ...state.tradesCfg, mode: e.target.value as ThresholdMode },
                })
              }
            >
              <option value="percentile">pctl</option>
              <option value="fixed">min</option>
            </select>
            {state.tradesCfg.mode === 'percentile' ? (
              <input
                type="number"
                min={50}
                max={99}
                className="w-12 bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px]"
                value={state.tradesCfg.percentile}
                onChange={(e) =>
                  onChange({
                    tradesCfg: {
                      ...state.tradesCfg,
                      percentile: Number(e.target.value) || 90,
                    },
                  })
                }
              />
            ) : (
              <input
                type="number"
                min={0}
                step="any"
                className="w-16 bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px]"
                value={state.tradesCfg.fixedMin}
                onChange={(e) =>
                  onChange({
                    tradesCfg: {
                      ...state.tradesCfg,
                      fixedMin: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            )}
            <select
              className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px]"
              value={state.tradesCfg.sizeUnit}
              onChange={(e) =>
                onChange({
                  tradesCfg: { ...state.tradesCfg, sizeUnit: e.target.value as SizeUnit },
                })
              }
            >
              <option value="base">base</option>
              <option value="quote">USDT</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-[#848e9c] cursor-pointer">
            <input
              type="checkbox"
              className="accent-[#0ecb81]"
              checked={state.tradesCfg.onlyEffective}
              onChange={(e) =>
                onChange({
                  tradesCfg: { ...state.tradesCfg, onlyEffective: e.target.checked },
                })
              }
            />
            Solo Effective
          </label>
          <p className="text-[9px] text-[#5e6673] mt-1 leading-snug">
            Buy {BUY} · Sell #a855f7 · fill = effective · outline = trapped
          </p>
        </div>
      )}

      {/* Dom popover */}
      {pop === 'dom' && (
        <div
          className="absolute left-24 top-full mt-1 z-50 w-[280px] bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-2xl p-2.5"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-1.5">DeepDom</div>
          <label className="flex items-center gap-2 text-[11px] text-[#848e9c] cursor-pointer mb-1">
            <input
              type="checkbox"
              className="accent-[#f0b90b]"
              checked={state.domCfg.showDelta}
              onChange={(e) =>
                onChange({ domCfg: { ...state.domCfg, showDelta: e.target.checked } })
              }
            />
            Δ heatmap (refill/pull)
          </label>
          <label className="flex items-center gap-2 text-[11px] text-[#848e9c] cursor-pointer mb-1">
            <input
              type="checkbox"
              className="accent-[#f0b90b]"
              checked={state.domCfg.showSurprise}
              onChange={(e) =>
                onChange({ domCfg: { ...state.domCfg, showSurprise: e.target.checked } })
              }
            />
            Surprise R/P + flash F
          </label>
          <label className="flex items-center gap-2 text-[11px] text-[#848e9c] cursor-pointer mb-1">
            <input
              type="checkbox"
              className="accent-[#f0b90b]"
              checked={state.domCfg.showMagnet}
              onChange={(e) =>
                onChange({ domCfg: { ...state.domCfg, showMagnet: e.target.checked } })
              }
            />
            Magnet clusters
          </label>
          <p className="text-[9px] text-[#5e6673] leading-snug mt-1">
            {L2_GRANULARITY_NOTES[exchange]}
          </p>
        </div>
      )}

      {/* More: Delta options + Footprint + Replay */}
      {pop === 'more' && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-[280px] bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-2xl p-2.5"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-1.5">Delta options</div>
          <label className="flex items-center gap-2 text-[11px] text-[#848e9c] cursor-pointer mb-1">
            <input
              type="checkbox"
              className="accent-[#f0b90b]"
              checked={state.deltaCfg.cvd}
              disabled={!state.delta}
              onChange={(e) =>
                onChange({ deltaCfg: { ...state.deltaCfg, cvd: e.target.checked } })
              }
            />
            CVD line
          </label>
          <label className="flex items-center gap-2 text-[11px] text-[#848e9c] cursor-pointer mb-1">
            <input
              type="checkbox"
              className="accent-[#f0b90b]"
              checked={state.deltaCfg.divergence}
              disabled={!state.delta}
              onChange={(e) =>
                onChange({ deltaCfg: { ...state.deltaCfg, divergence: e.target.checked } })
              }
            />
            Δ divergence
          </label>
          <label className="flex items-center gap-2 text-[11px] text-[#848e9c] cursor-pointer mb-2">
            <input
              type="checkbox"
              className="accent-[#f0b90b]"
              checked={state.deltaCfg.absorption !== false}
              disabled={!state.delta}
              onChange={(e) =>
                onChange({ deltaCfg: { ...state.deltaCfg, absorption: e.target.checked } })
              }
            />
            Abs / Agg tags
          </label>

          <div className="border-t border-[#2b3139] pt-2 mt-1">
            <label className="flex items-center gap-2 text-[11px] text-[#eaecef] cursor-pointer mb-1">
              <input
                type="checkbox"
                className="accent-[#0ecb81]"
                checked={state.footprint}
                onChange={(e) => onChange({ footprint: e.target.checked })}
              />
              Footprint grid
            </label>
            {state.footprint && (
              <p className="text-[9px] text-[#5e6673] mb-1.5 pl-5">{FOOTPRINT_NOTE}</p>
            )}
            <label className="flex items-center gap-2 text-[11px] text-[#eaecef] cursor-pointer">
              <input
                type="checkbox"
                className="accent-[#0ecb81]"
                checked={state.replay}
                onChange={(e) => onChange({ replay: e.target.checked })}
              />
              Replay (IDB)
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
