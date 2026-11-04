/**
 * Ops Scanner — professional multi-symbol setup scanner.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getExchangeClient } from '@/data/exchanges/registry'
import { fetchKlinesPage } from '@/data/klines/history'
import { useLayoutStore } from '@/stores/layoutStore'
import { useMarketStore } from '@/stores/marketStore'
import type { ExchangeId, Interval } from '@/types'
import { SCAN_UNIVERSE, rankRows, scanSymbol } from './scanEngine'
import type { ScanFilter, ScanRow } from './types'

const INTERVALS: Interval[] = ['5m', '15m', '1h', '4h']
const REFRESH_MS = 45_000

function fmtPx(n: number) {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1000) return n.toFixed(1)
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}

function fmtPct(n: number) {
  if (!Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function biasColor(b: ScanRow['bias']) {
  if (b === 'long') return '#0ecb81'
  if (b === 'short') return '#f6465d'
  return '#848e9c'
}

function setupLabel(s: ScanRow['setup']) {
  switch (s) {
    case 'breakout':
      return 'BREAKOUT'
    case 'mean-revert':
      return 'MEAN-REV'
    case 'trend-cont':
      return 'TREND'
    case 'squeeze':
      return 'SQUEEZE'
    case 'range':
      return 'RANGE'
    default:
      return '—'
  }
}

export function OpsScannerPanel() {
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const updatePanel = useLayoutStore((s) => s.updatePanel)
  const setSymbol = useMarketStore((s) => s.setSymbol)

  const [interval, setIntervalTf] = useState<Interval>('15m')
  const [exchange] = useState<ExchangeId>('binance')
  const [filter, setFilter] = useState<ScanFilter>('all')
  const [rows, setRows] = useState<ScanRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastScanAt, setLastScanAt] = useState<number | null>(null)
  const [auto, setAuto] = useState(true)
  const [query, setQuery] = useState('')

  const runScan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const client = getExchangeClient(exchange)
      const out: ScanRow[] = []
      await Promise.all(
        SCAN_UNIVERSE.map(async (sym) => {
          try {
            const page = await fetchKlinesPage(client, sym, interval, { limit: 80 })
            const candles = page.map((k: any) => ({
              time: k.time,
              open: Number(k.open ?? k.o),
              high: Number(k.high ?? k.h),
              low: Number(k.low ?? k.l),
              close: Number(k.close ?? k.c),
              volume: Number(k.volume ?? k.v ?? 0),
            }))
            const row = scanSymbol(sym, candles as any, interval, exchange)
            if (row) out.push(row)
          } catch {
            /* skip symbol */
          }
        })
      )
      setRows(rankRows(out))
      setLastScanAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setLoading(false)
    }
  }, [exchange, interval])

  useEffect(() => {
    runScan()
  }, [runScan])

  useEffect(() => {
    if (!auto) return
    const id = window.setInterval(runScan, REFRESH_MS)
    return () => clearInterval(id)
  }, [auto, runScan])

  const visible = useMemo(() => {
    let list = rows
    if (filter === 'long') list = list.filter((r) => r.bias === 'long')
    if (filter === 'short') list = list.filter((r) => r.bias === 'short')
    if (filter === 'high-score') list = list.filter((r) => r.score >= 65)
    const q = query.trim().toUpperCase()
    if (q) list = list.filter((r) => r.symbol.includes(q))
    return list
  }, [rows, filter, query])

  const stats = useMemo(() => {
    const long = rows.filter((r) => r.bias === 'long').length
    const short = rows.filter((r) => r.bias === 'short').length
    const top = rows[0]
    return { long, short, neutral: rows.length - long - short, top }
  }, [rows])

  const openSymbol = (sym: string) => {
    setSymbol(sym)
    if (primaryPanelId) {
      updatePanel(primaryPanelId, { symbol: sym, interval, exchange })
    }
  }

  return (
    <div
      className="h-full min-h-0 flex flex-col"
      style={{ background: '#0b0e11', color: '#eaecef', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
    >
      <div
        className="shrink-0 flex items-center justify-between gap-2 px-3 py-2"
        style={{ background: 'linear-gradient(90deg,#1a1208 0%,#12161c 60%)', borderBottom: '1px solid #2a3140' }}
      >
        <div className="min-w-0">
          <div style={{ fontSize: 12, fontWeight: 800, color: '#F4D35E', letterSpacing: '0.08em' }}>
            OPS SCANNER
          </div>
          <div style={{ fontSize: 10, color: '#848e9c' }}>
            {exchange.toUpperCase()} · {interval} · {rows.length} assets
            {lastScanAt ? ` · ${new Date(lastScanAt).toLocaleTimeString()}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setAuto((v) => !v)}
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '4px 8px',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              background: auto ? '#0ecb81' : '#2b3139',
              color: auto ? '#0b0e11' : '#eaecef',
            }}
          >
            {auto ? 'AUTO' : 'MANUAL'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={runScan}
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '4px 10px',
              border: 'none',
              borderRadius: 4,
              cursor: loading ? 'wait' : 'pointer',
              background: '#F4D35E',
              color: '#1a1a1a',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'SCAN…' : 'SCAN NOW'}
          </button>
        </div>
      </div>

      <div
        className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2"
        style={{ borderBottom: '1px solid #1e2329', background: '#0d1117' }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          {INTERVALS.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setIntervalTf(tf)}
              style={{
                fontSize: 10,
                padding: '3px 8px',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
                background: interval === tf ? '#F4D35E' : '#1e2329',
                color: interval === tf ? '#1a1a1a' : '#c8d0dc',
                fontWeight: interval === tf ? 700 : 400,
              }}
            >
              {tf}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 16, background: '#2a3140' }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {([
            ['all', 'ALL'],
            ['long', 'LONG'],
            ['short', 'SHORT'],
            ['high-score', 'SCORE≥65'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              style={{
                fontSize: 10,
                padding: '3px 8px',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
                background: filter === id ? '#2b3139' : 'transparent',
                color:
                  id === 'long' ? '#0ecb81' : id === 'short' ? '#f6465d' : filter === id ? '#eaecef' : '#848e9c',
                fontWeight: filter === id ? 700 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter symbol…"
          style={{
            marginLeft: 'auto',
            width: 110,
            fontSize: 11,
            padding: '4px 8px',
            background: '#0b0e11',
            border: '1px solid #2a3140',
            borderRadius: 4,
            color: '#eaecef',
            outline: 'none',
          }}
        />
      </div>

      <div
        className="shrink-0 grid grid-cols-4 gap-2 px-3 py-2"
        style={{ borderBottom: '1px solid #1e2329', background: '#0d1117' }}
      >
        {[
          { label: 'LONG', value: stats.long, color: '#0ecb81' },
          { label: 'SHORT', value: stats.short, color: '#f6465d' },
          { label: 'NEUTRAL', value: stats.neutral, color: '#848e9c' },
          {
            label: 'TOP',
            value: stats.top ? `${stats.top.symbol} ${stats.top.score}` : '—',
            color: '#F4D35E',
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: '#12161c',
              border: '1px solid #1e2329',
              borderRadius: 6,
              padding: '6px 8px',
            }}
          >
            <div style={{ fontSize: 9, color: '#5e6673', letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="shrink-0 px-3 py-1.5" style={{ color: '#f6465d', fontSize: 11, background: '#2e0a12' }}>
          {error}
        </div>
      )}

      <div
        className="shrink-0 grid px-3 py-1.5"
        style={{
          gridTemplateColumns: '1.1fr 0.9fr 0.7fr 0.7fr 0.9fr 0.55fr 1.4fr',
          fontSize: 9,
          color: '#5e6673',
          letterSpacing: '0.05em',
          borderBottom: '1px solid #1e2329',
          background: '#0b0e11',
        }}
      >
        <span>SYMBOL</span>
        <span style={{ textAlign: 'right' }}>LAST</span>
        <span style={{ textAlign: 'right' }}>CHG %</span>
        <span style={{ textAlign: 'center' }}>BIAS</span>
        <span style={{ textAlign: 'center' }}>SETUP</span>
        <span style={{ textAlign: 'right' }}>SCORE</span>
        <span>NOTE</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {visible.length === 0 && !loading && (
          <div style={{ padding: 24, textAlign: 'center', color: '#5e6673', fontSize: 12 }}>
            Nessun risultato — avvia SCAN o cambia filtro.
          </div>
        )}
        {visible.map((r) => (
          <button
            key={r.symbol}
            type="button"
            onClick={() => openSymbol(r.symbol)}
            className="w-full grid px-3 py-2 text-left"
            style={{
              gridTemplateColumns: '1.1fr 0.9fr 0.7fr 0.7fr 0.9fr 0.55fr 1.4fr',
              borderBottom: '1px solid #151a21',
              background: 'transparent',
              cursor: 'pointer',
              color: 'inherit',
              font: 'inherit',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = '#12161c'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            <span style={{ fontWeight: 700, color: '#eaecef', fontSize: 12 }}>
              {r.symbol.replace('USDT', '')}
              <span style={{ color: '#5e6673', fontWeight: 400 }}>USDT</span>
            </span>
            <span style={{ textAlign: 'right', fontSize: 12, color: '#c8d0dc' }}>{fmtPx(r.last)}</span>
            <span
              style={{
                textAlign: 'right',
                fontSize: 12,
                fontWeight: 600,
                color: r.changePct >= 0 ? '#0ecb81' : '#f6465d',
              }}
            >
              {fmtPct(r.changePct)}
            </span>
            <span
              style={{
                textAlign: 'center',
                fontSize: 10,
                fontWeight: 800,
                color: biasColor(r.bias),
                letterSpacing: '0.04em',
              }}
            >
              {r.bias.toUpperCase()}
            </span>
            <span
              style={{
                textAlign: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: '#F4D35E',
                letterSpacing: '0.03em',
              }}
            >
              {setupLabel(r.setup)}
            </span>
            <span style={{ textAlign: 'right' }}>
              <span
                style={{
                  display: 'inline-block',
                  minWidth: 28,
                  padding: '1px 6px',
                  borderRadius: 3,
                  fontSize: 11,
                  fontWeight: 800,
                  background: r.score >= 70 ? '#0a2e24' : r.score >= 55 ? '#2e200a' : '#1e2329',
                  color: r.score >= 70 ? '#0ecb81' : r.score >= 55 ? '#F4D35E' : '#848e9c',
                }}
              >
                {r.score}
              </span>
            </span>
            <span
              style={{
                fontSize: 10,
                color: '#848e9c',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={r.summary}
            >
              {r.summary}
            </span>
          </button>
        ))}
      </div>

      <div
        className="shrink-0 px-3 py-1.5"
        style={{ borderTop: '1px solid #1e2329', fontSize: 9, color: '#5e6673' }}
      >
        Click riga → apre sul chart primario · Auto refresh {Math.round(REFRESH_MS / 1000)}s · Score da bias + range + momentum
      </div>
    </div>
  )
}

export default OpsScannerPanel
