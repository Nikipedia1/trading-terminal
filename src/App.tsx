import { useEffect, useRef, useState, useMemo } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { useUiDensityStore } from '@/stores/uiDensityStore'
import { PanelGrid } from '@/layout/PanelGrid'
import { LargeTradesPanel } from '@/analysis/deepTrades'
import { PaperTradingPanel } from '@/trading/paper'
import { ExecutionBar, useExecutionHotkeys } from '@/trading'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { SYMBOL_PRESETS, ALL_INTERVALS } from '@/data/symbols'
import type { Interval, ExchangeId } from '@/types'
import { WorkspaceMenu, loadWorkspace, applyWorkspace } from '@/workspace'
import { ArchiveMenu } from '@/ui/ArchiveMenu'
import { FuturesMetricsPanel } from '@/ui/FuturesMetricsPanel'
import { FeedHealthHud } from '@/ui/FeedHealthHud'
import { VirtualizedTape } from '@/ui/VirtualizedTape'
import { useGlobalHotkeys, HotkeyHelpOverlay } from '@/ui/hotkeyMap'
import { AlertPanel, startAlertEngine } from '@/alerts'
import { JournalPanel } from '@/journal'
import { ChartPanel } from '@/charts/ChartPanel'
import { EXCHANGE_LABELS } from '@/data/exchanges/registry'

function StatusBadge() {
  const status = useMarketStore((s) => s.status)
  const colors: Record<string, string> = {
    connecting: 'bg-terminal-yellow/20 text-terminal-yellow',
    reconnecting: 'bg-terminal-yellow/20 text-terminal-yellow',
    connected: 'bg-terminal-green/20 text-terminal-green',
    disconnected: 'bg-terminal-muted/20 text-terminal-muted',
    error: 'bg-terminal-red/20 text-terminal-red',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xxs font-medium ${colors[status] || ''}`}>
      {status.toUpperCase()}
    </span>
  )
}

function ErrorBanner() {
  const lastError = useMarketStore((s) => s.lastError)
  const clearError = useMarketStore((s) => s.clearError)
  if (!lastError) return null
  return (
    <div className="bg-terminal-red/10 border border-terminal-red/40 text-terminal-red px-4 py-2 text-sm flex justify-between items-center density-chrome">
      <span>
        <strong>[{lastError.code}]</strong> {lastError.message}
      </span>
      <button onClick={clearError} className="text-xs underline hover:no-underline">
        dismiss
      </button>
    </div>
  )
}

function normalizeSymbol(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function Controls() {
  const marketSymbol = useMarketStore((s) => s.symbol)
  const marketInterval = useMarketStore((s) => s.interval)
  const setSymbol = useMarketStore((s) => s.setSymbol)
  const setIntervalStore = useMarketStore((s) => s.setInterval)
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)
  const stopLive = useMarketStore((s) => s.stopLive)
  const status = useMarketStore((s) => s.status)

  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const panels = useLayoutStore((s) => s.panels)
  const updatePanel = useLayoutStore((s) => s.updatePanel)

  const primary = panels.find((p) => p.id === primaryPanelId) ?? panels[0]
  const symbol = primary?.symbol ?? marketSymbol
  const interval = primary?.interval ?? marketInterval

  const [symbolDraft, setSymbolDraft] = useState(symbol)
  useEffect(() => {
    setSymbolDraft(symbol)
  }, [symbol])

  const applySymbol = (raw: string) => {
    const v = normalizeSymbol(raw)
    if (!v || v === symbol) {
      setSymbolDraft(symbol)
      return
    }
    setSymbol(v)
    updatePanel(primaryPanelId, { symbol: v })
  }

  const applyInterval = (v: Interval) => {
    if (v === interval) return
    setIntervalStore(v)
    updatePanel(primaryPanelId, { interval: v })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-terminal-border bg-terminal-panel density-compact">
      <input
        className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm w-28 font-mono-nums"
        value={symbolDraft}
        list="top-symbol-presets"
        placeholder="BTCUSDT"
        onChange={(e) => setSymbolDraft(normalizeSymbol(e.target.value))}
        onBlur={() => applySymbol(symbolDraft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      <datalist id="top-symbol-presets">
        {SYMBOL_PRESETS.map((p) => (
          <option key={p.symbol} value={p.symbol}>
            {p.label} · {p.group}
          </option>
        ))}
      </datalist>

      <select
        className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm max-w-[7rem]"
        value={SYMBOL_PRESETS.some((p) => p.symbol === symbol) ? symbol : ''}
        onChange={(e) => {
          if (e.target.value) applySymbol(e.target.value)
        }}
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
        className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm"
        value={interval}
        onChange={(e) => applyInterval(e.target.value as Interval)}
      >
        {ALL_INTERVALS.map((i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>

      <button
        onClick={() => loadHistorical()}
        className="px-3 py-1 bg-terminal-blue/20 text-terminal-blue rounded text-sm hover:bg-terminal-blue/30 density-chrome"
      >
        Load History
      </button>
      {status === 'connected' || status === 'connecting' || status === 'reconnecting' ? (
        <button
          onClick={stopLive}
          className="px-3 py-1 bg-terminal-red/20 text-terminal-red rounded text-sm hover:bg-terminal-red/30"
        >
          Stop Live
        </button>
      ) : (
        <button
          onClick={startLive}
          className="px-3 py-1 bg-terminal-green/20 text-terminal-green rounded text-sm hover:bg-terminal-green/30"
        >
          Start Live
        </button>
      )}
      <StatusBadge />
    </div>
  )
}

function TradesTape() {
  const trades = useMarketStore((s) => s.trades)
  return <VirtualizedTape trades={trades} />
}

function OrderBookView() {
  const book = useMarketStore((s) => s.orderBook)
  if (!book) {
    return <div className="p-4 text-terminal-muted text-sm">No order book.</div>
  }
  const maxQty = Math.max(
    ...book.bids.slice(0, 10).map((l) => l.qty),
    ...book.asks.slice(0, 10).map((l) => l.qty),
    0.0001
  )
  return (
    <div className="overflow-auto h-full text-xxs font-mono-nums">
      <div className="grid grid-cols-2 gap-1 px-2">
        <div>
          <div className="text-terminal-muted mb-1">Bids</div>
          {book.bids.slice(0, 12).map((l) => (
            <div key={'b-' + l.price} className="relative flex justify-between py-0.5">
              <div
                className="absolute inset-y-0 right-0 bg-terminal-green/10"
                style={{ width: (l.qty / maxQty) * 100 + '%' }}
              />
              <span className="text-terminal-green relative">{l.price.toFixed(2)}</span>
              <span className="relative">{l.qty.toFixed(4)}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="text-terminal-muted mb-1">Asks</div>
          {book.asks.slice(0, 12).map((l) => (
            <div key={'a-' + l.price} className="relative flex justify-between py-0.5">
              <div
                className="absolute inset-y-0 left-0 bg-terminal-red/10"
                style={{ width: (l.qty / maxQty) * 100 + '%' }}
              />
              <span className="text-terminal-red relative">{l.price.toFixed(2)}</span>
              <span className="relative">{l.qty.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TickerBar() {
  const ticker = useMarketStore((s) => s.ticker)
  if (!ticker) return null
  const up = ticker.priceChangePercent >= 0
  return (
    <div className="flex items-center gap-6 px-4 py-1.5 border-b border-terminal-border text-sm font-mono-nums density-compact">
      <span className="font-semibold">{ticker.symbol}</span>
      <span className={up ? 'text-terminal-green' : 'text-terminal-red'}>
        {ticker.lastPrice.toFixed(2)}
      </span>
      <span className={up ? 'text-terminal-green' : 'text-terminal-red'}>
        {up ? '+' : ''}
        {ticker.priceChangePercent.toFixed(2)}%
      </span>
    </div>
  )
}

function PrimaryLargeTrades() {
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const panels = useLayoutStore((s) => s.panels)
  const primary = panels.find((p) => p.id === primaryPanelId) ?? panels[0]
  const symbol = primary?.symbol ?? 'BTCUSDT'
  const interval = primary?.interval ?? '1m'
  const exchange = primary?.exchange ?? 'binance'
  const { candles } = usePanelMarket(symbol, interval, exchange)
  return (
    <LargeTradesPanel exchange={exchange} symbol={symbol} interval={interval} candles={candles} />
  )
}

type SideTab = 'live' | 'large' | 'book' | 'futures' | 'paper' | 'alerts' | 'journal'

function SidePanel() {
  const [tab, setTab] = useState<SideTab>('paper')
  const tabs: { id: SideTab; label: string }[] = [
    { id: 'paper', label: 'Trade' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'journal', label: 'Journal' },
    { id: 'live', label: 'Tape' },
    { id: 'large', label: 'Large' },
    { id: 'book', label: 'Book' },
    { id: 'futures', label: 'Futures' },
  ]

  return (
    <section className="bg-terminal-panel flex flex-col min-h-0">
      <div className="flex border-b border-terminal-border shrink-0 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`flex-1 px-1 py-1.5 text-xxs uppercase tracking-wider whitespace-nowrap ${
              tab === t.id
                ? 'text-[#f0b90b] border-b-2 border-[#f0b90b]'
                : 'text-terminal-muted hover:text-terminal-text'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'paper' && <PaperTradingPanel />}
        {tab === 'alerts' && <AlertPanel />}
        {tab === 'journal' && <JournalPanel />}
        {tab === 'live' && <TradesTape />}
        {tab === 'large' && <PrimaryLargeTrades />}
        {tab === 'book' && <OrderBookView />}
        {tab === 'futures' && <FuturesMetricsPanel />}
      </div>
    </section>
  )
}

function usePrimarySync(enabled: boolean) {
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const panels = useLayoutStore((s) => s.panels)
  const setSymbol = useMarketStore((s) => s.setSymbol)
  const setIntervalStore = useMarketStore((s) => s.setInterval)
  const setExchange = useMarketStore((s) => s.setExchange)
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)
  const stopLive = useMarketStore((s) => s.stopLive)
  const primary = panels.find((p) => p.id === primaryPanelId)

  useEffect(() => {
    if (!enabled || !primary) return
    stopLive()
    setSymbol(primary.symbol)
    setIntervalStore(primary.interval)
    setExchange(primary.exchange)
    loadHistorical().then(() => startLive())
  }, [enabled, primary?.symbol, primary?.interval, primary?.exchange, primaryPanelId])
}

function ChartArea() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ width, height })
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="flex-1 min-h-0 min-w-0 relative">
      <PanelGrid width={size.width} height={size.height} />
    </div>
  )
}

/** Parse detach mode from URL once */
function useDetachParams() {
  return useMemo(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.get('detach') !== '1') return null
    const symbol = normalizeSymbol(q.get('symbol') || 'BTCUSDT') || 'BTCUSDT'
    const interval = (q.get('interval') || '1m') as Interval
    const exchange = (q.get('exchange') || 'binance') as ExchangeId
    return { symbol, interval, exchange }
  }, [])
}

/** Minimal single-chart shell for second-monitor pop-out */
function DetachedApp({
  symbol,
  interval,
  exchange,
}: {
  symbol: string
  interval: Interval
  exchange: ExchangeId
}) {
  const setSymbol = useMarketStore((s) => s.setSymbol)
  const setIntervalStore = useMarketStore((s) => s.setInterval)
  const setExchange = useMarketStore((s) => s.setExchange)
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)

  useEffect(() => {
    setSymbol(symbol)
    setIntervalStore(interval)
    setExchange(exchange)
    void loadHistorical().then(() => startLive())
  }, [symbol, interval, exchange])

  const config = useMemo(
    () => ({
      id: 'detached',
      symbol,
      interval,
      exchange,
      syncGroup: null as string | null,
    }),
    [symbol, interval, exchange]
  )

  return (
    <div className="h-full flex flex-col bg-terminal-bg">
      <header className="flex items-center gap-3 px-3 py-1.5 border-b border-terminal-border bg-terminal-panel shrink-0">
        <span className="text-xxs font-semibold tracking-wide text-[#f0b90b]">DETACHED</span>
        <span className="text-xs font-mono-nums text-terminal-text">
          {symbol} · {interval} · {EXCHANGE_LABELS[exchange] ?? exchange}
        </span>
        <StatusBadge />
      </header>
      <div className="flex-1 min-h-0">
        <ChartPanel config={config} />
      </div>
    </div>
  )
}

export default function App() {
  const detach = useDetachParams()
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)
  const density = useUiDensityStore((s) => s.mode)
  const toggleDensity = useUiDensityStore((s) => s.toggle)
  const { helpOpen, setHelpOpen } = useGlobalHotkeys()

  useExecutionHotkeys()

  useEffect(() => {
    startAlertEngine()
  }, [])

  // Full desk boot only when not detached
  useEffect(() => {
    if (detach) return
    void loadWorkspace()
      .then((res) => {
        if (res.ok) applyWorkspace(res.doc)
      })
      .finally(() => {
        loadHistorical().then(() => startLive())
      })
  }, [detach])

  usePrimarySync(!detach)

  if (detach) {
    return (
      <DetachedApp
        symbol={detach.symbol}
        interval={detach.interval}
        exchange={detach.exchange}
      />
    )
  }

  return (
    <div className="h-full flex flex-col pb-7">
      <header className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-panel density-compact">
        <h1 className="text-sm font-semibold tracking-wide">TRADING TERMINAL</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-xxs px-2 py-0.5 rounded border border-terminal-border text-terminal-muted hover:text-[#f0b90b]"
            title="Toggle density (D)"
            onClick={toggleDensity}
          >
            {density === 'scalp' ? 'SCALP' : 'RESEARCH'}
          </button>
          <button
            type="button"
            className="text-xxs px-2 py-0.5 rounded border border-terminal-border text-terminal-muted hover:text-[#eaecef] density-chrome"
            title="Hotkey map (?)"
            onClick={() => setHelpOpen(true)}
          >
            ?
          </button>
          <ArchiveMenu />
          <WorkspaceMenu />
          <span className="text-xxs text-terminal-muted density-chrome">Desk workflow</span>
        </div>
      </header>

      <ErrorBanner />
      <Controls />
      <TickerBar />
      <div className="density-chrome">
        <ExecutionBar />
      </div>

      <div className="flex-1 grid grid-cols-3 gap-px bg-terminal-border overflow-hidden min-h-0">
        <section className="col-span-2 bg-terminal-bg flex flex-col min-h-0 min-w-0">
          <ChartArea />
        </section>
        <SidePanel />
      </div>

      <FeedHealthHud />
      <HotkeyHelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

void EXCHANGE_LABELS
