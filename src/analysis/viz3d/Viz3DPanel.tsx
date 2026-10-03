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
    return candles.slice(-Math.max(8, maxBars))
  }
  const inRange = candles.filter((c) => c.time >= fromSec && c.time <= toSec)
  if (inRange.length >= 4) return inRange
  return candles.filter((c) => c.time <= toSec).slice(-Math.max(8, maxBars))
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
  const trades = useMarketStore((s) => s.trades)

  const fromSec = useChartViewportStore((s) => s.fromSec)
  const toSec = useChartViewportStore((s) => s.toSec)
  const crosshairPrice = useChartViewportStore((s) => s.crosshairPrice)

  const [cfg, setCfg] = useState<Viz3DConfig>(() => ({
    ...DEFAULT_VIZ3D_CONFIG,
    syncVisible: true,
    dom: { ...DEFAULT_DOM3D_OPTIONS },
  }))
  const [settingsOpen, setSettingsOpen] = useState(false)

  const patch = useCallback((p: Partial<Viz3DConfig>) => {
    setCfg((c) => ({ ...c, ...p }))
  }, [])

  const patchDom = useCallback((p: Partial<Dom3DOptions>) => {
    setCfg((c) => ({
      ...c,
      dom: { ...(c.dom ?? DEFAULT_DOM3D_OPTIONS), ...p },
    }))
  }, [])

  const scopedCandles = useMemo(
    () => filterByRange(candles, fromSec, toSec, cfg.syncVisible, cfg.maxBars),
    [candles, fromSec, toSec, cfg.syncVisible, cfg.maxBars]
  )

  const model = useMemo(
    () => buildViz3DModel(scopedCandles, book, cfg, trades),
    [scopedCandles, book, cfg, trades]
  )

  useEffect(() => {
    useChartViewportStore.getState().setViewport({
      panelId: primaryPanelId,
      symbol,
      interval,
    })
  }, [primaryPanelId, symbol, interval])

  const isDom = cfg.mode === 'dom_ladder' || cfg.mode === 'book_depth'
  const dom = cfg.dom ?? DEFAULT_DOM3D_OPTIONS
  const syncLabel = isDom
    ? book
      ? `L2 LIVE · ${model.dom?.length ?? 0} lv · ${model.bubbles?.length ?? 0} ●`
      : 'Waiting L2…'
    : cfg.syncVisible && fromSec != null
      ? `SYNC · ${scopedCandles.length} bars`
      : status === 'connected'
        ? `LIVE · ${scopedCandles.length} bars`
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
              onClick={() => {
                patch({ mode: m.id })
                if (m.id === 'dom_ladder') setSettingsOpen(true)
              }}
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
        {cfg.mode === 'dom_ladder' && (
          <button
            type="button"
            className={`text-[10px] px-1.5 py-0.5 rounded border ${
              settingsOpen
                ? 'text-[#f0b90b] border-[#f0b90b]/50'
                : 'text-[#848e9c] border-[#2b3139]'
            }`}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            Settings
          </button>
        )}
        <label className="flex items-center gap-1 text-[10px] text-[#848e9c] ml-auto cursor-pointer">
          <input
            type="checkbox"
            className="accent-[#0ecb81]"
            checked={cfg.syncVisible}
            onChange={(e) => patch({ syncVisible: e.target.checked })}
          />
          Sync
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
          Reset
        </button>
      </div>

      {settingsOpen && cfg.mode === 'dom_ladder' && (
        <div className="shrink-0 px-2 py-1.5 border-b border-[#2b3139] bg-[#0d1118] flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-[#848e9c]">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" className="accent-[#0ecb81]" checked={dom.showWalls} onChange={(e) => patchDom({ showWalls: e.target.checked })} />
            Walls
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" className="accent-[#f0b90b]" checked={dom.showBubbles} onChange={(e) => patchDom({ showBubbles: e.target.checked })} />
            Bubbles
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" className="accent-[#60a5fa]" checked={dom.showBubbleLabels} onChange={(e) => patchDom({ showBubbleLabels: e.target.checked })} />
            Labels
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" className="accent-[#f0b90b]" checked={dom.showMid} onChange={(e) => patchDom({ showMid: e.target.checked })} />
            Mid
          </label>
          <span className="text-[#5e6673]">|</span>
          <label className="flex items-center gap-1">
            Levels
            <input type="range" min={10} max={50} value={dom.levels} className="w-14 accent-[#f0b90b]" onChange={(e) => { const v = Number(e.target.value); patchDom({ levels: v }); patch({ domLevels: v }) }} />
            <span className="font-mono w-5">{dom.levels}</span>
          </label>
          <label className="flex items-center gap-1">
            Agg
            {([1, 5, 10] as const).map((t) => (
              <button key={t} type="button" className={`px-1 rounded border ${dom.tickAgg === t ? 'border-[#f0b90b]/50 text-[#f0b90b]' : 'border-[#2b3139] text-[#5e6673]'}`} onClick={() => patchDom({ tickAgg: t })}>
                {t}t
              </button>
            ))}
          </label>
          <label className="flex items-center gap-1">
            Min wall
            <input type="number" min={0} step="any" className="w-12 bg-[#12161c] border border-[#2b3139] rounded px-1 text-[10px] text-[#eaecef]" value={dom.minLevelSize} onChange={(e) => patchDom({ minLevelSize: Number(e.target.value) || 0 })} />
          </label>
          <label className="flex items-center gap-1">
            Min bubble $
            <input type="number" min={0} step={500} className="w-16 bg-[#12161c] border border-[#2b3139] rounded px-1 text-[10px] text-[#eaecef]" value={dom.minBubbleQuote} onChange={(e) => patchDom({ minBubbleQuote: Number(e.target.value) || 0 })} />
          </label>
          <label className="flex items-center gap-1">
            Bubble size
            <input type="range" min={0.4} max={2} step={0.1} value={dom.bubbleScale} className="w-14 accent-[#0ecb81]" onChange={(e) => patchDom({ bubbleScale: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-1">
            Max ●
            <input type="range" min={20} max={150} value={dom.maxBubbles} className="w-14 accent-[#60a5fa]" onChange={(e) => patchDom({ maxBubbles: Number(e.target.value) })} />
            <span className="font-mono w-6">{dom.maxBubbles}</span>
          </label>
          <label className="flex items-center gap-1">
            Cluster ms
            <input type="number" min={50} max={2000} step={50} className="w-14 bg-[#12161c] border border-[#2b3139] rounded px-1 text-[10px] text-[#eaecef]" value={dom.clusterMs} onChange={(e) => patchDom({ clusterMs: Number(e.target.value) || 200 })} />
          </label>
          <label className="flex items-center gap-1">
            Wall α
            <input type="range" min={0.2} max={1} step={0.05} value={dom.wallOpacity} className="w-12 accent-[#0ecb81]" onChange={(e) => patchDom({ wallOpacity: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-1">
            Bubble α
            <input type="range" min={0.2} max={1} step={0.05} value={dom.bubbleOpacity} className="w-12 accent-[#f6465d]" onChange={(e) => patchDom({ bubbleOpacity: Number(e.target.value) })} />
          </label>
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        <Viz3DScene model={model} config={cfg} onCameraChange={patch} />
      </div>

      <div className="shrink-0 flex flex-wrap items-center gap-3 px-2 py-1 border-t border-[#2b3139] text-[10px] text-[#5e6673]">
        {!isDom && (
          <label className="flex items-center gap-1">
            Bars
            <input type="range" min={20} max={150} value={cfg.maxBars} className="w-16 accent-[#f0b90b]" onChange={(e) => patch({ maxBars: Number(e.target.value) })} />
          </label>
        )}
        {cfg.mode === 'volume_terrain' && (
          <label className="flex items-center gap-1">
            Bins
            <input type="range" min={12} max={48} value={cfg.priceBins} className="w-14 accent-[#60a5fa]" onChange={(e) => patch({ priceBins: Number(e.target.value) })} />
          </label>
        )}
        <label className="flex items-center gap-1">
          Opacity
          <input type="range" min={0.3} max={1} step={0.05} value={cfg.opacity} className="w-14 accent-[#0ecb81]" onChange={(e) => patch({ opacity: Number(e.target.value) })} />
        </label>
        <select className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px] text-[#eaecef]" value={cfg.theme} onChange={(e) => patch({ theme: e.target.value as Viz3DConfig['theme'] })}>
          <option value="desk">Desk</option>
          <option value="neon">Neon</option>
          <option value="mono">Mono</option>
        </select>
        <span className="ml-auto text-[9px]">
          {crosshairPrice != null ? `XH ${crosshairPrice.toFixed(2)}` : cfg.mode === 'dom_ladder' ? 'Deep DOM · real L2 + trades' : 'live ↔ chart'}
        </span>
      </div>
    </div>
  )
}
