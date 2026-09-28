/**
 * Bloomberg-style desk terminal – command line for crypto analysis.
 * Real data only from marketStore / paper store. No synthetic prices.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { usePaperStore, positionUnrealizedPnl } from '@/trading/paper/paperStore'
import { SYMBOL_PRESETS } from '@/data/symbols'
import type { ExchangeId } from '@/types'

type LineKind = 'in' | 'out' | 'err' | 'sys' | 'tbl'

interface TermLine {
  id: number
  kind: LineKind
  text: string
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

const HELP_TEXT = `
COMMANDS  (Bloomberg-style crypto desk)
────────────────────────────────────────
  HELP / ?              this list
  Q / QUOTE [sym]       last, chg%, high/low, vol
  BOOK / OB [n]         top n bid/ask levels (default 8)
  TAPE [n]              last n trades (default 12)
  SPREAD                bid–ask spread + mid
  STAT / STATS          session stats from ticker
  IMB / IMBALANCE       book imbalance (bid qty vs ask qty)
  DEPTH                 cumulative depth summary
  POS / PAPER           paper positions + equity
  SYM <symbol>          set primary symbol (e.g. SYM ETHUSDT)
  EX <exchange>         set exchange (binance|kucoin|bybit|okx|binance_futures)
  PAIRS / LIST          major pairs presets
  TIME                  local + UTC clock
  CLR / CLEAR           clear screen
  WHO                   desk status (symbol, exchange, feed)
────────────────────────────────────────
Tab-complete: partial command + Tab
History: ↑ / ↓
`.trim()

const COMMANDS = [
  'HELP',
  'QUOTE',
  'Q',
  'BOOK',
  'OB',
  'TAPE',
  'SPREAD',
  'STAT',
  'STATS',
  'IMB',
  'IMBALANCE',
  'DEPTH',
  'POS',
  'PAPER',
  'SYM',
  'EX',
  'PAIRS',
  'LIST',
  'TIME',
  'CLR',
  'CLEAR',
  'WHO',
] as const

export function BloombergTerminal() {
  const [lines, setLines] = useState<TermLine[]>(() => [
    { id: ++lineSeq, kind: 'sys', text: 'TT TERMINAL  ·  crypto desk  ·  type HELP' },
    { id: ++lineSeq, kind: 'sys', text: '─────────────────────────────────────' },
  ])
  const [input, setInput] = useState('')
  const [hist, setHist] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const symbol = useMarketStore((s) => s.symbol)
  const exchange = useMarketStore((s) => s.exchange)
  const ticker = useMarketStore((s) => s.ticker)
  const book = useMarketStore((s) => s.orderBook)
  const trades = useMarketStore((s) => s.trades)
  const status = useMarketStore((s) => s.status)
  const setSymbol = useMarketStore((s) => s.setSymbol)
  const setExchange = useMarketStore((s) => s.setExchange)
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)

  const updatePanel = useLayoutStore((s) => s.updatePanel)
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)

  const paperAccount = usePaperStore((s) => s.account)
  const paperPositions = usePaperStore((s) => s.positions)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines])

  const push = useCallback((kind: LineKind, text: string) => {
    setLines((prev) => [...prev.slice(-400), { id: ++lineSeq, kind, text }])
  }, [])

  const pushMulti = useCallback((kind: LineKind, block: string) => {
    const parts = block.split('\n')
    setLines((prev) => [
      ...prev.slice(-400),
      ...parts.map((text) => ({ id: ++lineSeq, kind, text })),
    ])
  }, [])

  const run = useCallback(
    (raw: string) => {
      const trimmed = raw.trim()
      if (!trimmed) return
      push('in', `> ${trimmed}`)

      const parts = trimmed.split(/\s+/)
      const cmd = parts[0].toUpperCase()
      const arg1 = parts[1]?.toUpperCase()
      const arg2 = parts[2]

      switch (cmd) {
        case 'HELP':
        case '?':
          pushMulti('out', HELP_TEXT)
          break

        case 'CLR':
        case 'CLEAR':
          setLines([{ id: ++lineSeq, kind: 'sys', text: 'screen cleared' }])
          break

        case 'TIME': {
          const now = new Date()
          push(
            'out',
            `LOCAL  ${now.toLocaleString()}   UTC  ${now.toISOString().replace('T', ' ').slice(0, 19)}`
          )
          break
        }

        case 'WHO':
          push(
            'out',
            `${symbol}  ·  ${exchange}  ·  feed ${status}  ·  primary ${primaryPanelId}`
          )
          break

        case 'PAIRS':
        case 'LIST': {
          const groups = ['Major', 'L1', 'DeFi', 'Meme'] as const
          for (const g of groups) {
            const list = SYMBOL_PRESETS.filter((p) => p.group === g)
              .map((p) => p.symbol)
              .join('  ')
            push('out', `${g.padEnd(6)}  ${list}`)
          }
          break
        }

        case 'SYM': {
          if (!arg1) {
            push('err', 'usage: SYM <symbol>   e.g. SYM ETHUSDT')
            break
          }
          const sym = arg1.replace(/[^A-Z0-9]/g, '')
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
            push('err', `unknown exchange. try: ${allowed.join(' | ')}`)
            break
          }
          setExchange(ex)
          updatePanel(primaryPanelId, { exchange: ex })
          void loadHistorical().then(() => startLive())
          push('sys', `exchange → ${ex}`)
          break
        }

        case 'Q':
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

        case 'STAT':
        case 'STATS': {
          const t = ticker
          if (!t) {
            push('err', 'no ticker data')
            break
          }
          const range = t.highPrice - t.lowPrice
          const pos =
            range > 0 ? ((t.lastPrice - t.lowPrice) / range) * 100 : 50
          pushMulti(
            'tbl',
            [
              `STAT  ${t.symbol}`,
              `  last       ${fmtPx(t.lastPrice)}`,
              `  change     ${fmt(t.priceChangePercent, 2)}%`,
              `  high/low   ${fmtPx(t.highPrice)} / ${fmtPx(t.lowPrice)}`,
              `  range pos  ${fmt(pos, 1)}% of day range`,
              `  volume     ${fmt(t.volume, 3)} base`,
              `  quote vol  ${fmt(t.quoteVolume, 0)} USDT`,
            ].join('\n')
          )
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

        case 'BOOK':
        case 'OB': {
          if (!book) {
            push('err', 'no order book')
            break
          }
          const n = Math.min(20, Math.max(1, Number(arg1) || 8))
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
          const n = Math.min(40, Math.max(1, Number(arg1) || 12))
          if (!trades.length) {
            push('err', 'no trades')
            break
          }
          push('tbl', `TAPE  last ${Math.min(n, trades.length)}`)
          for (const t of trades.slice(0, n)) {
            const side = t.isBuyerMaker ? 'SELL' : 'BUY '
            const color = t.isBuyerMaker ? '↓' : '↑'
            push(
              'tbl',
              `  ${new Date(t.time).toLocaleTimeString()}  ${color}${side}  ${fmtPx(t.price)}  x ${fmt(t.qty, 4)}`
            )
          }
          break
        }

        case 'IMB':
        case 'IMBALANCE': {
          if (!book) {
            push('err', 'no book')
            break
          }
          const depth = 10
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
          let bc = 0
          let ac = 0
          const rows: string[] = ['DEPTH cumulative']
          for (let i = 0; i < 8; i++) {
            if (book.bids[i]) bc += book.bids[i].qty
            if (book.asks[i]) ac += book.asks[i].qty
            rows.push(
              `  L${i + 1}  bidΣ ${fmt(bc, 3).padStart(10)}   askΣ ${fmt(ac, 3).padStart(10)}`
            )
          }
          pushMulti('tbl', rows.join('\n'))
          break
        }

        case 'POS':
        case 'PAPER': {
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

        default:
          push('err', `unknown command: ${cmd}  ·  type HELP`)
      }
    },
    [
      push,
      pushMulti,
      symbol,
      exchange,
      status,
      primaryPanelId,
      ticker,
      book,
      trades,
      setSymbol,
      setExchange,
      updatePanel,
      loadHistorical,
      startLive,
      paperAccount,
      paperPositions,
    ]
  )

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = input.trim()
    if (!v) return
    setHist((h) => [v, ...h.filter((x) => x !== v)].slice(0, 50))
    setHistIdx(-1)
    setInput('')
    run(v)
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
      if (match) setInput(match + (match === 'SYM' || match === 'EX' ? ' ' : ''))
    }
  }

  return (
    <div
      className="h-full flex flex-col min-h-0 bg-[#0a0c10] font-mono text-[11px] select-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Status strip */}
      <div className="shrink-0 flex items-center gap-3 px-2 py-1 border-b border-[#1a2332] bg-[#0d1118] text-[10px]">
        <span className="text-[#f0b90b] font-semibold tracking-wider">TT</span>
        <span className="text-[#5b8def]">{symbol}</span>
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

      {/* Output */}
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

      {/* Command line */}
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
