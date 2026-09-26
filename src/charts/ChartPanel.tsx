/**
 * ChartPanel – one draggable/resizable chart unit.
 */

import { useState } from 'react'
import { ChartContainer } from './ChartContainer'
import { ConnectionBadge } from './ConnectionBadge'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { useLayoutStore } from '@/stores/layoutStore'
import { useChartStyleStore } from '@/stores/chartStyleStore'
import { useDrawingStore } from '@/drawings/drawingStore'
import { DrawingToolbar } from '@/drawings/DrawingToolbar'
import { SUPPORTED_EXCHANGES } from '@/data/exchanges/registry'
import {
  type ProfileWindow,
  PROFILE_WINDOW_LABELS,
} from '@/analysis/volumeProfile'
import {
  type DeepTradesConfig,
  type ThresholdMode,
  DEFAULT_DEEP_TRADES_CONFIG,
} from '@/analysis/deepTrades'
import {
  type DeepDomConfig,
  DEFAULT_DEEP_DOM_CONFIG,
  L2_GRANULARITY_NOTES,
} from '@/analysis/deepDom'
import type { ChartPanelConfig, Interval, ExchangeId } from '@/types'

const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d']

const PROFILE_WINDOWS: ProfileWindow[] = [
  'visible',
  'session',
  'last_30m',
  'session_open_30m',
]

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
  const [deepPrint, setDeepPrint] = useState(false)
  const [deltaOn, setDeltaOn] = useState(false)
  const [profileOn, setProfileOn] = useState(false)
  const [profileWindow, setProfileWindow] = useState<ProfileWindow>('visible')
  const [tradesOn, setTradesOn] = useState(false)
  const [tradesCfg, setTradesCfg] = useState<DeepTradesConfig>(DEFAULT_DEEP_TRADES_CONFIG)
  const [domOn, setDomOn] = useState(false)
  const [domCfg, setDomCfg] = useState<DeepDomConfig>(DEFAULT_DEEP_DOM_CONFIG)

  const { candles, status, lastError, statusDetail, reload } = usePanelMarket(
    symbol,
    interval,
    exchange
  )

  const isPrimary = primaryPanelId === id

  const toggleDeepPrint = () => {
    setDeepPrint((v) => {
      const next = !v
      if (next) setActiveTool('pan')
      return next
    })
  }

  return (
    <div className="h-full w-full flex flex-col bg-terminal-panel border border-terminal-border rounded-sm overflow-hidden">
      <div className="panel-drag-handle flex flex-wrap items-center gap-2 px-2 py-1 border-b border-terminal-border bg-terminal-bg shrink-0 cursor-move select-none min-h-[28px]">
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

      <div className="shrink-0 min-h-[30px] border-b border-terminal-border bg-terminal-bg z-10 flex items-center flex-wrap gap-1">
        <button
          type="button"
          className={`ml-2 shrink-0 px-2 py-0.5 text-xs rounded border font-medium ${
            deepPrint
              ? 'bg-terminal-blue text-white border-terminal-blue'
              : 'text-terminal-text border-terminal-border hover:bg-terminal-hover'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            toggleDeepPrint()
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          Print
        </button>
        <button
          type="button"
          className={`shrink-0 px-2 py-0.5 text-xs rounded border font-medium ${
            deltaOn
              ? 'bg-terminal-blue text-white border-terminal-blue'
              : 'text-terminal-text border-terminal-border hover:bg-terminal-hover'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            setDeltaOn((v) => !v)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          Delta
        </button>
        <button
          type="button"
          className={`shrink-0 px-2 py-0.5 text-xs rounded border font-medium ${
            profileOn
              ? 'bg-terminal-blue text-white border-terminal-blue'
              : 'text-terminal-text border-terminal-border hover:bg-terminal-hover'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            setProfileOn((v) => !v)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          Profile
        </button>
        {profileOn && (
          <select
            className="bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs"
            value={profileWindow}
            onChange={(e) => setProfileWindow(e.target.value as ProfileWindow)}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {PROFILE_WINDOWS.map((w) => (
              <option key={w} value={w}>
                {PROFILE_WINDOW_LABELS[w]}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          title="Deep Trades"
          className={`shrink-0 px-2 py-0.5 text-xs rounded border font-medium ${
            tradesOn
              ? 'bg-terminal-blue text-white border-terminal-blue'
              : 'text-terminal-text border-terminal-border hover:bg-terminal-hover'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            setTradesOn((v) => !v)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          Trades
        </button>
        {tradesOn && (
          <>
            <select
              className="bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs"
              value={tradesCfg.mode}
              onChange={(e) =>
                setTradesCfg((c) => ({ ...c, mode: e.target.value as ThresholdMode }))
              }
              onMouseDown={(e) => e.stopPropagation()}
            >
              <option value="percentile">Percentile</option>
              <option value="fixed">Fixed min</option>
            </select>
            {tradesCfg.mode === 'percentile' ? (
              <input
                type="number"
                min={50}
                max={99}
                className="w-12 bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs"
                value={tradesCfg.percentile}
                onChange={(e) =>
                  setTradesCfg((c) => ({
                    ...c,
                    percentile: Number(e.target.value) || 90,
                  }))
                }
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : (
              <input
                type="number"
                min={0}
                step="any"
                className="w-16 bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs"
                value={tradesCfg.fixedMin}
                onChange={(e) =>
                  setTradesCfg((c) => ({
                    ...c,
                    fixedMin: Number(e.target.value) || 0,
                  }))
                }
                onMouseDown={(e) => e.stopPropagation()}
              />
            )}
          </>
        )}
        <button
          type="button"
          title={L2_GRANULARITY_NOTES[exchange] || 'DeepDom L2 heatmap'}
          className={`shrink-0 px-2 py-0.5 text-xs rounded border font-medium ${
            domOn
              ? 'bg-terminal-blue text-white border-terminal-blue'
              : 'text-terminal-text border-terminal-border hover:bg-terminal-hover'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            setDomOn((v) => !v)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          Dom
        </button>
        {domOn && (
          <input
            type="number"
            min={1}
            max={30}
            className="w-12 bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs"
            title="Finestra scorrevole (minuti)"
            value={domCfg.windowMinutes}
            onChange={(e) =>
              setDomCfg((c) => ({
                ...c,
                windowMinutes: Math.max(1, Number(e.target.value) || 5),
              }))
            }
            onMouseDown={(e) => e.stopPropagation()}
          />
        )}
        <span className="w-px h-4 bg-terminal-border mx-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <DrawingToolbar panelId={id} symbol={symbol} />
        </div>
      </div>

      {(deepPrint || deltaOn || profileOn || tradesOn || domOn) && (
        <div className="shrink-0 px-2 py-0.5 text-xxs bg-terminal-blue/10 text-terminal-blue border-b border-terminal-blue/30">
          {deepPrint && 'Print · '}
          {deltaOn && 'Delta · '}
          {profileOn && `Profile · `}
          {tradesOn && 'Trades · '}
          {domOn &&
            `Dom (${domCfg.windowMinutes}m) – ${L2_GRANULARITY_NOTES[exchange] || 'L2'}`}
        </div>
      )}

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
          deepPrintEnabled={deepPrint}
          deltaEnabled={deltaOn}
          profileEnabled={profileOn}
          profileWindow={profileWindow}
          deepTradesEnabled={tradesOn}
          deepTradesConfig={tradesCfg}
          deepDomEnabled={domOn}
          deepDomConfig={domCfg}
        />
      </div>
    </div>
  )
}
