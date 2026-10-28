/**
 * Orderflow – un unico menu a tendina con tutti gli strumenti:
 * Print · Delta · Profile · Trades · L2 Heatmap · Footprint · GEX · Replay
 * Dropdown via portal (fixed) so toolbar overflow does not clip it.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ProfileConfig } from '@/analysis/volumeProfile'
import { SESSION_NOTE } from '@/analysis/volumeProfile'
import type { DeepTradesConfig } from '@/analysis/deepTrades'
import type { DeepDomConfig } from '@/analysis/deepDom'
import { L2_GRANULARITY_NOTES } from '@/analysis/deepDom'
import type { DeltaPrintConfig } from '@/analysis/deltaPrint'
import {
  FOOTPRINT_NOTE,
  DEFAULT_FOOTPRINT_CONFIG,
  type FootprintConfig,
} from '@/analysis/footprint'
import { DEFAULT_GAMMA_CONFIG, type GammaConfig } from '@/analysis/gamma'
import type { ExchangeId } from '@/types'

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
  footprintCfg: FootprintConfig
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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const togglePrint = onPrintToggle ?? (() => onChange({ print: !state.print }))

  const updatePos = () => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const width = 300
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

  const active = [
    state.print && 'Print',
    state.delta && 'Delta',
    state.profile && 'VP',
    state.trades && 'Trades',
    state.dom && 'Heatmap',
    state.footprint && 'Footprint',
    state.gamma && 'GEX',
    state.replay && 'Replay',
  ].filter(Boolean) as string[]

  const anyOn = active.length > 0

  const menuMaxH = Math.max(
    160,
    Math.min(520, (typeof window !== 'undefined' ? window.innerHeight : 600) - (pos?.top ?? 80) - 16),
  )

  const dropdown =
    open && pos
      ? createPortal(
          <div
            ref={menuRef}
            className="w-[300px] overflow-y-auto bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-2xl p-2"
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
            <div className="text-[10px] text-[#5e6673] uppercase tracking-wider px-0.5 mb-1">
              Strumenti orderflow
            </div>

            <Row label="Deep Print" on={!!state.print} onToggle={togglePrint}>
              <p className="text-[9px] text-[#5e6673] leading-snug">
                SELL|PX|BUY|Δ|VP · buy%/sell% · imbalance + stacked · VP candela
              </p>
            </Row>

            <Row
              label="Delta"
              on={!!state.delta}
              onToggle={() => onChange({ delta: !state.delta })}
            >
              <label className="flex items-center gap-2 text-[11px] text-[#848e9c] cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-[#f0b90b]"
                  checked={!!state.deltaCfg?.cvd}
                  onChange={(e) =>
                    onChange({
                      deltaCfg: {
                        cvd: e.target.checked,
                        divergence: !!state.deltaCfg?.divergence,
                        absorption: state.deltaCfg?.absorption !== false,
                        minBarPct: state.deltaCfg?.minBarPct ?? 0,
                      },
                    })
                  }
                />
                CVD line
              </label>
            </Row>

            <Row
              label="Volume Profile"
              on={!!state.profile}
              onToggle={() => onChange({ profile: !state.profile })}
            >
              <p className="text-[9px] text-[#5e6673] leading-snug">{SESSION_NOTE}</p>
            </Row>

            <Row
              label="Deep Trades"
              on={!!state.trades}
              onToggle={() => onChange({ trades: !state.trades })}
            >
              <p className="text-[9px] text-[#5e6673] leading-snug">
                Print aggressivi grandi · percentile / fixed
              </p>
            </Row>

            <Row
              label="L2 Heatmap / DOM"
              on={!!state.dom}
              onToggle={() => onChange({ dom: !state.dom })}
            >
              <p className="text-[9px] text-[#5e6673] leading-snug">
                {L2_GRANULARITY_NOTES?.[exchange] ?? 'Book L2 pubblico'}
              </p>
            </Row>

            <Row
              label="Footprint"
              on={!!state.footprint}
              onToggle={() => onChange({ footprint: !state.footprint })}
            >
              <p className="text-[9px] text-[#5e6673] leading-snug">{FOOTPRINT_NOTE}</p>
            </Row>

            <Row
              label="Gamma / GEX"
              on={!!state.gamma}
              onToggle={() => onChange({ gamma: !state.gamma })}
            >
              <p className="text-[9px] text-[#5e6673] leading-snug">
                Deribit walls / flip / max pain (BTC·ETH)
              </p>
            </Row>

            <Row
              label="Replay (IDB)"
              on={!!state.replay}
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
      {dropdown}
    </div>
  )
}
