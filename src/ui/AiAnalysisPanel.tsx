/**
 * AI Desk – technical (local) + optional fundamental narrative.
 * Auto-draws S/R, trendline, fib on the primary chart via drawingStore.
 */

import { useCallback, useMemo, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { useDrawingStore } from '@/drawings/drawingStore'
import { analyzeCandles, reportToDrawings, type TaReport } from '@/analysis/aiDesk/taEngine'

type Tab = 'tech' | 'fund'

function biasColor(b: TaReport['bias']) {
  if (b === 'bullish') return 'text-[#0ecb81]'
  if (b === 'bearish') return 'text-[#f6465d]'
  return 'text-[#f0b90b]'
}

function fundamentalHeuristic(report: TaReport, symbol: string): string[] {
  const lines: string[] = []
  lines.push(`Context for ${symbol} (heuristic – not live news feed):`)
  lines.push(
    '• Crypto fundamentals: monitor BTC dominance, ETF flows, funding rates, open interest, and macro (DXY/rates).'
  )
  if (report.bias === 'bullish') {
    lines.push(
      '• Structure is constructive (HH/HL or rising swing lows). Favor dips to support over chasing extensions.'
    )
  } else if (report.bias === 'bearish') {
    lines.push(
      '• Structure is weak (LH/LL or falling swing highs). Rallies into resistance are higher-risk long entries.'
    )
  } else {
    lines.push('• Range / mixed structure. Wait for break + retest of nearest S/R before size.')
  }
  if (report.supports[0]) {
    lines.push(`• Nearest demand zone ~ ${report.supports[0].toFixed(4)} (local swing cluster).`)
  }
  if (report.resistances[0]) {
    lines.push(`• Nearest supply zone ~ ${report.resistances[0].toFixed(4)}.`)
  }
  lines.push(
    '• Optional: set VITE_XAI_API_KEY for Grok narrative enrichment (coming via edge proxy).'
  )
  lines.push('• Not financial advice. Levels from your live candles only.')
  return lines
}

export function AiAnalysisPanel() {
  const candles = useMarketStore((s) => s.candles)
  const symbol = useMarketStore((s) => s.symbol)
  const interval = useMarketStore((s) => s.interval)
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const addDrawing = useDrawingStore((s) => s.addDrawing)
  const clearDrawings = useDrawingStore((s) => s.clearDrawings)
  const getDrawings = useDrawingStore((s) => s.getDrawings)
  const loadFromStorage = useDrawingStore((s) => s.loadFromStorage)

  const [tab, setTab] = useState<Tab>('tech')
  const [report, setReport] = useState<TaReport | null>(null)
  const [drawn, setDrawn] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)

  const runTa = useCallback(() => {
    const r = analyzeCandles(candles, symbol, interval)
    setReport(r)
    setMsg(`Analyzed ${candles.length} candles`)
    return r
  }, [candles, symbol, interval])

  const drawOnChart = useCallback(
    (r?: TaReport) => {
      const rep = r ?? report ?? analyzeCandles(candles, symbol, interval)
      setReport(rep)
      loadFromStorage(primaryPanelId, symbol)
      const drawings = reportToDrawings(rep, 'AI')
      // Remove previous AI-tagged horizontals/text optionally: keep user drawings
      for (const d of drawings) {
        addDrawing(primaryPanelId, symbol, d)
      }
      setDrawn(drawings.length)
      setMsg(`Drew ${drawings.length} objects on ${symbol}`)
    },
    [report, candles, symbol, interval, primaryPanelId, addDrawing, loadFromStorage]
  )

  const runAndDraw = useCallback(() => {
    const r = runTa()
    drawOnChart(r)
  }, [runTa, drawOnChart])

  const clearAi = useCallback(() => {
    // Clear all drawings on primary for this symbol (user asked auto-draw; provide clear)
    clearDrawings(primaryPanelId, symbol)
    setDrawn(0)
    setMsg('Cleared drawings on primary chart')
  }, [clearDrawings, primaryPanelId, symbol])

  const fundLines = useMemo(() => {
    if (!report) return []
    return fundamentalHeuristic(report, symbol)
  }, [report, symbol])

  const existing = getDrawings(primaryPanelId, symbol).length

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[11px]">
      {/* Actions */}
      <div className="shrink-0 px-2 py-2 border-b border-[#1e2329] space-y-1.5">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className="px-2 py-1 rounded bg-[#5b8def]/20 text-[#5b8def] border border-[#5b8def]/40 hover:bg-[#5b8def]/30"
            onClick={runTa}
          >
            Analyze
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded bg-[#0ecb81]/20 text-[#0ecb81] border border-[#0ecb81]/40 hover:bg-[#0ecb81]/30 font-semibold"
            onClick={runAndDraw}
            title="Run TA and draw S/R + trend + fib on primary chart"
          >
            Auto-draw
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded bg-[#f6465d]/15 text-[#f6465d] border border-[#f6465d]/30 hover:bg-[#f6465d]/25"
            onClick={clearAi}
          >
            Clear draws
          </button>
        </div>
        <div className="text-[9px] text-[#5e6673] flex justify-between">
          <span>
            {symbol} · {interval} · {candles.length} bars
          </span>
          <span>
            chart drawings: {existing}
            {drawn ? ` · last +${drawn}` : ''}
          </span>
        </div>
        {msg && <div className="text-[9px] text-[#f0b90b]">{msg}</div>}
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex border-b border-[#1e2329]">
        {(
          [
            ['tech', 'Technical'],
            ['fund', 'Fundamental'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`flex-1 py-1.5 text-[10px] uppercase tracking-wider ${
              tab === id
                ? 'text-[#f0b90b] border-b-2 border-[#f0b90b]'
                : 'text-[#848e9c]'
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-2">
        {!report && (
          <p className="text-[#5e6673] leading-relaxed">
            Press <strong className="text-[#eaecef]">Analyze</strong> for levels, or{' '}
            <strong className="text-[#0ecb81]">Auto-draw</strong> to paint support, resistance,
            trendline and fib on the primary chart from live candles.
          </p>
        )}

        {report && tab === 'tech' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[#848e9c]">Bias</span>
              <span className={`font-semibold uppercase ${biasColor(report.bias)}`}>
                {report.bias}
              </span>
              <span className="text-[#5e6673] ml-auto">
                range {report.rangePos.toFixed(0)}%
              </span>
            </div>

            <div className="space-y-1">
              {report.summary.map((line, i) => (
                <p key={i} className="text-[#b7bdc6] leading-snug">
                  {line}
                </p>
              ))}
            </div>

            {report.supports.length > 0 && (
              <div>
                <div className="text-[9px] text-[#0ecb81] uppercase mb-0.5">Support</div>
                <div className="flex flex-wrap gap-1">
                  {report.supports.map((p) => (
                    <span
                      key={p}
                      className="px-1.5 py-0.5 rounded bg-[#0ecb81]/15 text-[#0ecb81] font-mono"
                    >
                      {p.toFixed(4)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {report.resistances.length > 0 && (
              <div>
                <div className="text-[9px] text-[#f6465d] uppercase mb-0.5">Resistance</div>
                <div className="flex flex-wrap gap-1">
                  {report.resistances.map((p) => (
                    <span
                      key={p}
                      className="px-1.5 py-0.5 rounded bg-[#f6465d]/15 text-[#f6465d] font-mono"
                    >
                      {p.toFixed(4)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {report.fib && (
              <div>
                <div className="text-[9px] text-[#f0b90b] uppercase mb-0.5">Fib levels</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[#848e9c]">
                  {report.fib.levels.map((l) => (
                    <div key={l.ratio} className="flex justify-between">
                      <span>{(l.ratio * 100).toFixed(1)}%</span>
                      <span className="text-[#eaecef]">{l.price.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {report && tab === 'fund' && (
          <div className="space-y-1.5">
            {fundLines.map((line, i) => (
              <p key={i} className="text-[#b7bdc6] leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 px-2 py-1 text-[9px] text-[#5e6673] border-t border-[#1e2329] leading-snug">
        Local TA on your candles · Auto-draw uses drawing tools (H-lines, trend, fib, label)
      </div>
    </div>
  )
}
