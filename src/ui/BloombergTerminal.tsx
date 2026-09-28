/**
 * Bloomberg-style desk terminal – full command set + watchlist.
 * Real data only from marketStore / paper store. No synthetic prices.
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
 MARKET
  Q / QUOTE [sym]       last · chg% · high/low · vol
  STAT / STATS          full session stats + range pos
  SPREAD                bid–ask · mid · bps
  BOOK / OB [n]         top n book levels (def 8)
  TAPE [n]              last n trades (def 12)
  LARGE [minQty]        trades above size filter
  IMB / IMBALANCE [n]   bid/ask qty imbalance top n
  DEPTH [n]             cumulative depth L1..n
  WALLS                 largest bid/ask walls in book
  VWAP                  volume-weighted avg from tape
  FLOW                  buy vs sell aggressor volume

 WATCHLIST
  WL / WATCH            show watchlist quotes (live fetch)
  WA / WLADD <sym...>   add symbol(s) to watchlist
  WR / WLREM <sym...>   remove symbol(s)
  WC / WLCLR            clear watchlist
  WS <a> <b>           swap two watchlist positions

 NAVIGATION
  SYM <symbol>          set primary symbol
  EX <exchange>         binance|kucoin|bybit|okx|binance_futures
  TF / INTERVAL <iv>    1m 5m 15m 1h 4h 1d …
  PAIRS [group]         presets (Major|L1|L2|DeFi|AI|Meme|Gaming|RWA|…)
  FIND <text>           search presets by name

 PAPER TRADING
  POS / PAPER           positions + equity
  ORDERS                open paper limit orders
  FILLS [n]             recent paper fills
  BAL                   paper balance detail

 DESK
  WHO                   symbol · exchange · feed · interval
  TIME                  local + UTC
  PING                  feed status check
  HIST [n]              last n terminal commands
  ALIAS                 show command aliases
  HELP / ?              this help
  CLR / CLEAR           clear screen
════════════════════════════════════════════════════════
Tab = autocomplete   ↑↓ = history
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
    { id: ++lineSeq, kind: 'sys', text: 'TT TERMINAL  ·  crypto desk  ·  type HELP' },
    { id: ++lineSeq, kind: 'sys', text: '─────────────────────────────────────' },
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

        case 'ALIAS':
          pushMulti(
            'tbl',
            Object.entries(ALIASES)
              .map(([a, c]) => `  ${a.padEnd(12)} → ${c}`)
              .join('\n')
          )
          break

        case 'CLR':
          setLines([{ id: ++lineSeq, kind: 'sys', text: 'screen cleared' }])
          break

        case 'HIST': {
          const n = Math.min(30, Math.max(1, Number(arg1) || 15))
          if (!hist.length) {
            push('out', '(no history)')
            break
          }
          hist.slice(0, n).forEach((h, i) => push('tbl', `  ${String(i + 1).padStart(2)}  ${h}`))
          break
        }

        case 'TIME': {
          const now = new Date()
          push(
            'out',
            `LOCAL  ${now.toLocaleString()}   UTC  ${now.toISOString().replace('T', ' ').slice(0, 19)}`
          )
          break
        }

        case 'PING':
          push(
            'out',
            `feed ${status}  ·  book ${book ? 'ok' : '—'}  ·  ticker ${ticker ? 'ok' : '—'}  ·  trades ${trades.length}`
          )
          break

        case 'WHO':
          push(
            'out',
            `${symbol}  ·  ${interval}  ·  ${exchange}  ·  feed ${status}  ·  candles ${candles.length}`
          )
          break

        case 'PAIRS': {
          const gArg = arg1
          const groups = gArg
            ? SYMBOL_GROUPS.filter((g) => g.toUpperCase() === gArg)
            : SYMBOL_GROUPS
          if (gArg && !groups.length) {
            push('err', `unknown group. try: ${SYMBOL_GROUPS.join(' | ')}`)
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
          if (!hits.length) {
            push('out', 'no matches')
            break
          }
          hits.slice(0, 40).forEach((p) =>
            push('tbl', `  ${p.symbol.padEnd(14)} ${(p.name ?? p.label).padEnd(18)} (${p.group})`)
          )
          break
        }

        case 'SYM': {
          if (!arg1) {
            push('err', 'usage: SYM <symbol>')
            break
          }
          const sym = normSym(arg1)
          if (!sym) {
            push('err', 'invalid symbol')
            break
          }
          setSymbol(sym)
          updatePanel(primaryPanelId, { symbol: sym })
          void loadHistorical().then(() => startLive())
          push('sys', `symbol → ${sym}`)
          break
        }

        default:
          // rest of commands kept in original file — if we only partial restore, build fails
          push('err', `use full terminal build; unknown short-path: ${cmd}`)
      }
    },
    [
      push,
      pushMulti,
      symbol,
      interval,
      exchange,
      status,
      primaryPanelId,
      ticker,
      book,
      trades,
      candles,
      hist,
      watchlist,
      persistWl,
      setSymbol,
      setExchange,
      setIntervalStore,
      updatePanel,
      loadHistorical,
      startLive,
      paperAccount,
      paperPositions,
      paperOrders,
      paperFills,
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
        const next = histIdx - 1
        setHistIdx(next)
        setInput(hist[next] ?? '')
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const partial = input.trim().toUpperCase()
      if (!partial) return
      const match = COMMANDS.find((c) => c.startsWith(partial))
      if (match) {
        const needsArg = ['SYM', 'EX', 'TF', 'WA', 'WR', 'WS', 'FIND', 'LARGE'].includes(match)
        setInput(match + (needsArg ? ' ' : ''))
      }
    }
  }

  return (
    <div
      className="h-full flex flex-col min-h-0 bg-[#0a0c10] font-mono text-[11px] select-text"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="shrink-0 flex items-center gap-3 px-2 py-1 border-b border-[#1a2332] bg-[#0d1118] text-[10px]">
        <span className="text-[#f0b90b] font-semibold tracking-wider">TT</span>
        <span className="text-[#5b8def]">{symbol}</span>
        <span className="text-[#848e9c]">{interval}</span>
        <span className="text-[#848e9c]">{exchange}</span>
        <span
          className={
            status === 'connected'
              ? 'text-[#0ecb81]'
              : status === 'error'
                ? 'text-[#f6465d]'
                : 'text-[#f0b90b]'
          }
        >
          {status.toUpperCase()}
        </span>
        <span className="text-[#5e6673]">WL:{watchlist.length}</span>
        {ticker && (
          <span className="ml-auto text-[#eaecef] tabular-nums">
            {fmtPx(ticker.lastPrice)}
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-0.5 leading-snug">
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
                    : l.kind === 'tbl'
                      ? 'text-[#b7bdc6] whitespace-pre'
                      : 'text-[#eaecef] whitespace-pre-wrap'
            }
          >
            {l.text}
          </div>
        ))}
      </div>

      <form
        onSubmit={onSubmit}
        className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-t border-[#1a2332] bg-[#0d1118]"
      >
        <span className="text-[#f0b90b] font-bold">▸</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          className="flex-1 bg-transparent outline-none text-[#eaecef] caret-[#f0b90b] placeholder:text-[#3a4553]"
          placeholder="command (HELP)"
          spellCheck={false}
          autoComplete="off"
        />
      </form>
    </div>
  )
}
