/**
 * ChartPanel – one draggable/resizable chart unit.
 */

import { ChartContainer } from './ChartContainer'
import { ConnectionBadge } from './ConnectionBadge'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { useLayoutStore } from '@/stores/layoutStore'
import { useChartStyleStore } from '@/stores/chartStyleStore'
import { DrawingToolbar } from '@/drawings/DrawingToolbar'
import { SUPPORTED_EXCHANGES } from '@/data/exchanges/registry'
import type { ChartPanelConfig, Interval, ExchangeId } from '@/types'

const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d']

interface ChartPanelProps {
  config: ChartPanelConfig
}

export function ChartPanel({ config }: ChartPanelProps) {
  const { id, symbol, interval, exchange, syncGroup } = config
  const updatePanel = useLayoutStore((s) => s.updatePanel)
  const removePanel = useLayoutStore((s) => s.removePanel)
  const setPrimaryPanel = useLayoutStore((s) => s.setPrimaryPanel)
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const panelCount = useLayoutStore((s) => s.panels.length)
  const toggleStylePanel = useChartStyleStore((s) => s.togglePanel)
  const stylePanelOpen = useChartStyleStore((s) => s.panelOpen)

  const { candles, status, lastError, statusDetail, reload } = usePanelMarket(
    symbol,
    interval,
    exchange
  )

  const isPrimary = primaryPanelId === id

  return (
    <div className="h-full w-full flex flex-col bg-terminal-panel border border-terminal-border rounded-sm overflow-hidden">
      <div className="panel-drag-handle flex items-center gap-2 px-2 py-1 border-b border-terminal-border bg-terminal-bg shrink-0 cursor-move select-none min-h-[28px]">
        <input
          className="bg-terminal-panel border border-terminal-border rounded px-1.5 py-0.5 text-xxs w-24 font-mono-nums"
          value={symbol}
          onChange={(e) => updatePanel(id, { symbol: e.target.value.toUpperCase() })}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
        <select
          className="bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs"
          value={interval}
          onChange={(e) => updatePanel(id, { interval: e.target.value as Interval })}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {INTERVALS.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
        <select
          className="bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs"
          value={exchange}
          onChange={(e) => updatePanel(id, { exchange: e.target.value as ExchangeId })}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {SUPPORTED_EXCHANGES.map((ex) => (
            <option key={ex} value={ex}>{ex}</option>
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
          className={`text-xxs px-1.5 py-0.5 rounded ${isPrimary ? 'bg-terminal-blue/30 text-terminal-blue' : 'text-terminal-muted hover:text-terminal-text'}`}
          title="Primary panel"
          onClick={(e) => {
            e.stopPropagation()
            setPrimaryPanel(id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {isPrimary ? '★' : '☆'}
        </button>

        <button
          type="button"
          title="Personalizza candele e canvas"
          className={`text-xxs px-1.5 py-0.5 rounded border ${
            stylePanelOpen
              ? 'bg-terminal-blue/30 text-terminal-blue border-terminal-blue/50'
              : 'text-terminal-muted border-terminal-border hover:text-terminal-text'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            toggleStylePanel()
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          🎨 Stile
        </button>

        <div className="ml-auto flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          <ConnectionBadge status={status} detail={statusDetail} />
          {(status === 'error' || status === 'disconnected') && (
            <button
              type="button"
              className="text-xxs px-1.5 py-0.5 border border-terminal-border rounded hover:bg-terminal-hover"
              title="Ricarica storico + WS"
              onClick={(e) => {
                e.stopPropagation()
                reload()
              }}
            >
              Retry
            </button>
          )}
        </div>

        {panelCount > 1 && (
          <button
            className="text-terminal-red/80 hover:text-terminal-red text-xs px-1"
            title="Remove panel"
            onClick={(e) => {
              e.stopPropagation()
              removePanel(id)
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            −
          </button>
        )}
      </div>

      {/* Explicit error banner – never silent, never fake data */}
      {lastError && (
        <div className="shrink-0 px-2 py-1 text-xxs bg-terminal-red/10 text-terminal-red border-b border-terminal-red/30">
          <strong>[{lastError.code}]</strong> {lastError.message}
          {lastError.exchange ? ` · ${lastError.exchange}` : ''}
        </div>
      )}

      <div className="shrink-0 min-h-[30px] border-b border-terminal-border bg-terminal-bg z-10">
        <DrawingToolbar panelId={id} symbol={symbol} />
      </div>

      <div className="flex-1 min-h-0 relative">
        <ChartContainer
          panelId={id}
          symbol={symbol}
          candles={candles}
          status={status}
          lastError={lastError}
          syncGroup={syncGroup}
        />
      </div>
    </div>
  )
}
