/**
 * Professional 3D tools desk widget — live-synced to primary chart viewport.
 * Modes: Volume Terrain · Candles 3D · Book Depth · DOM Ladder.
 * Data: real OHLCV + live L2; range follows chart when Sync on.
 */

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import { useMarketStore } from '@/stores/marketStore'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { useChartViewportStore } from '@/stores/chartViewportStore'
import { useChartFocusStore } from '@/stores/chartFocusStore'
import { Viz3DScene } from './Viz3DScene'
import { buildViz3DModel } from './compute'
import {
  DEFAULT_VIZ3D_CONFIG,
  VIZ3D_PRESETS,
  type Viz3DConfig,
  type Viz3DMode,
} from './types'
import type { Candle } from '@/types'

const MODES: { id: Viz3DMode; label: string }[] = [
  { id: 'volume_terrain', label: 'Volume Terrain' },
  { id: 'candle_columns', label: 'Candles 3D' },
  { id: 'book_depth', label: 'Book Depth' },
  { id: 'dom_ladder', label: 'DOM 3D' },
]

function filterByRange(
  candles: Candle[],
  fromSec: number | null,
  toSec: number | null,
  syncVisible: boolean,
  maxBars: number
): Candle[] {
  if (!syncVisible || fromSec == null || toSec == null || !(toSec > fromSec)) {
    return candles.slice(-Math.max(8, maxBars))
  }
  const inRange = candles.filter((c) => c.time >= fromSec && c.time <= toSec)
  if (inRange.length >= 4) return inRange
  const upto = candles.filter((c) => c.time <= toSec)
  return upto.slice(-Math.max(8, maxBars))
}

export function Viz3DPanel() {
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const panels = useLayoutStore((s) => s.panels)
  const primary = panels.find((p) => p.id === primaryPanelId) ?? panels[0]
  const symbol = primary?.symbol ?? 'BTCUSDT'
  const interval = primary?.interval ?? '1m'
  const exchange = primary?.exchange ?? 'binance'
  const { candles, status } = usePanelMarket(symbol, interval, exchange)
  const book = useMarketStore((s) => s.orderBook)

  const fromSec = useChartViewportStore((s) => s.fromSec)
  const toSec = useChartViewportStore((s) => s.toSec)
  const crosshairPrice = useChartViewportStore((s) => s.crosshairPrice)
  const requestFocus = useChartFocusStore((s) => s.requestFocus)

  const [cfg, setCfg] = useState<Viz3DConfig>(() => ({
    ...DEFAULT_VIZ3D_CONFIG,
    syncVisible: true,
  }))
  const patch = useCallback((p: Partial<Viz3DConfig>) => {
    setCfg((c) => ({ ...c, ...p }))
  }, [])

  const scopedCandles = useMemo(
    () => filterByRange(candles, fromSec, toSec, cfg.syncVisible, cfg.maxBars),
    [candles, fromSec, toSec, cfg.syncVisible, cfg.maxBars]
  )

  const model = useMemo(
    () => buildViz3DModel(scopedCandles, book, cfg),
    [scopedCandles, book, cfg]
  )

  useEffect(() => {
    useChartViewportStore.getState().setViewport({
      panelId: primaryPanelId,
      symbol,
      interval,
    })
  }, [primaryPanelId, symbol, interval])

  void requestFocus

  const isDom = cfg.mode === 'dom_ladder' || cfg.mode === 'book_depth'
  const syncLabel =
    cfg.syncVisible && fromSec != null && toSec != null && !isDom
      ? `SYNC · ${scopedCandles.length} bars in view`
      : isDom
        ? book
          ? `L2 LIVE · ${model.barCount} lv`
          : 'Waiting L2…'
        : status === 'connected'
          ? `LIVE · last ${scopedCandles.length} bars`
          : String(status)

  return (
    <div className="h-full w-full flex flex-col bg-[#0b0e11] min-h-0">
      <div className="shrink-0 flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b border-[#2b3139]">
        <span className="text-[10px] font-semibold tracking-wide text-[#f0b90b] uppercase">
          3D Pro
        </span>
        <span className="text-[10px] text-[#5e6673] font-mono">
          {symbol} · {interval}
        </span>
        <span
          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
            isDom || cfg.syncVisible
              ? 'text-[#0ecb81] border-[#0ecb81]/40'
              : 'text-[#5e6673] border-[#2b3139]'
          }`}
        >
          {syncLabel}
        </span>
        <div className="flex gap-0.5 ml-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                cfg.mode === m.id
                  ? 'bg-[#1e2329] text-[#f0b90b] border-[#f0b90b]/50'
                  : 'text-[#848e9c] border-[#2b3139] hover:text-[#eaecef]'
              }`}
              onClick={() => patch({ mode: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5">
          {Object.entries(VIZ3D_PRESETS).map(([k, p]) => (
            <button
              key={k}
              type="button"
              className="text-[9px] px-1 py-0.5 rounded border border-[#2b3139] text-[#5e6673] hover:text-[#eaecef]"
              onClick={() => patch(p.patch)}
              title={p.label}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-[10px] text-[#848e9c] ml-auto cursor-pointer">
          <input
            type="checkbox"
            className="accent-[#0ecb81]"
            checked={cfg.syncVisible}
            onChange={(e) => patch({ syncVisible: e.target.checked })}
          />
          Sync chart
        </label>
        <label className="flex items-center gap-1 text-[10px] text-[#848e9c] cursor-pointer">
          <input
            type="checkbox"
            className="accent-[#f0b90b]"
            checked={cfg.autoRotate}
            onChange={(e) => patch({ autoRotate: e.target.checked })}
          />
          Auto
        </label>
        <button
          type="button"
          className="text-[10px] px-1.5 py-0.5 rounded border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]"
          onClick={() =>
            patch({
              yaw: DEFAULT_VIZ3D_CONFIG.yaw,
              pitch: DEFAULT_VIZ3D_CONFIG.pitch,
              zoom: DEFAULT_VIZ3D_CONFIG.zoom,
            })
          }
        >
          Reset view
        </button>
      </div>

      <div className="flex-1 min-h-0 relative">
        <Viz3DScene model={model} config={cfg} onCameraChange={patch} />
      </div>

      <div className="shrink-0 flex flex-wrap items-center gap-3 px-2 py-1 border-t border-[#2b3139] text-[10px] text-[#5e6673]">
        {!isDom && (
          <label className="flex items-center gap-1">
            Bars
            <input
              type="range"
              min={20}
              max={150}
              value={cfg.maxBars}
              className="w-16 accent-[#f0b90b]"
              onChange={(e) => patch({ maxBars: Number(e.target.value) })}
            />
            <span className="font-mono text-[#848e9c] w-6">{cfg.maxBars}</span>
          </label>
        )}
        {isDom && (
          <label className="flex items-center gap-1">
            Levels
            <input
              type="range"
              min={10}
              max={50}
              value={cfg.domLevels}
              className="w-16 accent-[#f0b90b]"
              onChange={(e) => patch({ domLevels: Number(e.target.value) })}
            />
            <span className="font-mono text-[#848e9c] w-6">{cfg.domLevels}</span>
          </label>
        )}
        {cfg.mode === 'volume_terrain' && (
          <label className="flex items-center gap-1">
            Bins
            <input
              type="range"
              min={12}
              max={48}
              value={cfg.priceBins}
              className="w-14 accent-[#60a5fa]"
              onChange={(e) => patch({ priceBins: Number(e.target.value) })}
            />
          </label>
        )}
        <label className="flex items-center gap-1">
          Opacity
          <input
            type="range"
            min={0.3}
            max={1}
            step={0.05}
            value={cfg.opacity}
            className="w-14 accent-[#0ecb81]"
            onChange={(e) => patch({ opacity: Number(e.target.value) })}
          />
        </label>
        <select
          className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px] text-[#eaecef]"
          value={cfg.theme}
          onChange={(e) =>
            patch({ theme: e.target.value as Viz3DConfig['theme'] })
          }
        >
          <option value="desk">Desk</option>
          <option value="neon">Neon</option>
          <option value="mono">Mono</option>
        </select>
        <span className="ml-auto text-[9px]">
          {crosshairPrice != null
            ? `XH ${crosshairPrice.toFixed(2)}`
            : isDom
              ? 'DOM · real L2'
              : 'live ↔ chart'}
        </span>
      </div>
    </div>
  )
}
