/**
 * Cluster Chart panel – price × time footprint matrix (ATAS-style clusters).
 * Real aggressor ticks only via tradeBuffer + footprint compute.
 */
import { useEffect, useMemo, useState } from 'react'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { retainTradeBuffer, queryTradesInRange } from '@/analysis/deepPrint'
import { intervalToSeconds } from '@/analysis/deepPrint/interval'
import {
  buildFootprintCells,
  buildFootprintBars,
  DEFAULT_FOOTPRINT_CONFIG,
  FOOTPRINT_NOTE,
  type FootprintBar,
  type FootprintCell,
} from '@/analysis/footprint'

type ClusterMode = 'bidask' | 'delta' | 'volume'

function fmtPx(p: number) {
  if (!Number.isFinite(p)) return '—'
  if (p >= 1000) return p.toFixed(1)
  if (p >= 1) return p.toFixed(2)
  return p.toFixed(4)
}

function fmtQty(q: number) {
  if (!Number.isFinite(q) || q === 0) return ''
  if (q >= 1000) return q.toFixed(1)
  if (q >= 1) return q.toFixed(2)
  return q.toFixed(3)
}

function fmtTime(sec: number) {
  const d = new Date(sec * 1000)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function cellBg(mode: ClusterMode, cell: FootprintCell, maxVol: number, maxAbsDelta: number): string {
  const tot = cell.buyQty + cell.sellQty
  if (mode === 'delta') {
    const a = Math.min(1, Math.abs(cell.delta) / Math.max(maxAbsDelta, 1e-9))
    if (cell.delta > 0) return `rgba(14, 203, 129, ${0.12 + a * 0.55})`
    if (cell.delta < 0) return `rgba(246, 70, 93, ${0.12 + a * 0.55})`
    return 'transparent'
  }
  if (mode === 'volume') {
    const a = Math.min(1, tot / Math.max(maxVol, 1e-9))
    return `rgba(240, 185, 11, ${0.08 + a * 0.5})`
  }
  // bidask: neutral base; numbers carry side color
  const a = Math.min(1, tot / Math.max(maxVol, 1e-9))
  return `rgba(30, 35, 41, ${0.35 + a * 0.45})`
}

export function ClusterChartPanel() {
  const link = useResolvedChartLink('follow')
  const { symbol, interval, exchange } = link
  const { candles } = usePanelMarket(symbol, interval, exchange)
  const [cells, setCells] = useState<FootprintCell[]>([])
  const [bars, setBars] = useState<FootprintBar[]>([])
  const [mode, setMode] = useState<ClusterMode>('bidask')
  const [maxCandles, setMaxCandles] = useState(12)

  const cfg = DEFAULT_FOOTPRINT_CONFIG
  const sec = intervalToSeconds(interval)

  useEffect(() => {
    return retainTradeBuffer(exchange, (symbol ?? '').toUpperCase())
  }, [exchange, symbol])

  useEffect(() => {
    if (candles.length < 2) {
      setCells([])
      setBars([])
      return
    }
    const slice = candles.slice(-maxCandles)
    const times = slice.map((c) => c.time)
    const t0 = times[0]!
    const t1 = times[times.length - 1]! + sec

    const tick = () => {
      const trades = queryTradesInRange(exchange, (symbol ?? '').toUpperCase(), t0, t1)
      const nextCells = buildFootprintCells(trades, times, interval)
      const nextBars = buildFootprintBars(nextCells)
      setCells(nextCells)
      setBars(nextBars)
    }
    tick()
    const id = window.setInterval(tick, 700)
    return () => window.clearInterval(id)
  }, [candles, exchange, symbol, interval, sec, maxCandles])

  const { priceLevels, timeCols, cellMap, maxVol, maxAbsDelta, barByTime } = useMemo(() => {
    const times = [...new Set(cells.map((c) => c.timeSec))].sort((a, b) => a - b)
    const prices = [...new Set(cells.map((c) => c.price))].sort((a, b) => b - a)
    const map = new Map<string, FootprintCell>()
    let mv = 0
    let md = 0
    for (const c of cells) {
      map.set(`${c.timeSec}|${c.price}`, c)
      const tot = c.buyQty + c.sellQty
      if (tot > mv) mv = tot
      const ad = Math.abs(c.delta)
      if (ad > md) md = ad
    }
    const bb = new Map<number, FootprintBar>()
    for (const b of bars) bb.set(b.timeSec, b)
    return {
      priceLevels: prices,
      timeCols: times,
      cellMap: map,
      maxVol: mv || 1,
      maxAbsDelta: md || 1,
      barByTime: bb,
    }
  }, [cells, bars])

  const minCellQty = maxVol * (cfg.minCellPct / 100)

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] text-[11px] font-mono">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex flex-wrap gap-2 items-center">
        <span className="text-[#f0b90b] font-semibold">CLUSTER</span>
        <span className="text-[#848e9c]">
          {symbol} · {interval} · {exchange}
        </span>
        <div className="flex items-center gap-1 ml-1">
          {(['bidask', 'delta', 'volume'] as ClusterMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`px-1.5 py-0.5 rounded text-[10px] border ${
                mode === m
                  ? 'border-[#f0b90b]/60 bg-[#f0b90b]/15 text-[#f0b90b]'
                  : 'border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]'
              }`}
              onClick={() => setMode(m)}
            >
              {m === 'bidask' ? 'Bid/Ask' : m === 'delta' ? 'Δ' : 'Vol'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-[10px] text-[#848e9c] ml-auto">
          bars
          <select
            className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px] text-[#eaecef]"
            value={maxCandles}
            onChange={(e) => setMaxCandles(Number(e.target.value))}
          >
            {[8, 12, 16, 24, 32].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[10px] text-[#5e6673]">
          {timeCols.length}×{priceLevels.length}
        </span>
      </div>
      <div className="px-2 py-1 text-[9px] text-[#5e6673] border-b border-[#1e2329]">{FOOTPRINT_NOTE}</div>

      {!cells.length && (
        <div className="flex-1 flex items-center justify-center text-[#5e6673] px-3 text-center">
          Nessun cluster — serve stream tick denso (es. BTC 1m). Avvia Live e attendi aggressor trades.
        </div>
      )}

      {cells.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="border-collapse" style={{ minWidth: '100%' }}>
            <thead className="sticky top-0 z-20 bg-[#0b0e11]">
              <tr>
                <th className="sticky left-0 z-30 bg-[#0b0e11] text-right px-1.5 py-1 text-[10px] text-[#5e6673] border-b border-r border-[#1e2329]">
                  Price
                </th>
                {timeCols.map((t) => {
                  const bar = barByTime.get(t)
                  return (
                    <th
                      key={t}
                      className="px-0.5 py-1 text-center text-[9px] text-[#848e9c] border-b border-[#1e2329] min-w-[72px]"
                      title={bar ? `Δ ${bar.delta.toFixed(3)} · POC ${fmtPx(bar.poc)}` : undefined}
                    >
                      <div>{fmtTime(t)}</div>
                      {bar && (
                        <div
                          className={`text-[9px] font-semibold ${
                            bar.delta >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                          }`}
                        >
                          {bar.delta >= 0 ? '+' : ''}
                          {bar.delta.toFixed(2)}
                          {bar.unfinishedHigh ? ' ↑' : ''}
                          {bar.unfinishedLow ? ' ↓' : ''}
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {priceLevels.map((price) => (
                <tr key={price}>
                  <td className="sticky left-0 z-10 bg-[#0b0e11] text-right px-1.5 py-0.5 text-[10px] text-[#eaecef] border-r border-[#1e2329] whitespace-nowrap">
                    {fmtPx(price)}
                  </td>
                  {timeCols.map((t) => {
                    const cell = cellMap.get(`${t}|${price}`)
                    const bar = barByTime.get(t)
                    const isPoc = bar && Math.abs(bar.poc - price) < 1e-12
                    if (!cell || cell.buyQty + cell.sellQty < minCellQty) {
                      return (
                        <td
                          key={t}
                          className={`px-0.5 py-0.5 border border-[#1e2329]/40 min-w-[72px] h-[22px] ${
                            isPoc ? 'outline outline-1 outline-[#f0b90b]/50' : ''
                          }`}
                        />
                      )
                    }
                    const bg = cellBg(mode, cell, maxVol, maxAbsDelta)
                    return (
                      <td
                        key={t}
                        className={`px-0.5 py-0.5 border border-[#1e2329]/60 text-center min-w-[72px] h-[22px] ${
                          isPoc ? 'outline outline-1 outline-[#f0b90b]/70' : ''
                        }`}
                        style={{ background: bg }}
                        title={`B ${cell.buyQty.toFixed(4)} / S ${cell.sellQty.toFixed(4)} · Δ ${cell.delta.toFixed(4)}`}
                      >
                        {mode === 'bidask' && (
                          <span className="inline-flex gap-0.5 text-[9px] leading-none">
                            <span className="text-[#f6465d]">{fmtQty(cell.sellQty) || '·'}</span>
                            <span className="text-[#5e6673]">|</span>
                            <span className="text-[#0ecb81]">{fmtQty(cell.buyQty) || '·'}</span>
                          </span>
                        )}
                        {mode === 'delta' && (
                          <span
                            className={`text-[9px] font-semibold ${
                              cell.delta >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                            }`}
                          >
                            {cell.delta >= 0 ? '+' : ''}
                            {fmtQty(cell.delta) || '0'}
                          </span>
                        )}
                        {mode === 'volume' && (
                          <span className="text-[9px] text-[#eaecef]">
                            {fmtQty(cell.buyQty + cell.sellQty)}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
