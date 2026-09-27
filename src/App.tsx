import { useEffect, useRef, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { PanelGrid } from '@/layout/PanelGrid'
import { LargeTradesPanel } from '@/analysis/deepTrades'
import { PaperTradingPanel } from '@/trading/paper'
import { ExecutionBar, useExecutionHotkeys } from '@/trading'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { SYMBOL_PRESETS, ALL_INTERVALS } from '@/data/symbols'
import type { Interval } from '@/types'
import { WorkspaceMenu, loadWorkspace, applyWorkspace } from '@/workspace'
import { ArchiveMenu } from '@/ui/ArchiveMenu'
import { FuturesMetricsPanel } from '@/ui/FuturesMetricsPanel'
import { FeedHealthHud } from '@/ui/FeedHealthHud'
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
    <div className="bg-terminal-red/10 border border-terminal-red/40 text-terminal-red px-4 py-2 text-sm flex justify-between items-center">
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
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-terminal-border bg-terminal-panel">
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
        className="px-3 py-1 bg-terminal-blue/20 text-terminal-blue rounded text-sm hover:bg-terminal-blue/30"
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
  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xxs font-mono-nums">
        <thead className="sticky top-0 bg-terminal-panel text-terminal-muted">
          <tr>
            <th className="text-left px-2 py-1">Time</th>
            <th className="text-right px-2 py-1">Price</th>
            <th className="text-right px-2 py-1">Qty</th>
            <th className="text-right px-2 py-1">Side</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id} className="border-t border-terminal-border/50">
              <td className="px-2 py-0.5">{new Date(t.time).toLocaleTimeString()}</td>
              <td
                className={
                  'text-right px-2 py-0.5 ' +
                  (t.isBuyerMaker ? 'text-terminal-red' : 'text-terminal-green')
                }
              >
                {t.price.toFixed(2)}
              </td>
              <td className="text-right px-2 py-0.5">{t.qty.toFixed(5)}</td>
              <td
                className={
                  'text-right px-2 py-0.5 ' +
                  (t.isBuyerMaker ? 'text-terminal-red' : 'text-terminal-green')
                }
              >
                {t.isBuyerMaker ? 'SELL' : 'BUY'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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
  const up = ticker.priceChange >= 0
  return (
    <div className="flex items-center gap-6 px-4 py-1.5 border-b border-terminal-border text-sm font-mono-nums">
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

type SideTab = 'live' | 'large' | 'book' | 'futures' | 'paper'

function SidePanel() {
  const [tab, setTab] = useState<SideTab>('paper')
  const tabs: { id: SideTab; label: string }[] = [
    { id: 'paper', label: 'Trade' },
    { id: 'live', label: 'Tape' },
    { id: 'large', label: 'Large' },
    { id: 'book', label: 'Book' },
    { id: 'futures', label: 'Futures' },
  ]

  return (
    <section className="bg-terminal-panel flex flex-col min-h-0">
      <div className="flex border-b border-terminal-border shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`flex-1 px-1 py-1.5 text-xxs uppercase tracking-wider ${\n              tab === t.id
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
        {tab === 'live' && <TradesTape />}
        {tab === 'large' && <PrimaryLargeTrades />}
        {tab === 'book' && <OrderBookView />}
        {tab === 'futures' && <FuturesMetricsPanel />}
      </div>
    </section>
  )
}

function usePrimarySync() {
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
    if (!primary) return
    stopLive()
    setSymbol(primary.symbol)
    setIntervalStore(primary.interval)
    setExchange(primary.exchange)
    loadHistorical().then(() => startLive())
  }, [primary?.symbol, primary?.interval, primary?.exchange, primaryPanelId])
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

export default function App() {
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)

  useExecutionHotkeys()

  useEffect(() => {
    void loadWorkspace()
      .then((res) => {
        if (res.ok) applyWorkspace(res.doc)
      })
      .finally(() => {
        loadHistorical().then(() => startLive())
      })
  }, [])

  usePrimarySync()

  return (
    <div className="h-full flex flex-col pb-7">
      <header className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-panel">
        <h1 className="text-sm font-semibold tracking-wide">TRADING TERMINAL</h1>
        <div className="flex items-center gap-3">
          <ArchiveMenu />
          <WorkspaceMenu />
          <span className="text-xxs text-terminal-muted">Paper default · Live opt-in</span>
        </div>
      </header>

      <ErrorBanner />
      <Controls />
      <TickerBar />
      <ExecutionBar />

      <div className="flex-1 grid grid-cols-3 gap-px bg-terminal-border overflow-hidden min-h-0">
        <section className="col-span-2 bg-terminal-bg flex flex-col min-h-0 min-w-0">
          <ChartArea />
        </section>
        <SidePanel />
      </div>

      <FeedHealthHud />
    </div>
  )
}

void EXCHANGE_LABELS
