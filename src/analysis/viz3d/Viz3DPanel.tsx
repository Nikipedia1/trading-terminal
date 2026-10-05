/**
 * 3D Pro desk widget — Deep DOM (Deep Chart style): walls + bubbles + full settings.
 */

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import { useMarketStore } from '@/stores/marketStore'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { useChartViewportStore } from '@/stores/chartViewportStore'
import { Viz3DScene } from './Viz3DScene'
import { buildViz3DModel } from './compute'
import {
  DEFAULT_VIZ3D_CONFIG,
  DEFAULT_DOM3D_OPTIONS,
  VIZ3D_PRESETS,
  type Viz3DConfig,
  type Viz3DMode,
  type Dom3DOptions,
} from './types'
import type { Candle } from '@/types'

const MODES: { id: Viz3DMode; label: string }[] = [
  { id: 'volume_terrain', label: 'Volume Terrain' },
  { id: 'candle_columns', label: 'Candles 3D' },
  { id: 'book_depth', label: 'Book Depth' },
  { id: 'dom_ladder', label: 'Deep DOM' },
]

function filterByRange(
  candles: Candle[],
  fromSec: number | null,
  toSec: number | null,
  syncVisible: boolean,
  maxBars: number
): Candle[] {
  if (!syncVisible || fromSec == null || toSec == null || !(toSec > fromSec)) {
    return (candles ?? []).slice(-Math.max(8, maxBars))
  }
  const list = candles ?? []
  const inRange = list.filter((c) => c.time >= fromSec && c.time <= toSec)
  if (inRange.length >= 4) return inRange
  return list.filter((c) => c.time <= toSec).slice(-Math.max(8, maxBars))
}

export function Viz3DPanel() {
  const primaryPanelId = useLayoutStore((s) => s.primaryChartId)
  const panels = useLayoutStore((s) => s.panels)
  const primary = panels.find((p) => p.id === primaryPanelId) ?? panels[0]
  const symbol = primary?.symbol ?? 'BTCUSDT'
  const interval = primary?.interval ?? '1m'
  const exchange = primary?.exchange ?? 'binance'

  const { candles, status } = usePanelMarket(symbol, interval, exchange)
  const book = useMarketStore((s) => s.orderBook)
  const trades = useMarketStore((s) => s.recentTrades)

  const [cfg, setCfg] = useState<Viz3DConfig>(() => ({
    ...DEFAULT_VIZ3D_CONFIG,
    dom: { ...DEFAULT_DOM3D_OPTIONS },
  }))

  const viewport = useChartViewportStore((s) =>
    primaryPanelId ? s.byPanel[primaryPanelId] : undefined
  )
  const fromSec = viewport?.fromSec ?? null
  const toSec = viewport?.toSec ?? null

  const scopedCandles = useMemo(
    () => filterByRange(candles ?? [], fromSec, toSec, cfg.syncVisible, cfg.maxBars),
    [candles, fromSec, toSec, cfg.syncVisible, cfg.maxBars]
  )

  const model = useMemo(
    () => buildViz3DModel(scopedCandles, book ?? null, cfg, trades ?? []),
    [scopedCandles, book, cfg, trades]
  )

  const patch = useCallback((p: Partial<Viz3DConfig>) => {
    setCfg((c) => ({ ...c, ...p }))
  }, [])

  const patchDom = useCallback((p: Partial<Dom3DOptions>) => {
    setCfg((c) => ({ ...c, dom: { ...c.dom, ...p } }))
  }, [])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef]">
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-[#1e2329] shrink-0 flex-wrap">
        <span className="text-[10px] font-semibold text-[#f0b90b] tracking-wide">3D PRO</span>
        <span className="text-[10px] text-[#848e9c] font-mono">
          {symbol} · {interval}
        </span>
        <select
          className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px]"
          value={cfg.mode}
          onChange={(e) => patch({ mode: e.target.value as Viz3DMode })}
        >
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px]"
          value={cfg.theme}
          onChange={(e) => patch({ theme: e.target.value as Viz3DConfig['theme'] })}
        >
          <option value="desk">Desk</option>
          <option value="neon">Neon</option>
          <option value="mono">Mono</option>
          <option value="aurora">Aurora</option>
          <option value="magma">Magma</option>
          <option value="ocean">Ocean</option>
          <option value="matrix">Matrix</option>
          <option value="gold">Gold</option>
          <option value="ice">Ice</option>
          <option value="cyber">Cyber</option>
          <option value="fuchsia">Fucsia / Bianco</option>
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
        <label className="flex items-center gap-1 text-[9px] text-[#848e9c] ml-auto">
          <input
            type="checkbox"
            checked={cfg.syncVisible}
            onChange={(e) => patch({ syncVisible: e.target.checked })}
          />
          Sync
        </label>
        <label className="flex items-center gap-1 text-[9px] text-[#848e9c]">
          <input
            type="checkbox"
            checked={cfg.autoRotate}
            onChange={(e) => patch({ autoRotate: e.target.checked })}
          />
          Spin
        </label>
        <span className="text-[9px] text-[#5e6673]">{status}</span>
      </div>
      <div className="flex-1 min-h-0 relative">
        <Viz3DScene model={model} config={cfg} onCameraChange={patch} className="absolute inset-0" />
      </div>
    </div>
  )
}
