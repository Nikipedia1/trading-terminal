/**
 * ChartPanel – chart unit with compact Orderflow menu.
 * Orderflow state lives in orderflowStore (persisted via Workspace).
 */

import { ChartContainer } from './ChartContainer'
import { ConnectionBadge } from './ConnectionBadge'
import { OrderflowMenu, type OrderflowState } from './OrderflowMenu'
import { IndicatorsMenu } from './IndicatorsMenu'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { useLayoutStore } from '@/stores/layoutStore'
import { useChartStyleStore } from '@/stores/chartStyleStore'
import { useOrderflowStore } from '@/stores/orderflowStore'
import { useDrawingStore } from '@/drawings/drawingStore'
import { DrawingToolbar } from '@/drawings/DrawingToolbar'
import { SUPPORTED_EXCHANGES } from '@/data/exchanges/registry'
import { SYMBOL_PRESETS, ALL_INTERVALS } from '@/data/symbols'
import type { ChartPanelConfig, Interval, ExchangeId } from '@/types'

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
  const setActiveTool = useDrawingStore((s) => s.setActiveTool)

  const of = useOrderflowStore((s) => s.get(id))
  const patchOfStore = useOrderflowStore((s) => s.patch)
  const setOfStore = useOrderflowStore((s) => s.set)

  const patchOf = (patch: Partial<OrderflowState>) => patchOfStore(id, patch)

  const togglePrint = () => {
    const next = !of.print
    if (next) setActiveTool('pan')
    patchOfStore(id, { print: next })
  }

  // Ensure panel has an entry so export includes defaults once touched
  if (!useOrderflowStore.getState().byPanel[id]) {
    setOfStore(id, of)
  }

  const { candles, status, lastError, statusDetail, reload } = usePanelMarket(
    symbol,
    interval,
    exchange
  )

  const isPrimary = primaryPanelId === id
  const symbolListId = `sym-list-${id}`

  return (
    <div className="h-full w-full flex flex-col bg-terminal-panel border border-terminal-border rounded-sm overflow-hidden">
      <div className="panel-drag-handle flex flex-wrap items-center gap-2 px-2 py-1 border-b border-terminal-border bg-terminal-bg shrink-0 cursor-move select-none min-h-[28px]">
        <input
          className="bg-terminal-panel border border-terminal-border rounded px-1.5 py-0.5 text-xxs w-[7.5rem] font-mono-nums"
          value={symbol}
          list={symbolListId}
          placeholder="BTCUSDT"
          title="Symbol (type or pick from list)"
          onChange={(e) =>
            updatePanel(id, {
              symbol: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
            })
          }
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
        <datalist id={symbolListId}>
          {SYMBOL_PRESETS.map((p) => (
            <option key={p.symbol} value={p.symbol}>
              {p.label} · {p.group}
            </option>
          ))}
        </datalist>

        <select
          className="bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs max-w-[5.5rem]"
          title="Quick symbol"
          value={SYMBOL_PRESETS.some((p) => p.symbol === symbol) ? symbol : ''}
          onChange={(e) => {
            if (e.target.value) updatePanel(id, { symbol: e.target.value })
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <option value="">Pairs…</option>
          {(['Major', 'L1', 'DeFi', 'Meme', 'Other'] as const).map((g) => (
            <optgroup key={g} label={g}>
              {SYMBOL_PRESETS.filter((p) => p.group === g).map((p) => (
                <option key={p.symbol} value={p.symbol}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <select
          className="bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs"
          value={interval}
          title="Timeframe"
          onChange={(e) => updatePanel(id, { interval: e.target.value as Interval })}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {ALL_INTERVALS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>

        <select
          className="bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs"
          value={exchange}
          onChange={(e) => updatePanel(id, { exchange: e.target.value as ExchangeId })}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {SUPPORTED_EXCHANGES.map((ex) => (
            <option key={ex} value={ex}>
              {ex}
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
            setPrimaryPanel(id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {isPrimary ? '★' : '☆'}
        </button>

        <div onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <IndicatorsMenu panelId={id} />
        </div>

        <button
          type="button"
          title="Stile"
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

      {lastError && (
        <div className="shrink-0 px-2 py-1 text-xxs bg-terminal-red/10 text-terminal-red border-b border-terminal-red/30">
          <strong>[{lastError.code}]</strong> {lastError.message}
        </div>
      )}

      <div className="shrink-0 min-h-[30px] border-b border-terminal-border bg-terminal-bg z-10 flex items-center">
        <OrderflowMenu
          state={of}
          exchange={exchange}
          onChange={patchOf}
          onPrintToggle={togglePrint}
        />
        <span className="w-px h-4 bg-terminal-border mx-1.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <DrawingToolbar panelId={id} symbol={symbol} />
        </div>
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
          deepPrintEnabled={of.print}
          deltaEnabled={of.delta}
          deltaConfig={of.deltaCfg}
          profileEnabled={of.profile}
          profileConfig={of.profileCfg}
          deepTradesEnabled={of.trades}
          deepTradesConfig={of.tradesCfg}
          deepDomEnabled={of.dom}
          deepDomConfig={of.domCfg}
          footprintEnabled={of.footprint}
          replayEnabled={of.replay}
          isPrimary={isPrimary}
        />
      </div>
    </div>
  )
}
