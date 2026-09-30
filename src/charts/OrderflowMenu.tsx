/**
 * Orderflow – un unico menu a tendina con tutti gli strumenti:
 * Print · Delta · Profile · Trades · Dom · Footprint · Gamma · Replay
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
import { DEFAULT_GAMMA_CONFIG, type GammaConfig } from '@/analysis/gamma'
import type { ExchangeId } from '@/types'

const DEVELOPING_WINDOWS: ProfileWindow[] = [
  'visible',
  'session',
  'last_30m',
  'session_open_30m',
  'previous_day',
  'weekly',
  'last_3d',
]
const FIXED_OPTIONS: FixedProfileKind[] = [
  'none',
  'session_open_30m',
  'previous_day',
  'weekly',
]

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
  gamma: boolean
  gammaCfg: GammaConfig
  replay: boolean
}

interface OrderflowMenuProps {
  state: OrderflowState
  exchange?: ExchangeId
  onChange: (patch: Partial<OrderflowState>) => void
  onPrintToggle?: () => void
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
  on,
  onToggle,
  children,
}: {
  label: string
  on: boolean
  onToggle: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="border-b border-[#2b3139]/60 last:border-0 py-1.5">
      <div className="flex items-center gap-2">
        <Toggle on={on} onChange={onToggle} />
        <span
          className={`text-[12px] font-medium flex-1 ${
            on ? 'text-[#eaecef]' : 'text-[#848e9c]'
          }`}
        >
          {label}
        </span>
      </div>
      {on && children && <div className="pl-10 pt-1.5 space-y-1">{children}</div>}
    </div>
  )
}

export function OrderflowMenu({
  state,
  exchange = 'binance',
  onChange,
  onPrintToggle,
}: OrderflowMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const togglePrint = onPrintToggle ?? (() => onChange({ print: !state.print }))

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const active = [
    state.print && 'Print',
    state.delta && 'Delta',
    state.profile && 'Profile',
    state.trades && 'Trades',
    state.dom && 'Dom',
    state.footprint && 'FP',
    state.gamma && 'Gamma',
    state.replay && 'Replay',
  ].filter(Boolean) as string[]

  const anyOn = active.length > 0

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        className={`px-2.5 py-0.5 text-xs rounded border font-semibold whitespace-nowrap ${
          anyOn || open
            ? 'bg-[#1e2329] text-[#f0b90b] border-[#f0b90b]/50'
            : 'text-[#eaecef] border-[#2b3139] hover:bg-[#1e2329]'
        }`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title={anyOn ? active.join(' · ') : 'Orderflow tools'}
      >
        Orderflow{anyOn ? ` · ${active.length}` : ''} {open ? '▴' : '▾'}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-[200] w-[300px] max-h-[min(70vh,520px)] overflow-y-auto bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-2xl p-2"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-[#5e6673] uppercase tracking-wider px-0.5 mb-1">
            Strumenti orderflow
          </div>

          <Row label="Deep Print" on={state.print} onToggle={togglePrint}>
            <p className="text-[9px] text-[#5e6673] leading-snug">
              SELL|PX|BUY|Δ|VP · buy%/sell% · imbalance + stacked · VP candela
            </p>
          </Row>

          <Row label="Delta" on={state.delta} onToggle={() => onChange({ delta: !state.delta })}>
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
          </Row>

          <Row
            label="Profile"
            on={state.profile}
            onToggle={() => onChange({ profile: !state.profile })}
          >
            <p className="text-[9px] text-[#5e6673] leading-snug">
              POC/VAH/VAL/LVN · {SESSION_NOTE}
            </p>
          </Row>

          <Row
            label="Deep Trades"
            on={state.trades}
            onToggle={() => onChange({ trades: !state.trades })}
          >
            <p className="text-[9px] text-[#5e6673]">Large prints · effective/trapped</p>
          </Row>

          <Row
            label="DeepDom + ladder"
            on={state.dom}
            onToggle={() => onChange({ dom: !state.dom })}
          >
            <p className="text-[9px] text-[#5e6673] leading-snug">
              {L2_GRANULARITY_NOTES[exchange]}
            </p>
          </Row>

          <Row
            label="Footprint grid"
            on={state.footprint}
            onToggle={() => onChange({ footprint: !state.footprint })}
          >
            <p className="text-[9px] text-[#5e6673] leading-snug">{FOOTPRINT_NOTE}</p>
          </Row>

          <Row
            label="Gamma levels"
            on={!!state.gamma}
            onToggle={() => onChange({ gamma: !state.gamma })}
          >
            <p className="text-[9px] text-[#5e6673] leading-snug">
              Call/Put walls · flip · max pain da Deribit OI (BTC/ETH). Live,
              linee sincronizzate al prezzo del grafico.
            </p>
            {state.gamma && (
              <div className="flex flex-col gap-1 mt-1">
                <label className="flex items-center gap-2 text-[11px] text-[#848e9c] cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-[#0ecb81]"
                    checked={state.gammaCfg?.walls !== false}
                    onChange={(e) =>
                      onChange({
                        gammaCfg: {
                          ...(state.gammaCfg ?? DEFAULT_GAMMA_CONFIG),
                          walls: e.target.checked,
                        },
                      })
                    }
                  />
                  Call / Put walls
                </label>
                <label className="flex items-center gap-2 text-[11px] text-[#848e9c] cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-[#f0b90b]"
                    checked={state.gammaCfg?.flip !== false}
                    onChange={(e) =>
                      onChange({
                        gammaCfg: {
                          ...(state.gammaCfg ?? DEFAULT_GAMMA_CONFIG),
                          flip: e.target.checked,
                        },
                      })
                    }
                  />
                  Flip level
                </label>
                <label className="flex items-center gap-2 text-[11px] text-[#848e9c] cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-[#60a5fa]"
                    checked={state.gammaCfg?.maxPain !== false}
                    onChange={(e) =>
                      onChange({
                        gammaCfg: {
                          ...(state.gammaCfg ?? DEFAULT_GAMMA_CONFIG),
                          maxPain: e.target.checked,
                        },
                      })
                    }
                  />
                  Max pain
                </label>
              </div>
            )}
          </Row>

          <Row
            label="Replay (IDB)"
            on={state.replay}
            onToggle={() => onChange({ replay: !state.replay })}
          >
            <p className="text-[9px] text-[#5e6673] leading-snug">
              Seek tick archiviati · no fill sintetici
            </p>
          </Row>

          {anyOn && (
            <p className="text-[9px] text-[#5e6673] mt-1.5 px-0.5">
              Attivi: {active.join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
