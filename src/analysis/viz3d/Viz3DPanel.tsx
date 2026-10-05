/**
 * 3D Pro desk widget — Deep DOM (Deep Chart style): walls + bubbles + full settings.
 */

import { useMemo, useState, useCallback, useEffect } from 'react'
import type { Candle } from '@/types'
import type { ExchangeId } from '@/types'
import { useChartViewportStore } from '@/stores/chartViewportStore'
import { useMarketStore } from '@/stores/marketStore'
import { subscribeOrderBookFeed } from '@/data/shared'
import { buildViz3DModel } from './buildModel'
import { Viz3DScene } from './Viz3DScene'
import {
  DEFAULT_VIZ3D_CONFIG,
  DEFAULT_DOM3D_OPTIONS,
  VIZ3D_PRESETS,
  type Viz3DConfig,
  type Dom3DOptions,
} from './types'

interface Viz3DPanelProps {
  panelId: string
  exchange: ExchangeId
  symbol: string
  candles: Candle[]
}

export function Viz3DPanel({ panelId, exchange, symbol, candles }: Viz3DPanelProps) {
  const [cfg, setCfg] = useState<Viz3DConfig>(() => ({ ...DEFAULT_VIZ3D_CONFIG, dom: { ...DEFAULT_DOM3D_OPTIONS } }))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bookSnap, setBookSnap] = useState<import('@/data/shared').OrderBookSnapshot | null>(null)

  const visibleRange = useChartViewportStore((s) => s.byPanel[panelId]?.logical)
  const lastPrice = useMarketStore((s) => s.ticker?.lastPrice)

  useEffect(() => {
    const sub = subscribeOrderBookFeed(exchange, symbol, {
      onBook: (b) => {
        if (b.ready) setBookSnap(b)
      },
    })
    return () => sub.unsubscribe()
  }, [exchange, symbol])

  const model = useMemo(
    () =>
      buildViz3DModel({
        mode: cfg.mode,
        candles,
        book: bookSnap,
        visibleRange: cfg.syncVisible ? visibleRange : null,
        maxBars: cfg.maxBars,
        priceBins: cfg.priceBins,
        domLevels: cfg.dom.levels,
        dom: cfg.dom,
        lastPrice: lastPrice ?? null,
      }),
    [cfg, candles, bookSnap, visibleRange, lastPrice]
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
        <select
          className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px] text-[#eaecef]"
          value={cfg.mode}
          onChange={(e) => patch({ mode: e.target.value as Viz3DConfig['mode'] })}
        >
          <option value="volume_terrain">Terrain</option>
          <option value="candle_columns">Candles</option>
          <option value="book_depth">Book</option>
          <option value="dom_ladder">Deep DOM</option>
        </select>
        <select
          className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px] text-[#eaecef]"
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
        </select>
        {Object.entries(VIZ3D_PRESETS).map(([id, p]) => (
          <button
            key={id}
            type="button"
            className="text-[9px] px-1.5 py-0.5 rounded border border-[#2b3139] hover:border-[#f0b90b]/50"
            onClick={() => setCfg((c) => ({ ...c, ...p.patch, dom: p.patch.dom ? { ...DEFAULT_DOM3D_OPTIONS, ...p.patch.dom } : c.dom }))}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className="text-[9px] px-1.5 py-0.5 rounded border border-[#2b3139] hover:border-[#f0b90b]/50 ml-auto"
          onClick={() => setSettingsOpen((v) => !v)}
        >
          {settingsOpen ? 'Hide' : 'Settings'}
        </button>
      </div>
      {settingsOpen && (
        <div className="px-2 py-1.5 border-b border-[#1e2329] text-[10px] grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={cfg.showGrid} onChange={(e) => patch({ showGrid: e.target.checked })} />
            Grid
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={cfg.showLabels} onChange={(e) => patch({ showLabels: e.target.checked })} />
            Labels
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={cfg.autoRotate} onChange={(e) => patch({ autoRotate: e.target.checked })} />
            Auto-rotate
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={cfg.syncVisible} onChange={(e) => patch({ syncVisible: e.target.checked })} />
            Sync chart
          </label>
        </div>
      )}
      <div className="flex-1 min-h-0 relative">
        <Viz3DScene model={model} config={cfg} onCameraChange={patch} className="absolute inset-0" />
      </div>
    </div>
  )
}
