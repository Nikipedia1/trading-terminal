/**
 * AI Desk – modes, SMC tools (FVG/OB/BOS/VP), chat, auto-draw.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { useDrawingStore } from '@/drawings/drawingStore'
import { analyzeCandles, reportToDrawings, type TaReport } from '@/analysis/aiDesk/taEngine'
import {
  analyzeSmc,
  smcToDrawings,
  type SmcReport,
} from '@/analysis/aiDesk/smcEngine'
import {
  AI_MODES,
  DEFAULT_DRAW_OPTS,
  answerMessage,
  type AiMode,
  type DrawOptions,
} from '@/analysis/aiDesk/chatEngine'
import type { Drawing } from '@/drawings/types'

interface ChatMsg {
  id: number
  role: 'user' | 'ai' | 'sys'
  text: string
}

let msgSeq = 0

function filterClassic(all: Drawing[], opts: DrawOptions): Drawing[] {
  return all.filter((d) => {
    if (d.tool === 'horizontal') {
      if (d.style.color === '#0ecb81') return opts.support
      if (d.style.color === '#f6465d') return opts.resistance
      return opts.support || opts.resistance
    }
    if (d.tool === 'trendline') return opts.trend
    if (d.tool === 'fib_retracement') return opts.fib
    if (d.tool === 'text' && String(d).includes) {
      // classic AI label only if label on; SMC texts come from smcToDrawings
      if ('text' in d && /^AI /i.test((d as { text: string }).text)) return opts.label
    }
    if (d.tool === 'text') return opts.label
    return true
  })
}

const QUICK = [
  'Bias',
  'FVG',
  'Order block',
  'Volume profile',
  'BOS',
  'Disegna',
  'Help',
]

export function AiAnalysisPanel() {
  const candles = useMarketStore((s) => s.candles)
  const symbol = useMarketStore((s) => s.symbol)
  const interval = useMarketStore((s) => s.interval)
  const ticker = useMarketStore((s) => s.ticker)
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const addDrawing = useDrawingStore((s) => s.addDrawing)
  const clearDrawings = useDrawingStore((s) => s.clearDrawings)
  const getDrawings = useDrawingStore((s) => s.getDrawings)
  const loadFromStorage = useDrawingStore((s) => s.loadFromStorage)

  const [mode, setMode] = useState<AiMode>('smc')
  const [opts, setOpts] = useState<DrawOptions>({ ...DEFAULT_DRAW_OPTS })
  const [report, setReport] = useState<TaReport | null>(null)
  const [smc, setSmc] = useState<SmcReport | null>(null)
  const [chat, setChat] = useState<ChatMsg[]>(() => [
    {
      id: ++msgSeq,
      role: 'sys',
      text: 'AI Desk · SMC attivo. FVG, Order Block, BOS, Volume Profile + chat.',
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [showOpts, setShowOpts] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [chat])

  const push = useCallback((role: ChatMsg['role'], text: string) => {
    setChat((c) => [...c.slice(-80), { id: ++msgSeq, role, text }])
  }, [])

  const ensure = useCallback(() => {
    const r = analyzeCandles(candles, symbol, interval)
    const s = analyzeSmc(candles)
    setReport(r)
    setSmc(s)
    return { r, s }
  }, [candles, symbol, interval])

  const applyDraw = useCallback(
    (r: TaReport, s: SmcReport) => {
      loadFromStorage(primaryPanelId, symbol)
      const classic = filterClassic(reportToDrawings(r, 'AI'), opts)
      const smcDraws = smcToDrawings(s, {
        fvg: opts.fvg,
        orderBlock: opts.orderBlock,
        bos: opts.bos,
        volumeProfile: opts.volumeProfile,
        onlyUnmitigatedFvg: true,
      })
      const all = [...classic, ...smcDraws]
      for (const d of all) addDrawing(primaryPanelId, symbol, d)
      return all.length
    },
    [opts, primaryPanelId, symbol, addDrawing, loadFromStorage]
  )

  const onAutoDraw = useCallback(() => {
    const { r, s } = ensure()
    const n = applyDraw(r, s)
    push('sys', `Auto-draw: ${n} oggetti (TA + SMC) su ${symbol}`)
  }, [ensure, applyDraw, push, symbol])

  const onClear = useCallback(() => {
    clearDrawings(primaryPanelId, symbol)
    push('sys', 'Disegni cancellati')
  }, [clearDrawings, primaryPanelId, symbol, push])

  const onAnalyze = useCallback(() => {
    const { r, s } = ensure()
    push(
      'ai',
      [
        `**${r.symbol}** ${r.interval} · bias **${r.bias}**`,
        ...r.summary,
        '',
        '— SMC —',
        ...s.summary,
      ].join('\n')
    )
  }, [ensure, push])

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim()
      if (!text) return
      setInput('')
      push('user', text)
      setBusy(true)
      window.setTimeout(() => {
        const { r, s } = ensure()
        const { text: reply, suggestDraw } = answerMessage(text, r, mode, s)
        push('ai', reply)
        if (suggestDraw || /\b(disegn|draw|traccia)\b/i.test(text)) {
          const n = applyDraw(r, s)
          push('sys', `Draw: ${n} oggetti`)
        }
        setBusy(false)
      }, 80)
    },
    [push, ensure, mode, applyDraw]
  )

  const existing = getDrawings(primaryPanelId, symbol).length

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[11px]">
      <div className="shrink-0 px-2 pt-2 pb-1 border-b border-[#1e2329]">
        <div className="text-[9px] text-[#848e9c] uppercase tracking-wider mb-1">Mode</div>
        <div className="flex flex-wrap gap-1">
          {AI_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.hint}
              onClick={() => {
                setMode(m.id)
                push('sys', `Mode → ${m.label}`)
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] border ${
                mode === m.id
                  ? 'bg-[#f0b90b]/20 text-[#f0b90b] border-[#f0b90b]/50'
                  : 'bg-transparent text-[#848e9c] border-[#2b3139] hover:border-[#5e6673]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] space-y-1.5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="text-[9px] text-[#848e9c] uppercase tracking-wider hover:text-[#eaecef]"
            onClick={() => setShowOpts((v) => !v)}
          >
            Draw options {showOpts ? '▾' : '▸'}
          </button>
          <span className="text-[9px] text-[#5e6673]">
            {symbol} · {interval} · {candles.length}b · {existing}d
          </span>
        </div>
        {showOpts && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {(
              [
                ['support', 'Support'],
                ['resistance', 'Resist'],
                ['trend', 'Trend'],
                ['fib', 'Fib'],
                ['fvg', 'FVG'],
                ['orderBlock', 'Order Block'],
                ['bos', 'BOS/CHoCH'],
                ['volumeProfile', 'Vol Profile'],
                ['label', 'Label'],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-1 text-[10px] text-[#b7bdc6] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={opts[key]}
                  onChange={(e) => setOpts((o) => ({ ...o, [key]: e.target.checked }))}
                  className="accent-[#f0b90b]"
                />
                {label}
              </label>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={onAnalyze}
            className="px-2 py-1 rounded bg-[#5b8def]/20 text-[#5b8def] border border-[#5b8def]/40 hover:bg-[#5b8def]/30"
          >
            Analyze
          </button>
          <button
            type="button"
            onClick={onAutoDraw}
            className="px-2 py-1 rounded bg-[#0ecb81]/20 text-[#0ecb81] border border-[#0ecb81]/40 hover:bg-[#0ecb81]/30 font-semibold"
          >
            Auto-draw
          </button>
          <button
            type="button"
            onClick={onClear}
            className="px-2 py-1 rounded bg-[#f6465d]/15 text-[#f6465d] border border-[#f6465d]/30 hover:bg-[#f6465d]/25"
          >
            Clear
          </button>
        </div>
        {ticker && (
          <div className="text-[9px] text-[#5e6673] font-mono">
            last {ticker.lastPrice}{' '}
            <span className={ticker.priceChangePercent >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
              {ticker.priceChangePercent >= 0 ? '+' : ''}
              {ticker.priceChangePercent.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      <div className="shrink-0 px-2 py-1 flex gap-1 overflow-x-auto border-b border-[#1e2329]">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => send(q)}
            className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] bg-[#12161c] text-[#848e9c] border border-[#2b3139] hover:text-[#eaecef] hover:border-[#5e6673]"
          >
            {q}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-2"
        onClick={() => inputRef.current?.focus()}
      >
        {chat.map((m) => (
          <div
            key={m.id}
            className={
              m.role === 'user'
                ? 'ml-4 px-2 py-1.5 rounded-lg bg-[#1e2329] text-[#eaecef] whitespace-pre-wrap'
                : m.role === 'sys'
                  ? 'text-[9px] text-[#f0b90b] whitespace-pre-wrap'
                  : 'mr-2 px-2 py-1.5 rounded-lg bg-[#12161c] border border-[#1e2329] text-[#b7bdc6] whitespace-pre-wrap'
            }
          >
            {m.role === 'ai' && (
              <div className="text-[9px] text-[#5b8def] mb-0.5 uppercase tracking-wider">
                AI · {mode}
              </div>
            )}
            {m.text.split('**').map((chunk, i) =>
              i % 2 === 1 ? (
                <strong key={i} className="text-[#eaecef]">
                  {chunk}
                </strong>
              ) : (
                <span key={i}>{chunk}</span>
              )
            )}
          </div>
        ))}
        {busy && <div className="text-[9px] text-[#5e6673]">…</div>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-t border-[#1e2329] bg-[#0d1118]"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          className="flex-1 bg-[#12161c] border border-[#2b3139] rounded px-2 py-1.5 text-[#eaecef] outline-none focus:border-[#f0b90b]/50 placeholder:text-[#5e6673]"
          placeholder={`Messaggio AI (${mode}) — FVG, OB, VP…`}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="px-2.5 py-1.5 rounded bg-[#f0b90b]/20 text-[#f0b90b] border border-[#f0b90b]/40 hover:bg-[#f0b90b]/30 disabled:opacity-40"
        >
          Invia
        </button>
      </form>
    </div>
  )
}
