/**
 * ChartPanel – one draggable/resizable chart unit.
 * Independent symbol / interval / exchange + optional sync group.
 */

import { ChartContainer } from './ChartContainer'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { useLayoutStore } from '@/stores/layoutStore'
import type { ChartPanelConfig, Interval, ExchangeId } from '@/types'

const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d']
const EXCHANGES: ExchangeId[] = ['binance']

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

  const { candles, status, lastError } = usePanelMarket(symbol, interval, exchange)

  const isPrimary = primaryPanelId === id

  return (
    <div className="h-full flex flex-col bg-terminal-panel border border-terminal-border rounded-sm overflow-hidden">
      {/* Header – drag handle via .panel-drag-handle class for grid */}
      <div className="panel-drag-handle flex items-center gap-2 px-2 py-1 border-b border-terminal-border bg-terminal-bg/80 shrink-0 cursor-move select-none">
        <input
          className="bg-terminal-bg border border-terminal-border rounded px-1.5 py-0.5 text-xxs w-24 font-mono-nums"
          value={symbol}
          onChange={(e) => updatePanel(id, { symbol: e.target.value.toUpperCase() })}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
        <select
          className="bg-terminal-bg border border-terminal-border rounded px-1 py-0.5 text-xxs"
          value={interval}
          onChange={(e) => updatePanel(id, { interval: e.target.value as Interval })}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {INTERVALS.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
        <select
          className="bg-terminal-bg border border-terminal-border rounded px-1 py-0.5 text-xxs"
          value={exchange}
          onChange={(e) => updatePanel(id, { exchange: e.target.value as ExchangeId })}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {EXCHANGES.map((ex) => (
            <option key={ex} value={ex}>{ex}</option>
          ))}
        </select>

        {/* Sync group */}
        <select
          className="bg-terminal-bg border border-terminal-border rounded px-1 py-0.5 text-xxs"
          title="Sync group (crosshair + time zoom)"
          value={syncGroup ?? ''}
          onChange={(e) =>
            updatePanel(id, { syncGroup: e.target.value || null })
          }
          onMouseDown={(e) => e.stopPropagation()}
        >
          <option value="">No sync</option>
          <option value="A">Sync A</option>
          <option value="B">Sync B</option>
          <option value="C">Sync C</option>
        </select>

        <button
          className={`text-xxs px-1.5 py-0.5 rounded ${isPrimary ? 'bg-terminal-blue/30 text-terminal-blue' : 'text-terminal-muted hover:text-terminal-text'}`}
          title="Set as primary (feeds trades / order book)"
          onClick={(e) => {
            e.stopPropagation()
            setPrimaryPanel(id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {isPrimary ? '★' : '☆'}
        </button>

        <span className="text-xxs text-terminal-muted ml-auto truncate">
          {status}
        </span>

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

      <div className="flex-1 min-h-0">
        <ChartContainer
          panelId={id}
          candles={candles}
          status={status}
          lastError={lastError}
          syncGroup={syncGroup}
        />
      </div>
    </div>
  )
}
