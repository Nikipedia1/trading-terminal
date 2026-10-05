/**
 * 3D Pro desk widget — mode + theme + camera presets.
 */

import { useMemo, useState, useCallback, useEffect } from 'react'
import type { Candle, OrderBook, Trade } from '@/types'
import type { ExchangeId } from '@/types'
import { useMarketStore } from '@/stores/marketStore'
import { subscribeOrderBookFeed } from '@/data/shared'
import { buildViz3DModel } from './compute'
import { Viz3DScene } from './Viz3DScene'
import {
  DEFAULT_VIZ3D_CONFIG,
  DEFAULT_DOM3D_OPTIONS,
  VIZ3D_PRESETS,
  type Viz3DConfig,
} from './types'

interface Viz3DPanelProps {
  panelId?: string
  exchange: ExchangeId
  symbol: string
  candles: Candle[]
}

const THEME_OPTIONS: { id: Viz3DConfig['theme']; label: string }[] = [
  { id: 'desk', label: 'Desk' },
  { id: 'neon', label: 'Neon' },
  { id: 'mono', label: 'Mono' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'magma', label: 'Magma' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'gold', label: 'Gold' },
  { id: 'ice', label: 'Ice' },
  { id: 'cyber', label: 'Cyber' },
  { id: 'fuchsia', label: 'Fucsia / Bianco' },
]

export function Viz3DPanel({ exchange, symbol, candles }: Viz3DPanelProps) {
  const [cfg, setCfg] = useState<Viz3DConfig>(() => ({
    ...DEFAULT_VIZ3D_CONFIG,
    dom: { ...DEFAULT_DOM3D_OPTIONS },
  }))
  const [book, setBook] = useState<OrderBook | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const lastPrice = useMarketStore((s) => s.ticker?.lastPrice)

  useEffect(() => {
    const sub = subscribeOrderBookFeed(exchange, symbol, {
      onBook: (b) => {
        if (b.ready) {
          setBook({
            bids: b.bids,
            asks: b.asks,
            lastUpdateId: b.lastUpdateId,
          } as OrderBook)
        }
      },
    })
    return () => sub.unsubscribe()
  }, [exchange, symbol])

  const model = useMemo(
    () => buildViz3DModel(candles, book, cfg, trades),
    [candles, book, cfg, trades]
  )

  const patch = useCallback((p: Partial<Viz3DConfig>) => {
    setCfg((c) => ({ ...c, ...p }))
  }, [])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef]">
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-[#1e2329] shrink-0 flex-wrap">
        <span className="text-[10px] font-semibold text-[#f0b90b] tracking-wide">3D PRO</span>
        <select
          className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px]"
          value={cfg.mode}
          onChange={(e) => patch({ mode: e.target.value as Viz3DConfig['mode'] })}
        >
          <option value="volume_terrain">Terrain</option>
          <option value="candle_columns">Candles</option>
          <option value="book_depth">Book</option>
          <option value="dom_ladder">Deep DOM</option>
        </select>
        <select
          className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px]"
          value={cfg.theme}
          onChange={(e) => patch({ theme: e.target.value as Viz3DConfig['theme'] })}
        >
          {THEME_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {Object.entries(VIZ3D_PRESETS).map(([id, p]) => (
          <button
            key={id}
            type="button"
            className="text-[9px] px-1.5 py-0.5 rounded border border-[#2b3139] hover:border-[#f0b90b]/50"
            onClick={() =>
              setCfg((c) => ({
                ...c,
                ...p.patch,
                dom: p.patch.dom ? { ...DEFAULT_DOM3D_OPTIONS, ...p.patch.dom } : c.dom,
              }))
            }
          >
            {p.label}
          </button>
        ))}
        {lastPrice != null && (
          <span className="text-[10px] text-[#848e9c] ml-auto font-mono">{lastPrice.toFixed(2)}</span>
        )}
      </div>
      <div className="flex-1 min-h-0 relative">
        <Viz3DScene model={model} config={cfg} onCameraChange={patch} className="absolute inset-0" />
      </div>
    </div>
  )
}
