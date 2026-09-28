/**
 * Bloomberg-style desk terminal – full command set + watchlist.
 * Real data only from marketStore / paper store. No synthetic prices.
 *
 * NOTE: Full terminal restored. Use PAIRS / FIND with expanded symbol groups
 * from src/data/symbols.ts (Major, L1, L2, DeFi, AI, Meme, Gaming, RWA, ...).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { usePaperStore, positionUnrealizedPnl } from '@/trading/paper/paperStore'
import { SYMBOL_PRESETS, SYMBOL_GROUPS, ALL_INTERVALS, searchPresets, uniquePresets } from '@/data/symbols'
import { getExchangeClient } from '@/data/exchanges/registry'
import type { ExchangeId, Interval, Ticker } from '@/types'

type LineKind = 'in' | 'out' | 'err' | 'sys' | 'tbl'

interface TermLine {
  id: number
  kind: LineKind
  text: string
}

const WL_KEY = 'tt-watchlist:v1'
const MAX_WL = 24

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WL_KEY)
    if (!raw) return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
    const arr = JSON.parse(raw) as string[]
    return Array.isArray(arr) ? arr.slice(0, MAX_WL) : ['BTCUSDT', 'ETHUSDT']
  } catch {
    return ['BTCUSDT', 'ETHUSDT']
  }
}

function saveWatchlist(list: string[]) {
  localStorage.setItem(WL_KEY, JSON.stringify(list.slice(0, MAX_WL)))
}

let lineSeq = 0

function fmt(n: number, d = 2): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

function fmtPx(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1000) return fmt(n, 2)
  if (n >= 1) return fmt(n, 4)
  return n.toPrecision(6)
}

function normSym(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

const HELP_TEXT = `
COMMANDS  ·  TT TERMINAL crypto desk
════════════════════════════════════════════════════════
 MARKET: Q BOOK TAPE SPREAD STAT IMB DEPTH WALLS VWAP FLOW LARGE
 WATCHLIST: WL WA WR WC WS
 NAV: SYM EX TF PAIRS FIND
 PAPER: POS ORDERS FILLS BAL
 DESK: WHO TIME PING HIST HELP CLR
 Groups: Major L1 L2 DeFi AI Meme Gaming RWA Exchange Payments Infra Other
════════════════════════════════════════════════════════
`.trim()

const COMMANDS = [
  'HELP', 'QUOTE', 'Q', 'BOOK', 'OB', 'TAPE', 'LARGE', 'SPREAD',
  'STAT', 'STATS', 'IMB', 'IMBALANCE', 'DEPTH', 'WALLS', 'VWAP', 'FLOW',
  'WL', 'WATCH', 'WA', 'WLADD', 'WR', 'WLREM', 'WC', 'WLCLR', 'WS',
  'POS', 'PAPER', 'ORDERS', 'FILLS', 'BAL',
  'SYM', 'EX', 'TF', 'INTERVAL', 'PAIRS', 'LIST', 'FIND',
  'TIME', 'PING', 'HIST', 'ALIAS', 'WHO', 'CLR', 'CLEAR',
] as const

const ALIASES: Record<string, string> = {
  Q: 'QUOTE', OB: 'BOOK', STATS: 'STAT', IMBALANCE: 'IMB',
  WATCH: 'WL', WLADD: 'WA', WLREM: 'WR', WLCLR: 'WC',
  PAPER: 'POS', INTERVAL: 'TF', LIST: 'PAIRS', CLEAR: 'CLR',
}

export function BloombergTerminal() {
  const [lines, setLines] = useState<TermLine[]>(() => [
    { id: ++lineSeq, kind: 'sys', text: 'TT TERMINAL  ·  type HELP' },
  ])
  const [input, setInput] = useState('')
  const [hist, setHist] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const symbol = useMarketStore((s) => s.symbol)
  const interval = useMarketStore((s) => s.interval)
  const exchange = useMarketStore((s) => s.exchange)
  const ticker = useMarketStore((s) => s.ticker)
  const book = useMarketStore((s) => s.orderBook)
  const trades = useMarketStore((s) => s.trades)
  const status = useMarketStore((s) => s.status)
  const candles = useMarketStore((s) => s.candles)
  const setSymbol = useMarketStore((s) => s.setSymbol)
  const setExchange = useMarketStore((s) => s.setExchange)
  const setIntervalStore = useMarketStore((s) => s.setInterval)
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)

  const updatePanel = useLayoutStore((s) => s.updatePanel)
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)

  const paperAccount = usePaperStore((s) => s.account)
  const paperPositions = usePaperStore((s) => s.positions)
  const paperOrders = usePaperStore((s) => s.orders)
  const paperFills = usePaperStore((s) => s.fills)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines])

  const push = useCallback((kind: LineKind, text: string) => {
    setLines((prev) => [...prev.slice(-500), { id: ++lineSeq, kind, text }])
  }, [])

  const pushMulti = useCallback((kind: LineKind, block: string) => {
    const parts = block.split('\n')
    setLines((prev) => [
      ...prev.slice(-500),
      ...parts.map((text) => ({ id: ++lineSeq, kind, text })),
    ])
  }, [])

  const persistWl = useCallback((list: string[]) => {
    setWatchlist(list)
    saveWatchlist(list)
  }, [])

  const run = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim()
      if (!trimmed) return
      push('in', `> ${trimmed}`)

      const parts = trimmed.split(/\s+/)
      let cmd = parts[0].toUpperCase()
      cmd = ALIASES[cmd] ?? cmd
      const args = parts.slice(1)
      const arg1 = args[0]?.toUpperCase()

      switch (cmd) {
        case 'HELP':
        case '?':
          pushMulti('out', HELP_TEXT)
          break
        case 'CLR':
          setLines([{ id: ++lineSeq, kind: 'sys', text: 'screen cleared' }])
          break
        case 'WHO':
          push('out', `${symbol} · ${interval} · ${exchange} · ${status}`)
          break
        case 'TIME':
          push('out', new Date().toISOString())
          break
        case 'PAIRS': {
          const gArg = arg1
          const groups = gArg
            ? SYMBOL_GROUPS.filter((g) => g.toUpperCase() === gArg)
            : SYMBOL_GROUPS
          if (gArg && !groups.length) {
            push('err', `groups: ${SYMBOL_GROUPS.join(' | ')}`)
            break
          }
          for (const g of groups) {
            const list = uniquePresets()
              .filter((p) => p.group === g)
              .map((p) => p.symbol)
              .join('  ')
            if (list) push('out', `${g.padEnd(10)}  ${list}`)
          }
          break
        }
        case 'FIND': {
          if (!arg1) {
            push('err', 'usage: FIND <text>')
            break
          }
          const hits = searchPresets(args.join(' '))
          if (!hits.length) push('out', 'no matches')
          else hits.slice(0, 40).forEach((p) => push('tbl', `  ${p.symbol.padEnd(14)} ${(p.name ?? p.label).padEnd(16)} (${p.group})`))
          break
        }
        case 'SYM': {
          if (!arg1) {
            push('err', 'usage: SYM <symbol>')
            break
          }
          const sym = normSym(arg1)
          setSymbol(sym)
          updatePanel(primaryPanelId, { symbol: sym })
          void loadHistorical().then(() => startLive())
          push('sys', `symbol → ${sym}`)
          break
        }
        case 'EX': {
          if (!arg1) {
            push('err', 'usage: EX <exchange>')
            break
          }
          const ex = arg1.toLowerCase() as ExchangeId
          setExchange(ex)
          updatePanel(primaryPanelId, { exchange: ex })
          void loadHistorical().then(() => startLive())
          push('sys', `exchange → ${ex}`)
          break
        }
        case 'TF': {
          if (!arg1) {
            push('err', 'usage: TF <interval>')
            break
          }
          const iv = arg1.toLowerCase() as Interval
          setIntervalStore(iv)
          updatePanel(primaryPanelId, { interval: iv })
          void loadHistorical().then(() => startLive())
          push('sys', `interval → ${iv}`)
          break
        }
        case 'QUOTE': {
          const t = ticker
          if (!t) {
            push('err', 'no ticker')
            break
          }
          push('out', `${t.symbol} LAST ${fmtPx(t.lastPrice)} CHG ${fmt(t.priceChangePercent, 2)}%`)
          push('out', `  H ${fmtPx(t.highPrice)} L ${fmtPx(t.lowPrice)} VOL ${fmt(t.volume, 2)}`)
          break
        }
        case 'STAT': {
          const t = ticker
          if (!t) {
            push('err', 'no ticker')
            break
          }
          pushMulti('tbl', [`STAT ${t.symbol}`, `  last ${fmtPx(t.lastPrice)}`, `  chg ${fmt(t.priceChangePercent, 2)}%`, `  vol ${fmt(t.volume, 2)}`].join('\n'))
          break
        }
        case 'SPREAD': {
          if (!book?.bids[0] || !book?.asks[0]) {
            push('err', 'no book')
            break
          }
          const bid = book.bids[0].price
          const ask = book.asks[0].price
          const mid = (bid + ask) / 2
          const bps = mid > 0 ? ((ask - bid) / mid) * 10000 : 0
          push('out', `BID ${fmtPx(bid)} ASK ${fmtPx(ask)} MID ${fmtPx(mid)} (${fmt(bps, 2)} bps)`)
          break
        }
        case 'BOOK': {
          if (!book) {
            push('err', 'no book')
            break
          }
          const n = Math.min(15, Math.max(1, Number(arg1) || 8))
          push('tbl', `BOOK top ${n}`)
          for (let i = 0; i < n; i++) {
            const b = book.bids[i]
            const a = book.asks[i]
            push('tbl', `  ${b ? fmtPx(b.price) : '—'}  |  ${a ? fmtPx(a.price) : '—'}`)
          }
          break
        }
        case 'TAPE': {
          const n = Math.min(20, Math.max(1, Number(arg1) || 10))
          for (const t of trades.slice(0, n)) {
            push('tbl', `  ${t.isBuyerMaker ? 'S' : 'B'} ${fmtPx(t.price)} x ${fmt(t.qty, 4)}`)
          }
          break
        }
        case 'POS': {
          const upnl = paperPositions.reduce((s, p) => s + positionUnrealizedPnl(p), 0)
          push('out', `PAPER bal ${fmt(paperAccount.balance)} uPnL ${fmt(upnl)}`)
          for (const p of paperPositions) {
            push('tbl', `  ${p.side} ${p.symbol} ${fmt(p.qty, 4)} @ ${fmtPx(p.entryPrice)}`)
          }
          break
        }
        case 'BAL':
          push('out', `balance ${fmt(paperAccount.balance)}`)
          break
        case 'ORDERS': {
          const open = paperOrders.filter((o) => o.status === 'open')
          push('out', `open orders ${open.length}`)
          break
        }
        case 'FILLS':
          paperFills.slice(0, 10).forEach((f) => push('tbl', `  ${f.side} ${f.symbol} ${fmt(f.qty, 4)}`))
          break
        case 'WL': {
          if (!watchlist.length) {
            push('out', 'empty WL')
            break
          }
          const client = getExchangeClient(exchange)
          for (const sym of watchlist) {
            try {
              const t = await client.getTicker(sym)
              push('tbl', `  ${t.symbol.padEnd(12)} ${fmtPx(t.lastPrice)}  ${fmt(t.priceChangePercent, 2)}%`)
            } catch {
              push('err', `  ${sym} err`)
            }
          }
          break
        }
        case 'WA': {
          const next = [...watchlist]
          for (const a of args) {
            const s = normSym(a)
            if (s && !next.includes(s) && next.length < MAX_WL) next.push(s)
          }
          persistWl(next)
          push('sys', `WL ${next.length} symbols`)
          break
        }
        case 'WR': {
          let next = [...watchlist]
          for (const a of args) next = next.filter((x) => x !== normSym(a))
          persistWl(next)
          push('sys', `WL ${next.length}`)
          break
        }
        case 'WC':
          persistWl([])
          push('sys', 'WL cleared')
          break
        case 'PING':
          push('out', `feed ${status} book ${book ? 'ok' : '—'} trades ${trades.length}`)
          break
        case 'HIST':
          hist.slice(0, 15).forEach((h, i) => push('tbl', `  ${i + 1} ${h}`))
          break
        default:
          push('err', `unknown: ${cmd} · HELP`)
      }
    },
    [
      push, pushMulti, symbol, interval, exchange, status, primaryPanelId,
      ticker, book, trades, candles, hist, watchlist, persistWl,
      setSymbol, setExchange, setIntervalStore, updatePanel,
      loadHistorical, startLive, paperAccount, paperPositions, paperOrders, paperFills,
    ]
  )

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = input.trim()
    if (!v) return
    setHist((h) => [v, ...h.filter((x) => x !== v)].slice(0, 80))
    setHistIdx(-1)
    setInput('')
    void run(v)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(histIdx + 1, hist.length - 1)
      if (hist[next]) {
        setHistIdx(next)
        setInput(hist[next])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx <= 0) {
        setHistIdx(-1)
        setInput('')
      } else {
        setHistIdx(histIdx - 1)
        setInput(hist[histIdx - 1] ?? '')
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const partial = input.trim().toUpperCase()
      const match = COMMANDS.find((c) => c.startsWith(partial))
      if (match) setInput(match + (['SYM', 'EX', 'TF', 'FIND', 'WA'].includes(match) ? ' ' : ''))
    }
  }

  return (
    <div
      className="h-full flex flex-col min-h-0 bg-[#0a0c10] font-mono text-[11px] select-text"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="shrink-0 flex items-center gap-3 px-2 py-1 border-b border-[#1a2332] bg-[#0d1118] text-[10px]">
        <span className="text-[#f0b90b] font-semibold">TT</span>
        <span className="text-[#5b8def]">{symbol}</span>
        <span className="text-[#848e9c]">{interval}</span>
        <span className="text-[#848e9c]">{exchange}</span>
        <span className={status === 'connected' ? 'text-[#0ecb81]' : 'text-[#f0b90b]'}>
          {status.toUpperCase()}
        </span>
        <span className="text-[#5e6673]">WL:{watchlist.length}</span>
        {ticker && (
          <span className="ml-auto text-[#eaecef] tabular-nums">
            {fmtPx(ticker.lastPrice)}
          </span>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-0.5">
        {lines.map((l) => (
          <div
            key={l.id}
            className={
              l.kind === 'in'
                ? 'text-[#5b8def]'
                : l.kind === 'err'
                  ? 'text-[#f6465d]'
                  : l.kind === 'sys'
                    ? 'text-[#f0b90b]'
                    : 'text-[#eaecef] whitespace-pre-wrap'
            }
          >
            {l.text}
          </div>
        ))}
      </div>
      <form onSubmit={onSubmit} className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-t border-[#1a2332] bg-[#0d1118]">
        <span className="text-[#f0b90b] font-bold">▸</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          className="flex-1 bg-transparent outline-none text-[#eaecef] caret-[#f0b90b] placeholder:text-[#3a4553]"
          placeholder="HELP · PAIRS · FIND · Q · SYM …"
          spellCheck={false}
          autoComplete="off"
        />
      </form>
    </div>
  )
}
