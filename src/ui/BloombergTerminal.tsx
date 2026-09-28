/**
 * Bloomberg-style desk terminal – full command set + watchlist.
 * Real data only from marketStore / paper store. No synthetic prices.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { usePaperStore, positionUnrealizedPnl } from '@/trading/paper/paperStore'
import { SYMBOL_PRESETS, ALL_INTERVALS } from '@/data/symbols'
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
  WLS <a> <b>           swap two watchlist positions

 NAVIGATION
  SYM <symbol>          set primary symbol
  EX <exchange>         binance|kucoin|bybit|okx|binance_futures
  TF / INTERVAL <iv>    1m 5m 15m 1h 4h 1d …
  PAIRS [group]         presets (Major|L1|DeFi|Meme|Other)
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
          const group = arg1 as 'MAJOR' | 'L1' | 'DEFI' | 'MEME' | 'OTHER' | undefined
          const groups = group
            ? ([group.charAt(0) + group.slice(1).toLowerCase()] as const)
            : (['Major', 'L1', 'DeFi', 'Meme', 'Other'] as const)
          for (const g of groups) {
            const list = SYMBOL_PRESETS.filter((p) => p.group === g)
              .map((p) => p.symbol)
              .join('  ')
            if (list) push('out', `${String(g).padEnd(6)}  ${list}`)
          }
          break
        }

        case 'FIND': {
          if (!arg1) {
            push('err', 'usage: FIND <text>')
            break
          }
          const q = arg1.toLowerCase()
          const hits = SYMBOL_PRESETS.filter(
            (p) =>
              p.symbol.toLowerCase().includes(q) ||
              p.label.toLowerCase().includes(q)
          )
          if (!hits.length) {
            push('out', 'no matches')
            break
          }
          hits.forEach((p) => push('tbl', `  ${p.symbol.padEnd(12)} ${p.label}  (${p.group})`))
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

        case 'EX': {
          if (!arg1) {
            push('err', 'usage: EX <binance|kucoin|bybit|okx|binance_futures>')
            break
          }
          const allowed: ExchangeId[] = [
            'binance',
            'kucoin',
            'bybit',
            'okx',
            'binance_futures',
          ]
          const ex = arg1.toLowerCase() as ExchangeId
          if (!allowed.includes(ex)) {
            push('err', `unknown. try: ${allowed.join(' | ')}`)
            break
          }
          setExchange(ex)
          updatePanel(primaryPanelId, { exchange: ex })
          void loadHistorical().then(() => startLive())
          push('sys', `exchange → ${ex}`)
          break
        }

        case 'TF': {
          if (!arg1) {
            push('err', `usage: TF <${ALL_INTERVALS.slice(0, 8).join('|')}…>`)
            break
          }
          const iv = arg1.toLowerCase() as Interval
          if (!(ALL_INTERVALS as readonly string[]).includes(iv)) {
            push('err', `invalid interval. e.g. 1m 5m 15m 1h 4h 1d`)
            break
          }
          setIntervalStore(iv)
          updatePanel(primaryPanelId, { interval: iv })
          void loadHistorical().then(() => startLive())
          push('sys', `interval → ${iv}`)
          break
        }

        case 'QUOTE': {
          const t = ticker
          if (!t) {
            push('err', 'no ticker – Start Live first')
            break
          }
          const up = t.priceChangePercent >= 0
          push(
            'out',
            `${t.symbol}  LAST ${fmtPx(t.lastPrice)}  CHG ${up ? '+' : ''}${fmt(t.priceChangePercent, 2)}%  (${up ? '+' : ''}${fmt(t.priceChange, 4)})`
          )
          push(
            'out',
            `  HIGH ${fmtPx(t.highPrice)}  LOW ${fmtPx(t.lowPrice)}  VOL ${fmt(t.volume, 2)}  QVOL ${fmt(t.quoteVolume, 0)}`
          )
          break
        }

        case 'STAT': {
          const t = ticker
          if (!t) {
            push('err', 'no ticker data')
            break
          }
          const range = t.highPrice - t.lowPrice
          const pos = range > 0 ? ((t.lastPrice - t.lowPrice) / range) * 100 : 50
          const lastC = candles[candles.length - 1]
          const rows = [
            `STAT  ${t.symbol}  ${interval}`,
            `  last       ${fmtPx(t.lastPrice)}`,
            `  change     ${fmt(t.priceChangePercent, 2)}%`,
            `  high/low   ${fmtPx(t.highPrice)} / ${fmtPx(t.lowPrice)}`,
            `  range pos  ${fmt(pos, 1)}% of day range`,
            `  volume     ${fmt(t.volume, 3)} base`,
            `  quote vol  ${fmt(t.quoteVolume, 0)} USDT`,
          ]
          if (lastC) {
            rows.push(
              `  candle     O ${fmtPx(lastC.open)} H ${fmtPx(lastC.high)} L ${fmtPx(lastC.low)} C ${fmtPx(lastC.close)}`
            )
          }
          pushMulti('tbl', rows.join('\n'))
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
          const sp = ask - bid
          const bps = mid > 0 ? (sp / mid) * 10000 : 0
          push(
            'out',
            `BID ${fmtPx(bid)}  ASK ${fmtPx(ask)}  MID ${fmtPx(mid)}  SPR ${fmtPx(sp)}  (${fmt(bps, 2)} bps)`
          )
          break
        }

        case 'BOOK': {
          if (!book) {
            push('err', 'no order book')
            break
          }
          const n = Math.min(25, Math.max(1, Number(arg1) || 8))
          push('tbl', `BOOK  ${symbol}  top ${n}`)
          push('tbl', '  SIZE        BID           ASK          SIZE')
          for (let i = 0; i < n; i++) {
            const b = book.bids[i]
            const a = book.asks[i]
            const bs = b ? fmt(b.qty, 4).padStart(10) : '          '
            const bp = b ? fmtPx(b.price).padStart(12) : '            '
            const ap = a ? fmtPx(a.price).padStart(12) : '            '
            const as = a ? fmt(a.qty, 4).padStart(10) : '          '
            push('tbl', `  ${bs}  ${bp}  ${ap}  ${as}`)
          }
          break
        }

        case 'TAPE': {
          const n = Math.min(50, Math.max(1, Number(arg1) || 12))
          if (!trades.length) {
            push('err', 'no trades')
            break
          }
          push('tbl', `TAPE  last ${Math.min(n, trades.length)}`)
          for (const t of trades.slice(0, n)) {
            const side = t.isBuyerMaker ? 'SELL' : 'BUY '
            const arrow = t.isBuyerMaker ? '↓' : '↑'
            push(
              'tbl',
              `  ${new Date(t.time).toLocaleTimeString()}  ${arrow}${side}  ${fmtPx(t.price)}  x ${fmt(t.qty, 4)}`
            )
          }
          break
        }

        case 'LARGE': {
          const minQ = Number(arg1) || 1
          const hits = trades.filter((t) => t.qty >= minQ).slice(0, 20)
          if (!hits.length) {
            push('out', `no trades ≥ ${minQ}`)
            break
          }
          push('tbl', `LARGE  qty≥${minQ}  (${hits.length})`)
          for (const t of hits) {
            const side = t.isBuyerMaker ? 'SELL' : 'BUY '
            push(
              'tbl',
              `  ${new Date(t.time).toLocaleTimeString()}  ${side}  ${fmtPx(t.price)}  x ${fmt(t.qty, 4)}`
            )
          }
          break
        }

        case 'IMB': {
          if (!book) {
            push('err', 'no book')
            break
          }
          const depth = Math.min(50, Math.max(1, Number(arg1) || 10))
          const bidQty = book.bids.slice(0, depth).reduce((s, l) => s + l.qty, 0)
          const askQty = book.asks.slice(0, depth).reduce((s, l) => s + l.qty, 0)
          const tot = bidQty + askQty || 1
          const pctBid = (bidQty / tot) * 100
          const pctAsk = (askQty / tot) * 100
          const ratio = askQty > 0 ? bidQty / askQty : Infinity
          push(
            'out',
            `IMB top${depth}  BID ${fmt(bidQty, 3)} (${fmt(pctBid, 1)}%)  ASK ${fmt(askQty, 3)} (${fmt(pctAsk, 1)}%)  ratio ${fmt(ratio, 3)}`
          )
          const bar =
            '█'.repeat(Math.round(pctBid / 5)) +
            '░'.repeat(Math.round(pctAsk / 5))
          push('out', `  [${bar}]`)
          break
        }

        case 'DEPTH': {
          if (!book) {
            push('err', 'no book')
            break
          }
          const n = Math.min(20, Math.max(1, Number(arg1) || 8))
          let bc = 0
          let ac = 0
          const rows: string[] = [`DEPTH cumulative  L1..${n}`]
          for (let i = 0; i < n; i++) {
            if (book.bids[i]) bc += book.bids[i].qty
            if (book.asks[i]) ac += book.asks[i].qty
            rows.push(
              `  L${String(i + 1).padStart(2)}  bidΣ ${fmt(bc, 3).padStart(10)}   askΣ ${fmt(ac, 3).padStart(10)}`
            )
          }
          pushMulti('tbl', rows.join('\n'))
          break
        }

        case 'WALLS': {
          if (!book) {
            push('err', 'no book')
            break
          }
          const topB = [...book.bids].sort((a, b) => b.qty - a.qty).slice(0, 5)
          const topA = [...book.asks].sort((a, b) => b.qty - a.qty).slice(0, 5)
          push('tbl', 'WALLS  largest levels')
          push('tbl', '  BID walls')
          topB.forEach((l, i) =>
            push('tbl', `    #${i + 1}  ${fmtPx(l.price).padStart(12)}  qty ${fmt(l.qty, 4)}`)
          )
          push('tbl', '  ASK walls')
          topA.forEach((l, i) =>
            push('tbl', `    #${i + 1}  ${fmtPx(l.price).padStart(12)}  qty ${fmt(l.qty, 4)}`)
          )
          break
        }

        case 'VWAP': {
          if (!trades.length) {
            push('err', 'no trades for VWAP')
            break
          }
          let pq = 0
          let q = 0
          for (const t of trades) {
            pq += t.price * t.qty
            q += t.qty
          }
          const vwap = q > 0 ? pq / q : 0
          const last = trades[0]?.price ?? 0
          const diff = last - vwap
          const pct = vwap > 0 ? (diff / vwap) * 100 : 0
          push(
            'out',
            `VWAP (last ${trades.length} trades)  ${fmtPx(vwap)}  ·  last ${fmtPx(last)}  ·  Δ ${pct >= 0 ? '+' : ''}${fmt(pct, 3)}%`
          )
          break
        }

        case 'FLOW': {
          if (!trades.length) {
            push('err', 'no trades')
            break
          }
          let buyQ = 0
          let sellQ = 0
          let buyN = 0
          let sellN = 0
          for (const t of trades) {
            if (t.isBuyerMaker) {
              sellQ += t.qty
              sellN++
            } else {
              buyQ += t.qty
              buyN++
            }
          }
          const tot = buyQ + sellQ || 1
          push(
            'out',
            `FLOW  BUY ${fmt(buyQ, 3)} (${buyN} tx ${(buyQ / tot * 100).toFixed(1)}%)  SELL ${fmt(sellQ, 3)} (${sellN} tx ${(sellQ / tot * 100).toFixed(1)}%)`
          )
          const delta = buyQ - sellQ
          push('out', `  delta ${delta >= 0 ? '+' : ''}${fmt(delta, 3)}  ·  sample ${trades.length} trades`)
          break
        }

        /* ─── WATCHLIST ─── */
        case 'WL': {
          if (!watchlist.length) {
            push('out', 'watchlist empty  ·  WA BTCUSDT ETHUSDT')
            break
          }
          push('sys', `WATCHLIST  ${watchlist.length} symbols  ·  fetching…`)
          const client = getExchangeClient(exchange)
          const results: { sym: string; t: Ticker | null; err?: string }[] = []
          await Promise.all(
            watchlist.map(async (sym) => {
              try {
                const t = await client.getTicker(sym)
                results.push({ sym, t })
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'err'
                results.push({ sym, t: null, err: msg })
              }
            })
          )
          // preserve order
          const ordered = watchlist.map(
            (s) => results.find((r) => r.sym === s) ?? { sym: s, t: null }
          )
          push('tbl', '  SYMBOL       LAST         CHG%       HIGH        LOW         VOL')
          for (const r of ordered) {
            if (!r.t) {
              push('err', `  ${r.sym.padEnd(12)}  ${r.err ?? 'no data'}`)
              continue
            }
            const t = r.t
            const chg = `${t.priceChangePercent >= 0 ? '+' : ''}${fmt(t.priceChangePercent, 2)}%`
            push(
              'tbl',
              `  ${t.symbol.padEnd(12)} ${fmtPx(t.lastPrice).padStart(10)}  ${chg.padStart(9)}  ${fmtPx(t.highPrice).padStart(10)}  ${fmtPx(t.lowPrice).padStart(10)}  ${fmt(t.volume, 1)}`
            )
          }
          break
        }

        case 'WA': {
          if (!args.length) {
            push('err', 'usage: WA <sym> [sym…]')
            break
          }
          const next = [...watchlist]
          for (const a of args) {
            const s = normSym(a)
            if (!s) continue
            if (next.includes(s)) {
              push('out', `  ${s} already in WL`)
              continue
            }
            if (next.length >= MAX_WL) {
              push('err', `watchlist full (max ${MAX_WL})`)
              break
            }
            next.push(s)
            push('sys', `+ ${s}`)
          }
          persistWl(next)
          break
        }

        case 'WR': {
          if (!args.length) {
            push('err', 'usage: WR <sym> [sym…]')
            break
          }
          let next = [...watchlist]
          for (const a of args) {
            const s = normSym(a)
            if (!next.includes(s)) {
              push('out', `  ${s} not in WL`)
              continue
            }
            next = next.filter((x) => x !== s)
            push('sys', `- ${s}`)
          }
          persistWl(next)
          break
        }

        case 'WC':
          persistWl([])
          push('sys', 'watchlist cleared')
          break

        case 'WS': {
          if (args.length < 2) {
            push('err', 'usage: WS <symA> <symB>')
            break
          }
          const a = normSym(args[0])
          const b = normSym(args[1])
          const ia = watchlist.indexOf(a)
          const ib = watchlist.indexOf(b)
          if (ia < 0 || ib < 0) {
            push('err', 'both symbols must be in watchlist')
            break
          }
          const next = [...watchlist]
          ;[next[ia], next[ib]] = [next[ib], next[ia]]
          persistWl(next)
          push('sys', `swapped ${a} ↔ ${b}`)
          break
        }

        /* ─── PAPER ─── */
        case 'POS': {
          const upnl = paperPositions.reduce((s, p) => s + positionUnrealizedPnl(p), 0)
          const margin = paperPositions.reduce((s, p) => s + p.margin, 0)
          const equity = paperAccount.balance + upnl + margin
          push(
            'out',
            `PAPER  bal ${fmt(paperAccount.balance)}  equity ${fmt(equity)}  uPnL ${upnl >= 0 ? '+' : ''}${fmt(upnl)}`
          )
          if (!paperPositions.length) {
            push('out', '  (no open positions)')
          } else {
            for (const p of paperPositions) {
              const u = positionUnrealizedPnl(p)
              push(
                'tbl',
                `  ${p.side.toUpperCase().padEnd(5)} ${p.symbol}  qty ${fmt(p.qty, 4)}  entry ${fmtPx(p.entryPrice)}  uPnL ${u >= 0 ? '+' : ''}${fmt(u)}  ${p.leverage}x ${p.marginMode}`
              )
            }
          }
          break
        }

        case 'ORDERS': {
          const open = paperOrders.filter((o) => o.status === 'open')
          if (!open.length) {
            push('out', 'no open paper orders')
            break
          }
          push('tbl', `OPEN ORDERS  ${open.length}`)
          for (const o of open) {
            push(
              'tbl',
              `  ${o.side.padEnd(5)} ${o.type.padEnd(6)} ${o.symbol}  qty ${fmt(o.qty, 4)}  @ ${o.price != null ? fmtPx(o.price) : 'MKT'}`
            )
          }
          break
        }

        case 'FILLS': {
          const n = Math.min(30, Math.max(1, Number(arg1) || 10))
          const fills = paperFills.slice(0, n)
          if (!fills.length) {
            push('out', 'no paper fills')
            break
          }
          push('tbl', `FILLS  last ${fills.length}`)
          for (const f of fills) {
            push(
              'tbl',
              `  ${new Date(f.time).toLocaleTimeString()}  ${f.action.padEnd(8)} ${f.side} ${f.symbol}  ${fmt(f.qty, 4)} @ ${fmtPx(f.price)}`
            )
          }
          break
        }

        case 'BAL': {
          const upnl = paperPositions.reduce((s, p) => s + positionUnrealizedPnl(p), 0)
          const margin = paperPositions.reduce((s, p) => s + p.margin, 0)
          pushMulti(
            'tbl',
            [
              'PAPER BALANCE',
              `  available   ${fmt(paperAccount.balance)} USDT`,
              `  in margin   ${fmt(margin)} USDT`,
              `  uPnL        ${upnl >= 0 ? '+' : ''}${fmt(upnl)}`,
              `  equity      ${fmt(paperAccount.balance + upnl + margin)}`,
              `  positions   ${paperPositions.length}`,
              `  open orders ${paperOrders.filter((o) => o.status === 'open').length}`,
            ].join('\n')
          )
          break
        }

        default:
          push('err', `unknown: ${cmd}  ·  type HELP`)
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
            <span
              className={
                ticker.priceChangePercent >= 0
                  ? ' text-[#0ecb81] ml-1'
                  : ' text-[#f6465d] ml-1'
              }
            >
              {ticker.priceChangePercent >= 0 ? '+' : ''}
              {fmt(ticker.priceChangePercent, 2)}%
            </span>
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-0.5 leading-snug"
      >
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
          placeholder="HELP · WL · Q · BOOK · …"
          spellCheck={false}
          autoComplete="off"
        />
      </form>
    </div>
  )
}
