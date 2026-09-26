/**
 * Compact Orderflow dropdown – Print / Delta / Profile / Trades / Dom.
 */

import { useEffect, useRef, useState } from 'react'
import type { ProfileWindow } from '@/analysis/volumeProfile'
import { PROFILE_WINDOW_LABELS } from '@/analysis/volumeProfile'
import type { DeepTradesConfig, ThresholdMode } from '@/analysis/deepTrades'
import type { DeepDomConfig } from '@/analysis/deepDom'
import { L2_GRANULARITY_NOTES } from '@/analysis/deepDom'
import type { ExchangeId } from '@/types'

const PROFILE_WINDOWS: ProfileWindow[] = [
  'visible',
  'session',
  'last_30m',
  'session_open_30m',
]

export interface OrderflowState {
  print: boolean
  delta: boolean
  profile: boolean
  profileWindow: ProfileWindow
  trades: boolean
  tradesCfg: DeepTradesConfig
  dom: boolean
  domCfg: DeepDomConfig
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
    state.print || state.delta || state.profile || state.trades || state.dom

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
          className="absolute left-0 top-full mt-1 z-50 w-[280px] bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-2xl p-2"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {row('Deep Print', state.print, onPrintToggle)}
          {row('Delta (histogram)', state.delta, () =>
            onChange({ delta: !state.delta })
          )}
          {row(
            'Profile',
            state.profile,
            () => onChange({ profile: !state.profile }),
            state.profile ? (
              <select
                className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px] max-w-[120px]"
                value={state.profileWindow}
                onChange={(e) =>
                  onChange({ profileWindow: e.target.value as ProfileWindow })
                }
              >
                {PROFILE_WINDOWS.map((w) => (
                  <option key={w} value={w}>
                    {PROFILE_WINDOW_LABELS[w]}
                  </option>
                ))}
              </select>
            ) : null
          )}
          {row(
            'Deep Trades',
            state.trades,
            () => onChange({ trades: !state.trades }),
            state.trades ? (
              <div className="flex items-center gap-1">
                <select
                  className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px]"
                  value={state.tradesCfg.mode}
                  onChange={(e) =>
                    onChange({
                      tradesCfg: {
                        ...state.tradesCfg,
                        mode: e.target.value as ThresholdMode,
                      },
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
                    className="w-10 bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px]"
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
                    className="w-14 bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px]"
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
              </div>
            ) : null
          )}
          {row(
            'DeepDom + ladder',
            state.dom,
            () => onChange({ dom: !state.dom }),
            state.dom ? (
              <input
                type="number"
                min={1}
                max={30}
                title="Window minutes"
                className="w-10 bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px]"
                value={state.domCfg.windowMinutes}
                onChange={(e) =>
                  onChange({
                    domCfg: {
                      ...state.domCfg,
                      windowMinutes: Math.max(1, Number(e.target.value) || 5),
                    },
                  })
                }
              />
            ) : null
          )}

          {state.dom && (
            <p className="mt-1.5 text-[9px] text-[#848e9c] leading-snug">
              {L2_GRANULARITY_NOTES[exchange]}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
