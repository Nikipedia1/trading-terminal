import { useMemo, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { runBacktest, makeBacktestBot } from './runBacktest'
import type { BotKind } from '../types'
import { BOT_KIND_META } from '../types'
import { useIsReadOnly } from '@/stores/sessionModeStore'

const KINDS = Object.keys(BOT_KIND_META) as BotKind[]

export function BacktestPanel() {
  const candles = useMarketStore((s) => s.candles)
  const symbol = useMarketStore((s) => s.symbol)
  const readOnly = useIsReadOnly()
  const [kind, setKind] = useState<BotKind>('rsi')
  const [result, setResult] = useState<ReturnType<typeof runBacktest> | null>(null)
  const [busy, setBusy] = useState(false)

  const canRun = candles.length >= 30 && !readOnly

  const run = () => {
    if (!canRun) return
    setBusy(true)
    try {
      const bot = makeBacktestBot(kind, symbol)
      const r = runBacktest({
        bot,
        candles: candles.map((c) => ({
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          time: c.time,
        })),
      })
      setResult(r)
    } finally {
      setBusy(false)
    }
  }

  const lastEq = useMemo(() => {
    if (!result?.equity.length) return null
    return result.equity[result.equity.length - 1]!.equity
  }, [result])

  return (
    <div className="h-full flex flex-col text-[11px] text-[#eaecef] bg-[#0b0e11]">
      <div className="px-2 py-1.5 border-b border-[#1e2329] flex items-center gap-2 shrink-0">
        <span className="font-semibold text-[#f0b90b]">Backtest</span>
        <span className="text-[#5e6673]">offline · pure engine</span>
      </div>
      <div className="p-2 flex flex-wrap gap-2 items-center border-b border-[#1e2329]">
        <select
          className="bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1"
          value={kind}
          onChange={(e) => setKind(e.target.value as BotKind)}
          disabled={readOnly}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {BOT_KIND_META[k].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!canRun || busy}
          onClick={run}
          className="px-2 py-1 rounded bg-[#f0b90b] text-[#0b0e11] font-medium disabled:opacity-40"
        >
          {busy ? 'Running…' : `Run on ${candles.length} bars`}
        </button>
        {readOnly && (
          <span className="text-[#f6465d] text-[10px]">Guest read-only</span>
        )}
      </div>
      {result && (
        <div className="p-2 space-y-1 overflow-auto flex-1">
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <span className="text-[#848e9c]">Trades</span>
            <span>{result.stats.trades}</span>
            <span className="text-[#848e9c]">Wins / Losses</span>
            <span>
              {result.stats.wins} / {result.stats.losses}
            </span>
            <span className="text-[#848e9c]">Realized</span>
            <span
              className={
                result.stats.realizedPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
              }
            >
              {result.stats.realizedPnl.toFixed(2)}
            </span>
            <span className="text-[#848e9c]">Max DD %</span>
            <span>{result.stats.maxDrawdownPct.toFixed(2)}</span>
            <span className="text-[#848e9c]">Final equity</span>
            <span>{(lastEq ?? result.stats.finalEquity).toFixed(2)}</span>
          </div>
        </div>
      )}
      {!result && (
        <div className="p-4 text-[#848e9c] text-[11px]">
          Load candles, pick strategy, run offline. Same signal engine as live bots.
        </div>
      )}
    </div>
  )
}
