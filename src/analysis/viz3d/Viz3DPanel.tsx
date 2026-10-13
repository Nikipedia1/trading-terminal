/**
 * 3D Pro desk widget — Deep DOM (Deep Chart style): walls + bubbles + full settings.
 * Live sync badge shows when chartViewportStore range is linked.
 */

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
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
} from './types'
import { VIZ3D_THEMES } from './themes'
import { Viz3DDrawOverlay } from './Viz3DDrawOverlay'
import type { Candle } from '@/types'
import type { Drawing } from '@/drawings/types'

const MODES: { id: Viz3DMode; label: string }[] = [
  { id: 'volume_terrain', label: 'Volume Terrain' },
  { id: 'candle_columns', label: 'Candles 3D' },
  { id: 'book_depth', label: 'Book Depth' },
  { id: 'dom_ladder', label: 'Deep DOM' },
]

function filterByRange(
  candles: Candle[] | undefined | null,
  fromSec: number | null,
  toSec: number | null,
  syncVisible: boolean,
  maxBars: number
): Candle[] {
  const list = candles ?? []
  if (!syncVisible || fromSec == null || toSec == null || !(toSec > fromSec)) {
    return list.slice(-Math.max(8, maxBars))
  }
  const inRange = list.filter((c) => c.time >= fromSec && c.time <= toSec)
  if (inRange.length >= 4) return inRange
  return list.filter((c) => c.time <= toSec).slice(-Math.max(8, maxBars))
}

function fmtRange(fromSec: number | null, toSec: number | null): string {
  if (fromSec == null || toSec == null) return '—'
  const a = new Date(fromSec * 1000)
  const b = new Date(toSec * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(a.getHours())}:${pad(a.getMinutes())}→${pad(b.getHours())}:${pad(b.getMinutes())}`
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
  const crosshairTime = useChartViewportStore((s) => s.crosshairTime)
  const vpSymbol = useChartViewportStore((s) => s.symbol)
  const vpInterval = useChartViewportStore((s) => s.interval)
  const rev = useChartViewportStore((s) => s.rev)

  const sceneWrapRef = useRef<HTMLDivElement>(null)
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [cfg, setCfg] = useState<Viz3DConfig>(() => ({
    ...DEFAULT_VIZ3D_CONFIG,
    syncVisible: true,
    dom: { ...DEFAULT_DOM3D_OPTIONS },
  }))

  const patch = useCallback((p: Partial<Viz3DConfig>) => {
    setCfg((c) => ({ ...c, ...p }))
  }, [])

  const scopedCandles = useMemo(
    () => filterByRange(candles, fromSec, toSec, cfg.syncVisible, cfg.maxBars),
    [candles, fromSec, toSec, cfg.syncVisible, cfg.maxBars, rev]
  )

  const model = useMemo(
    () => buildViz3DModel(scopedCandles, book ?? null, cfg, trades ?? []),
    [scopedCandles, book, cfg, trades]
  )

  useEffect(() => {
    useChartViewportStore.getState().setViewport({
      panelId: primaryPanelId,
      symbol,
      interval,
    })
  }, [primaryPanelId, symbol, interval])

  const themeBg = (VIZ3D_THEMES[cfg.theme as keyof typeof VIZ3D_THEMES] ?? VIZ3D_THEMES.desk).bg

  const rangeLinked =
    cfg.syncVisible && fromSec != null && toSec != null && toSec > fromSec
  const instrumentMatch =
    !vpSymbol || !vpInterval || (vpSymbol === symbol && vpInterval === interval)
  const liveOk = status === 'connected'

  return (
    <div
      className="h-full w-full flex flex-col min-h-0 text-[#eaecef] transition-colors duration-300"
      style={{ backgroundColor: themeBg }}
    >
      <div className="shrink-0 flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b border-[#2b3139]">
        <span className="text-[10px] font-semibold tracking-wide text-[#f0b90b] uppercase">
          3D Pro
        </span>
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

        {/* Sync control + status */}
        <label
          className={`flex items-center gap-1 text-[9px] ml-auto px-1.5 py-0.5 rounded border cursor-pointer ${
            rangeLinked
              ? 'border-[#0ecb81]/60 bg-[#0ecb81]/10 text-[#0ecb81]'
              : cfg.syncVisible
                ? 'border-[#f0b90b]/50 bg-[#f0b90b]/10 text-[#f0b90b]'
                : 'border-[#2b3139] text-[#848e9c]'
          }`}
          title={
            rangeLinked
              ? `Sincronizzato col chart: ${fmtRange(fromSec, toSec)}`
              : cfg.syncVisible
                ? 'Sync ON — in attesa del range del chart primario (zoom/pan sul chart)'
                : 'Sync OFF — mostra solo ultime barre'
          }
        >
          <input
            type="checkbox"
            checked={cfg.syncVisible}
            onChange={(e) => patch({ syncVisible: e.target.checked })}
          />
          {rangeLinked ? (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0ecb81] animate-pulse" />
              SYNC LIVE · {fmtRange(fromSec, toSec)}
            </>
          ) : cfg.syncVisible ? (
            <>SYNC · waiting chart</>
          ) : (
            <>Sync off</>
          )}
        </label>

        <label className="flex items-center gap-1 text-[9px] text-[#848e9c]">
          <input
            type="checkbox"
            checked={cfg.autoRotate}
            onChange={(e) => patch({ autoRotate: e.target.checked })}
          />
          Spin
        </label>

        <span
          className={`text-[9px] font-mono ${
            liveOk ? 'text-[#0ecb81]' : 'text-[#5e6673]'
          }`}
          title={!instrumentMatch ? 'Simbolo/TF chart diverso dal 3D' : undefined}
        >
          {liveOk ? '● LIVE' : `○ ${String(status)}`} · {scopedCandles.length} bars
          {drawings.length > 0 ? ` · ${drawings.length} draw` : ''}
          {crosshairTime != null ? ' · ✛' : ''}
        </span>
      </div>
      <div ref={sceneWrapRef} className="flex-1 min-h-0 relative">
        <Viz3DScene
          model={model}
          config={cfg}
          drawings={drawings}
          onCameraChange={patch}
          className="absolute inset-0"
        />
        <Viz3DDrawOverlay
          symbol={symbol}
          model={model}
          containerRef={sceneWrapRef}
          onDrawingsChange={setDrawings}
        />
      </div>
    </div>
  )
}
