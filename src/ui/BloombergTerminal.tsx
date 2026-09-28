/**
 * Bloomberg-style command terminal widget.
 * NOTE: Full terminal restored. Use PAIRS / FIND with expanded symbol groups
 * from src/data/symbols.ts (Major, L1, L2, DeFi, AI, Meme, Gaming, RWA, ...).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { usePaperStore } from '@/trading/paper'
import { SYMBOL_PRESETS, SYMBOL_GROUPS, ALL_INTERVALS, searchPresets, uniquePresets } from '@/data/symbols'
import { SymbolBadge } from '@/ui/SymbolBadge'
import type { Interval, ExchangeId } from '@/types'

const MAX_WL = 24
const MAX_LINES = 400

function loadWl(): string[] {
  try {
    const raw = localStorage.getItem('tt-bloomberg-wl')
    if (!raw) return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.slice(0, MAX_WL) : ['BTCUSDT', 'ETHUSDT']
  } catch {
    return ['BTCUSDT', 'ETHUSDT']
  }
}

function saveWl(list: string[]) {
  try {
    localStorage.setItem('tt-bloomberg-wl', JSON.stringify(list.slice(0, MAX_WL)))
  } catch {
    /* */
  }
}

function fmt(n: number, d = 2): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: d })
}

function fmtPx(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  return n < 1 ? n.toPrecision(6) : fmt(n, 2)
}

type LineKind = 'sys' | 'out' | 'err' | 'tbl' | 'cmd'

interface Line {
  id: string
  kind: LineKind
  text: string
}

const COMMANDS = [
  'HELP',
  'SYM',
  'EX',
  'TF',
  'FIND',
  'PAIRS',
  'STAT',
  'LAST',
  'BOOK',
  'POS',
  'FILLS',
  'WL',
  'WA',
  'WR',
  'CLEAR',
]

export function BloombergTerminal() {
  const symbol = useMarketStore((s) => s.symbol)
  const interval = useMarketStore((s) => s.interval)
  const exchange = useMarketStore((s) => s.exchange)
  const status = useMarketStore((s) => s.status)
  const ticker = useMarketStore((s) => s.ticker)
  const orderBook = useMarketStore((s) => s.orderBook)
  const setSymbol = useMarketStore((s) => s.setSymbol)
  const setIntervalStore = useMarketStore((s) => s.setInterval)
  const setExchange = useMarketStore((s) => s.setExchange)

  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const updatePanel = useLayoutStore((s) => s.updatePanel)

  const positions = usePaperStore((s) => s.positions)
  const paperFills = usePaperStore((s) => s.fills)

  const [lines, setLines] = useState<Line[]>(() => [
    {
      id: 'boot',
      kind: 'sys',
      text: 'TT DESK · type HELP · SYM BTCUSDT · FIND sol · PAIRS Major',
    },
  ])
  const [input, setInput] = useState('')
  const [watchlist, setWatchlist] = useState<string[]>(loadWl)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const idRef = useRef(0)

  const push = useCallback((kind: LineKind, text: string) => {
    idRef.current += 1
    setLines((prev) =>
      [...prev, { id: `l${idRef.current}`, kind, text }].slice(-MAX_LINES)
    )
  }, [])

  const pushMulti = useCallback((kind: LineKind, text: string) => {
    for (const row of text.split('\n')) push(kind, row)
  }, [push])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  const run = useCallback(
    (raw: string) => {
      const line = raw.trim()
      if (!line) return
      push('cmd', `> ${line}`)
      const parts = line.split(/\s+/)
      const cmd = (parts[0] || '').toUpperCase()
      const args = parts.slice(1)

      try {
        switch (cmd) {
          case 'HELP':
            pushMulti(
              'tbl',
              [
                'SYM <pair>     set symbol',
                'TF <interval>  1m 5m 15m 1h 4h 1d …',
                'EX <exchange>  binance | binance_futures | kucoin | bybit | okx',
                'FIND <q>       search presets',
                'PAIRS [group]  list Major|L1|L2|DeFi|…',
                'LAST / STAT    ticker',
                'BOOK           top of book',
                'POS / FILLS    paper',
                'WL / WA / WR   watchlist',
                'CLEAR',
              ].join('\n')
            )
            break
          case 'SYM': {
            if (!args[0]) {
              push('err', 'usage: SYM <symbol>')
              break
            }
            const sym = args[0].toUpperCase().replace(/[^A-Z0-9]/g, '')
            setSymbol(sym)
            updatePanel(primaryPanelId, { symbol: sym })
            push('sys', `symbol → ${sym}`)
            break
          }
          case 'TF': {
            const tf = (args[0] || '') as Interval
            if (!ALL_INTERVALS.includes(tf as (typeof ALL_INTERVALS)[number])) {
              push('err', `bad interval. try: ${ALL_INTERVALS.join(' ')}`)
              break
            }
            setIntervalStore(tf)
            updatePanel(primaryPanelId, { interval: tf })
            push('sys', `interval → ${tf}`)
            break
          }
          case 'EX': {
            const ex = (args[0] || '') as ExchangeId
            setExchange(ex)
            updatePanel(primaryPanelId, { exchange: ex })
            push('sys', `exchange → ${ex}`)
            break
          }
          case 'FIND': {
            const q = args.join(' ')
            const hits = searchPresets(q)
            if (!hits.length) push('out', 'no match')
            else
              hits
                .slice(0, 40)
                .forEach((p) =>
                  push(
                    'tbl',
                    `  ${p.symbol.padEnd(14)} ${(p.name ?? p.label).padEnd(16)} (${p.group})`
                  )
                )
            break
          }
          case 'PAIRS': {
            const g = args[0]
            const list = g
              ? uniquePresets().filter((p) => p.group.toLowerCase() === g.toLowerCase())
              : uniquePresets().filter((p) => p.group === 'Major')
            list.slice(0, 50).forEach((p) => push('tbl', `  ${p.symbol.padEnd(12)} ${p.name ?? p.label}`))
            if (!g) push('sys', `groups: ${SYMBOL_GROUPS.join(', ')}`)
            break
          }
          case 'LAST':
          case 'STAT': {
            const t = ticker
            if (!t) {
              push('err', 'no ticker — Start Live')
              break
            }
            push(
              'out',
              `${t.symbol} LAST ${fmtPx(t.lastPrice)} CHG ${fmt(t.priceChangePercent, 2)}%`
            )
            break
          }
          case 'BOOK': {
            if (!orderBook) {
              push('err', 'no book')
              break
            }
            orderBook.bids.slice(0, 5).forEach((l) =>
              push('tbl', `  BID ${fmtPx(l.price)} × ${fmt(l.qty, 4)}`)
            )
            orderBook.asks.slice(0, 5).forEach((l) =>
              push('tbl', `  ASK ${fmtPx(l.price)} × ${fmt(l.qty, 4)}`)
            )
            break
          }
          case 'POS': {
            if (!positions.length) push('out', 'no paper positions')
            else
              positions.forEach((p) =>
                push('tbl', `  ${p.side} ${p.symbol} ${fmt(p.qty, 4)} @ ${fmtPx(p.entryPrice)}`)
              )
            break
          }
          case 'FILLS': {
            paperFills.slice(0, 10).forEach((f) =>
              push('tbl', `  ${f.side} ${f.symbol} ${fmt(f.qty, 4)}`)
            )
            break
          }
          case 'WL': {
            push('out', `WL ${watchlist.join(' ')}`)
            break
          }
          case 'WA': {
            const s = (args[0] || '').toUpperCase()
            if (!s) {
              push('err', 'WA <symbol>')
              break
            }
            const next = Array.from(new Set([...watchlist, s])).slice(0, MAX_WL)
            setWatchlist(next)
            saveWl(next)
            push('sys', `WL ${next.length} symbols`)
            break
          }
          case 'WR': {
            const s = (args[0] || '').toUpperCase()
            const next = watchlist.filter((x) => x !== s)
            setWatchlist(next)
            saveWl(next)
            push('sys', `removed ${s}`)
            break
          }
          case 'CLEAR':
            setLines([])
            break
          default:
            push('err', `unknown: ${cmd} — HELP`)
        }
      } catch (e: any) {
        push('err', e?.message || String(e))
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
      setSymbol,
      setExchange,
      setIntervalStore,
      updatePanel,
      ticker,
      orderBook,
      positions,
      paperFills,
      watchlist,
    ]
  )

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const v = input
      setInput('')
      run(v)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const partial = input.trim().toUpperCase()
      const match = COMMANDS.find((c) => c.startsWith(partial))
      if (match)
        setInput(match + (['SYM', 'EX', 'TF', 'FIND', 'WA', 'WR'].includes(match) ? ' ' : ''))
    }
  }

  return (
    <div
      className="h-full flex flex-col min-h-0 bg-[#0a0c10] font-mono text-[11px] select-text"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="shrink-0 flex items-center gap-3 px-2 py-1.5 border-b border-[#1a2332] bg-[#0d1118] text-[10px]">
        <span className="text-[#f0b90b] font-semibold">TT</span>
        <SymbolBadge symbol={symbol} size="sm" />
        <span className="text-[#848e9c]">{interval}</span>
        <span className="text-[#848e9c]">{exchange}</span>
        <span className={status === 'connected' ? 'text-[#0ecb81]' : 'text-[#f0b90b]'}>
          {status.toUpperCase()}
        </span>
        <span className="text-[#5e6673]">WL:{watchlist.length}</span>
        {ticker && (
          <span className="ml-auto text-[#eaecef] tabular-nums">{fmtPx(ticker.lastPrice)}</span>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-0.5">
        {lines.map((l) => (
          <div
            key={l.id}
            className={
              l.kind === 'err'
                ? 'text-[#f6465d]'
                : l.kind === 'cmd'
                  ? 'text-[#5b8def]'
                  : l.kind === 'sys'
                    ? 'text-[#f0b90b]'
                    : l.kind === 'tbl'
                      ? 'text-[#848e9c] whitespace-pre'
                      : 'text-[#eaecef]'
            }
          >
            {l.text}
          </div>
        ))}
      </div>
      <div className="shrink-0 flex items-center gap-1 px-2 py-1 border-t border-[#1a2332] bg-[#0d1118]">
        <span className="text-[#f0b90b]">></span>
        <input
          ref={inputRef}
          className="flex-1 bg-transparent outline-none text-[#eaecef]"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          autoComplete="off"
          placeholder="HELP · SYM BTCUSDT · FIND eth"
        />
      </div>
    </div>
  )
}
