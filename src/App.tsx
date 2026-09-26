import { useEffect } from 'react'
import { useMarketStore } from '@/stores/marketStore'

function StatusBadge() {
  const status = useMarketStore((s) => s.status)
  const colors: Record<string, string> = {
    connecting: 'bg-terminal-yellow/20 text-terminal-yellow',
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

function Controls() {
  const symbol = useMarketStore((s) => s.symbol)
  const interval = useMarketStore((s) => s.interval)
  const setSymbol = useMarketStore((s) => s.setSymbol)
  const setInterval = useMarketStore((s) => s.setInterval)
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)
  const stopLive = useMarketStore((s) => s.stopLive)
  const status = useMarketStore((s) => s.status)

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-terminal-border bg-terminal-panel">
      <input
        className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm w-28 font-mono-nums"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        placeholder="BTCUSDT"
      />
      <select
        className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm"
        value={interval}
        onChange={(e) => setInterval(e.target.value as any)}
      >
        {['1m', '5m', '15m', '1h', '4h', '1d'].map((i) => (
          <option key={i} value={i}>{i}</option>
        ))}
      </select>
      <button
        onClick={() => loadHistorical()}
        className="px-3 py-1 bg-terminal-blue/20 text-terminal-blue rounded text-sm hover:bg-terminal-blue/30"
      >
        Load History
      </button>
      {status === 'connected' || status === 'connecting' ? (
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

function CandleTable() {
  const candles = useMarketStore((s) => s.candles)
  const last = candles.slice(-15).reverse()

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xxs font-mono-nums">
        <thead className="sticky top-0 bg-terminal-panel text-terminal-muted">
          <tr>
            <th className="text-left px-2 py-1">Time</th>
            <th className="text-right px-2 py-1">Open</th>
            <th className="text-right px-2 py-1">High</th>
            <th className="text-right px-2 py-1">Low</th>
            <th className="text-right px-2 py-1">Close</th>
            <th className="text-right px-2 py-1">Volume</th>
          </tr>
        </thead>
        <tbody>
          {last.map((c) => (
            <tr key={c.time} className="border-t border-terminal-border/50 hover:bg-terminal-hover">
              <td className="px-2 py-0.5">{new Date(c.time * 1000).toLocaleTimeString()}</td>
              <td className="text-right px-2 py-0.5">{c.open.toFixed(2)}</td>
              <td className="text-right px-2 py-0.5 text-terminal-green">{c.high.toFixed(2)}</td>
              <td className="text-right px-2 py-0.5 text-terminal-red">{c.low.toFixed(2)}</td>
              <td className="text-right px-2 py-0.5">{c.close.toFixed(2)}</td>
              <td className="text-right px-2 py-0.5 text-terminal-muted">{c.volume.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {candles.length === 0 && (
        <div className="p-4 text-terminal-muted text-sm">No candles yet. Click "Load History".</div>
      )}
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
              <td className={`text-right px-2 py-0.5 ${t.isBuyerMaker ? 'text-terminal-red' : 'text-terminal-green'}`}>
                {t.price.toFixed(2)}
              </td>
              <td className="text-right px-2 py-0.5">{t.qty.toFixed(5)}</td>
              <td className={`text-right px-2 py-0.5 ${t.isBuyerMaker ? 'text-terminal-red' : 'text-terminal-green'}`}>
                {t.isBuyerMaker ? 'SELL' : 'BUY'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {trades.length === 0 && (
        <div className="p-4 text-terminal-muted text-sm">No live trades yet. Click "Start Live".</div>
      )}
    </div>
  )
}

function OrderBookView() {
  const book = useMarketStore((s) => s.orderBook)
  if (!book) {
    return <div className="p-4 text-terminal-muted text-sm">No order book. Load History or Start Live.</div>
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
            <div key={l.price} className="relative flex justify-between py-0.5">
              <div
                className="absolute inset-y-0 right-0 bg-terminal-green/10"
                style={{ width: `${(l.qty / maxQty) * 100}%` }}
              />
              <span className="text-terminal-green relative">{l.price.toFixed(2)}</span>
              <span className="relative">{l.qty.toFixed(4)}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="text-terminal-muted mb-1">Asks</div>
          {book.asks.slice(0, 12).map((l) => (
            <div key={l.price} className="relative flex justify-between py-0.5">
              <div
                className="absolute inset-y-0 left-0 bg-terminal-red/10"
                style={{ width: `${(l.qty / maxQty) * 100}%` }}
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
        {up ? '+' : ''}{ticker.priceChangePercent.toFixed(2)}%
      </span>
      <span className="text-terminal-muted">24h Vol: {ticker.volume.toFixed(0)}</span>
      <span className="text-terminal-muted">H: {ticker.highPrice.toFixed(2)}</span>
      <span className="text-terminal-muted">L: {ticker.lowPrice.toFixed(2)}</span>
    </div>
  )
}

export default function App() {
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)

  // Auto-load on mount
  useEffect(() => {
    loadHistorical().then(() => startLive())
  }, [])

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-panel">
        <h1 className="text-sm font-semibold tracking-wide">TRADING TERMINAL</h1>
        <span className="text-xxs text-terminal-muted">Binance · Real-time · No mocks</span>
      </header>

      <ErrorBanner />
      <Controls />
      <TickerBar />

      <div className="flex-1 grid grid-cols-3 gap-px bg-terminal-border overflow-hidden">
        <section className="bg-terminal-panel flex flex-col">
          <div className="px-3 py-1.5 text-xxs text-terminal-muted border-b border-terminal-border uppercase tracking-wider">
            Candles (last 15)
          </div>
          <CandleTable />
        </section>

        <section className="bg-terminal-panel flex flex-col">
          <div className="px-3 py-1.5 text-xxs text-terminal-muted border-b border-terminal-border uppercase tracking-wider">
            Live Trades
          </div>
          <TradesTape />
        </section>

        <section className="bg-terminal-panel flex flex-col">
          <div className="px-3 py-1.5 text-xxs text-terminal-muted border-b border-terminal-border uppercase tracking-wider">
            Order Book
          </div>
          <OrderBookView />
        </section>
      </div>
    </div>
  )
}
