/**
 * ChartPanel – chart unit with compact Orderflow menu.
 * Full trading pair (e.g. BTCUSDT) always visible in header.
 */

import { useState, type MouseEvent } from 'react'
import { ChartContainer } from './ChartContainer'
import { ConnectionBadge } from './ConnectionBadge'
import { OrderflowMenu, type OrderflowState } from './OrderflowMenu'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { useLayoutStore } from '@/stores/layoutStore'
import { useChartStyleStore } from '@/stores/chartStyleStore'
import { useDrawingStore } from '@/drawings/drawingStore'
import { DrawingToolbar } from '@/drawings/DrawingToolbar'
import { SUPPORTED_EXCHANGES, EXCHANGE_LABELS } from '@/data/exchanges/registry'
import { DEFAULT_DEEP_TRADES_CONFIG } from '@/analysis/deepTrades'
import { DEFAULT_DEEP_DOM_CONFIG } from '@/analysis/deepDom'
import { DEFAULT_DELTA_CONFIG } from '@/analysis/deltaPrint'
import { DEFAULT_PROFILE_CONFIG } from '@/analysis/volumeProfile'
import { detachChartPanel } from '@/layout/detachPanel'
import { SymbolBadge } from '@/ui/SymbolBadge'
import { SYMBOL_PRESETS } from '@/data/symbols'
import { formatSymbolOption } from '@/data/symbolMeta'
import type { ChartPanelConfig, Interval, ExchangeId } from '@/types'

const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d']

interface ChartPanelProps {
  config: ChartPanelConfig
}

export function ChartPanel({ config }: ChartPanelProps) {
  const { id, symbol, interval, exchange, syncGroup } = config
  const updatePanel = useLayoutStore((s) => s.updatePanel)
  const removePanel = useLayoutStore((s) => s.removePanel)
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const setPrimaryPanelId = useLayoutStore((s) => s.setPrimaryPanelId)
  const isPrimary = primaryPanelId === id

  const [ofState, setOfState] = useState<OrderflowState>({
    print: false,
    delta: false,
    deltaCfg: { ...DEFAULT_DELTA_CONFIG },
    profile: false,
    profileCfg: { ...DEFAULT_PROFILE_CONFIG },
    trades: false,
    tradesCfg: { ...DEFAULT_DEEP_TRADES_CONFIG },
    dom: false,
    domCfg: { ...DEFAULT_DEEP_DOM_CONFIG },
    footprint: false,
    replay: false,
  })

  const style = useChartStyleStore((s) => s.style)
  const setActiveTool = useDrawingStore((s) => s.setActiveTool)

  const { candles, status, lastError } = usePanelMarket(symbol, interval, exchange)

  const onDetach = (e: MouseEvent) => {
    e.stopPropagation()
    detachChartPanel({ symbol, interval, exchange })
  }

  return (
    <div className="h-full w-full flex flex-col bg-terminal-panel border border-terminal-border rounded-sm overflow-hidden">
      <div className="panel-drag-handle flex flex-wrap items-center gap-2 px-2 py-1 border-b border-terminal-border bg-terminal-bg shrink-0 cursor-move select-none min-h-[36px]">
        <SymbolBadge symbol={symbol} size="sm" className="mr-1 shrink-0" />
        <input
          className="bg-terminal-panel border border-[#f0b90b]/40 rounded px-1.5 py-0.5 text-xs w-28 font-mono-nums font-semibold text-[#eaecef]"
          value={symbol}
          list={`panel-symbols-${id}`}
          onChange={(e) => updatePanel(id, { symbol: e.target.value.toUpperCase() })}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          title="Trading pair (full symbol)"
        />
        <datalist id={`panel-symbols-${id}`}>
          {SYMBOL_PRESETS.map((pr) => (
            <option key={pr.symbol} value={pr.symbol}>
              {formatSymbolOption(pr.symbol)}
            </option>
          ))}
        </datalist>
        <select
          className="bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs"
          value={interval}
          onChange={(e) => updatePanel(id, { interval: e.target.value as Interval })}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {INTERVALS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <select
          className="bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs max-w-[9rem]"
          value={exchange}
          onChange={(e) => updatePanel(id, { exchange: e.target.value as ExchangeId })}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {SUPPORTED_EXCHANGES.map((ex) => (
            <option key={ex} value={ex}>
              {EXCHANGE_LABELS[ex] ?? ex}
            </option>
          ))}
        </select>

        <select
          className="bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs"
          title="Sync group"
          value={syncGroup ?? ''}
          onChange={(e) => updatePanel(id, { syncGroup: e.target.value || null })}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <option value="">No sync</option>
          <option value="A">Sync A</option>
          <option value="B">Sync B</option>
          <option value="C">Sync C</option>
        </select>

        <button
          className={`text-xxs px-1.5 py-0.5 rounded ${
            isPrimary
              ? 'bg-terminal-blue/30 text-terminal-blue'
              : 'text-terminal-muted hover:text-terminal-text'
          }`}
          title="Primary panel"
          onClick={(e) => {
            e.stopPropagation()
            setPrimaryPanelId(id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          ★
        </button>

        <button
          className="text-xxs px-1.5 py-0.5 rounded text-terminal-muted hover:text-terminal-text"
          title="Stile"
          onClick={(e) => {
            e.stopPropagation()
            setActiveTool('pan')
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          🎨
        </button>

        <button
          className="text-xxs px-1.5 py-0.5 rounded text-terminal-muted hover:text-[#f0b90b]"
          title="Open on second monitor"
          onClick={onDetach}
          onMouseDown={(e) => e.stopPropagation()}
        >
          ⧉
        </button>

        <ConnectionBadge status={status} />

        <button
          className="ml-auto text-xxs px-1.5 py-0.5 rounded text-terminal-red/80 hover:text-terminal-red"
          title="Remove panel"
          onClick={(e) => {
            e.stopPropagation()
            removePanel(id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          −
        </button>
      </div>

      <div className="flex items-center gap-1 px-1 border-b border-terminal-border shrink-0">
        <DrawingToolbar panelId={id} symbol={symbol} />
        <OrderflowMenu state={ofState} onChange={setOfState} />
      </div>

      {lastError && (
        <div className="px-2 py-1 text-xxs text-terminal-red bg-terminal-red/10 shrink-0">
          {lastError.message}
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        <ChartContainer
          panelId={id}
          symbol={symbol}
          interval={interval}
          exchange={exchange}
          candles={candles}
          orderflow={ofState}
          chartStyle={style}
        />
      </div>
    </div>
  )
}
