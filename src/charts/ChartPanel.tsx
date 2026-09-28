/**
 * ChartPanel – one chart unit on the desk grid.
 * Full pair (BTCUSDT) always shown as yellow chip in the header.
 */

import { type MouseEvent } from 'react'
import { ChartContainer } from './ChartContainer'
import { ConnectionBadge } from './ConnectionBadge'
import { OrderflowMenu } from './OrderflowMenu'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { useLayoutStore } from '@/stores/layoutStore'
import { useOrderflowStore } from '@/stores/orderflowStore'
import { useDrawingStore } from '@/drawings/drawingStore'
import { DrawingToolbar } from '@/drawings/DrawingToolbar'
import { SUPPORTED_EXCHANGES, EXCHANGE_LABELS } from '@/data/exchanges/registry'
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
  const setPrimaryPanel = useLayoutStore((s) => s.setPrimaryPanel)
  const isPrimary = primaryPanelId === id

  const ofState = useOrderflowStore((s) => s.get(id))
  const patchOf = useOrderflowStore((s) => s.patch)

  const setActiveTool = useDrawingStore((s) => s.setActiveTool)

  const { candles, status, lastError } = usePanelMarket(symbol, interval, exchange)

  const onDetach = (e: MouseEvent) => {
    e.stopPropagation()
    detachChartPanel({ symbol, interval, exchange })
  }

  return (
    <div className="h-full w-full flex flex-col bg-terminal-panel border border-terminal-border rounded-sm overflow-hidden">
      {/* Header – symbol chip is the primary visual anchor */}
      <div className="panel-drag-handle flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b border-terminal-border bg-[#0b0e11] shrink-0 cursor-move select-none min-h-[40px]">
        <SymbolBadge symbol={symbol} size="md" showName />

        <input
          className="bg-[#12161c] border border-[#f0b90b]/50 rounded px-1.5 py-0.5 text-xs w-[7.5rem] font-mono font-semibold text-[#eaecef]"
          value={symbol}
          list={`panel-symbols-${id}`}
          onChange={(e) => updatePanel(id, { symbol: e.target.value.toUpperCase() })}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          title="Full trading pair"
          aria-label="Symbol"
        />
        <datalist id={`panel-symbols-${id}`}>
          {SYMBOL_PRESETS.map((pr) => (
            <option key={pr.symbol} value={pr.symbol}>
              {formatSymbolOption(pr.symbol)}
            </option>
          ))}
        </datalist>

        <select
          className="bg-[#12161c] border border-terminal-border rounded px-1 py-0.5 text-xxs text-[#eaecef]"
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
          className="bg-[#12161c] border border-terminal-border rounded px-1 py-0.5 text-xxs text-[#eaecef] max-w-[9rem]"
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
          className="bg-[#12161c] border border-terminal-border rounded px-1 py-0.5 text-xxs text-[#eaecef]"
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
          type="button"
          className={`text-xxs px-1.5 py-0.5 rounded ${
            isPrimary
              ? 'bg-terminal-blue/30 text-terminal-blue'
              : 'text-terminal-muted hover:text-terminal-text'
          }`}
          title="Primary panel"
          onClick={(e) => {
            e.stopPropagation()
            setPrimaryPanel(id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          ★
        </button>

        <button
          type="button"
          className="text-xxs px-1.5 py-0.5 rounded text-terminal-muted hover:text-[#f0b90b]"
          title="Open on second monitor"
          onClick={onDetach}
          onMouseDown={(e) => e.stopPropagation()}
        >
          ⧉
        </button>

        <ConnectionBadge status={status} />

        <button
          type="button"
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

      <div className="flex items-center gap-1 px-1 border-b border-terminal-border shrink-0 overflow-x-auto">
        <DrawingToolbar panelId={id} symbol={symbol} />
        <OrderflowMenu
          state={ofState}
          onChange={(next) => patchOf(id, next)}
        />
        <button
          type="button"
          className="text-xxs px-1 text-terminal-muted hover:text-terminal-text"
          title="Reset tool to pan"
          onClick={() => setActiveTool('pan')}
        >
          pan
        </button>
      </div>

      <div className="flex-1 min-h-0 relative">
        <ChartContainer
          panelId={id}
          symbol={symbol}
          exchange={exchange}
          interval={interval}
          candles={candles}
          status={status}
          lastError={lastError}
          syncGroup={syncGroup}
          deepPrintEnabled={ofState.print}
          deltaEnabled={ofState.delta}
          deltaConfig={ofState.deltaCfg}
          profileEnabled={ofState.profile}
          profileConfig={ofState.profileCfg}
          deepTradesEnabled={ofState.trades}
          deepTradesConfig={ofState.tradesCfg}
          deepDomEnabled={ofState.dom}
          deepDomConfig={ofState.domCfg}
          footprintEnabled={ofState.footprint}
          replayEnabled={ofState.replay}
          isPrimary={isPrimary}
        />
      </div>
    </div>
  )
}
