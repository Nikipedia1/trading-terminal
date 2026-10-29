import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAssetDetail, fetchMarketBreadth } from './engine'
import type { AssetDetail, MarketBreadth, ObBoardTab, RankedAsset } from './types'

const REFRESH_MS = 60_000

function fmtPct(n: number) {
  const s = n >= 0 ? '+' : ''
  return `${s}${n.toFixed(2)}%`
}

function fmtPx(n: number) {
  if (n >= 1000) return n.toFixed(2)
  if (n >= 1) return n.toFixed(4)
  return n.toPrecision(4)
}

function BreadthCanvas({ assets }: { assets: RankedAsset[] }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !assets.length) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = canvas.clientWidth || 400
    const h = canvas.clientHeight || 220
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const sorted = [...assets].sort((a, b) => b.changePct - a.changePct)
    const maxAbs = Math.max(3, ...sorted.map((a) => Math.abs(a.changePct)))
    const pad = 8
    const midY = h / 2

    // zero line
    ctx.strokeStyle = '#2b3139'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pad, midY)
    ctx.lineTo(w - pad, midY)
    ctx.stroke()

    const n = sorted.length
    sorted.forEach((a, i) => {
      const x = pad + ((w - pad * 2) * i) / Math.max(1, n - 1)
      const y = midY - (a.changePct / maxAbs) * (h / 2 - pad)
      ctx.fillStyle = a.changePct >= 0 ? '#0ecb81' : '#f6465d'
      ctx.beginPath()
      ctx.arc(x, y, 2.2, 0, Math.PI * 2)
      ctx.fill()
      // faint trail from zero
      ctx.strokeStyle = a.changePct >= 0 ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)'
      ctx.beginPath()
      ctx.moveTo(x, midY)
      ctx.lineTo(x, y)
      ctx.stroke()
    })

    // labels
    ctx.fillStyle = '#848e9c'
    ctx.font = '10px ui-monospace, monospace'
    ctx.fillText(`+${maxAbs.toFixed(0)}%`, pad, 12)
    ctx.fillText(`-${maxAbs.toFixed(0)}%`, pad, h - 4)
  }, [assets])

  return (
    <canvas
      ref={ref}
      className="w-full h-[180px] rounded border border-[#2b3139] bg-[#0d1117]"
    />
  )
}

function MiniSpark({ candles, bull }: { candles: AssetDetail['candles']; bull: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c || candles.length < 2) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = c.clientWidth || 280
    const h = c.clientHeight || 120
    c.width = Math.floor(w * dpr)
    c.height = Math.floor(h * dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const highs = candles.map((x) => x.high)
    const lows = candles.map((x) => x.low)
    const hi = Math.max(...highs)
    const lo = Math.min(...lows)
    const span = hi - lo || 1
    const xAt = (i: number) => (i / (candles.length - 1)) * (w - 4) + 2
    const yAt = (p: number) => h - 4 - ((p - lo) / span) * (h - 8)

    candles.forEach((bar, i) => {
      const x = xAt(i)
      const up = bar.close >= bar.open
      ctx.strokeStyle = up ? '#0ecb81' : '#f6465d'
      ctx.fillStyle = up ? 'rgba(14,203,129,0.35)' : 'rgba(246,70,93,0.35)'
      ctx.beginPath()
      ctx.moveTo(x, yAt(bar.high))
      ctx.lineTo(x, yAt(bar.low))
      ctx.stroke()
      const y0 = yAt(Math.max(bar.open, bar.close))
      const y1 = yAt(Math.min(bar.open, bar.close))
      ctx.fillRect(x - 1.5, y0, 3, Math.max(1, y1 - y0))
    })

    // tint
    ctx.fillStyle = bull ? 'rgba(14,203,129,0.04)' : 'rgba(246,70,93,0.04)'
    ctx.fillRect(0, 0, w, h)
  }, [candles, bull])

  return <canvas ref={ref} className="w-full h-[130px] rounded bg-[#0d1117]" />
}

function DetailCard({
  detail,
  onClose,
}: {
  detail: AssetDetail
  onClose: () => void
}) {
  const a = detail.asset
  const bull = a.side === 'bullish'
  return (
    <div className="absolute inset-2 z-20 flex flex-col rounded-lg border border-[#2b3139] bg-[#12161c] shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2b3139]">
        <span className="text-[13px] font-semibold">{a.base}</span>
        <span className="text-[10px] text-[#848e9c]">{a.symbol}</span>
        <span
          className={`text-[11px] font-mono ml-1 ${
            bull ? 'text-[#0ecb81]' : 'text-[#f6465d]'
          }`}
        >
          {fmtPct(a.changePct)}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e2329] text-[#848e9c]">
          {a.sector}
        </span>
        {a.buildUp !== 'neutral' && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              a.buildUp === 'long'
                ? 'bg-[#0ecb81]/15 text-[#0ecb81]'
                : 'bg-[#f6465d]/15 text-[#f6465d]'
            }`}
          >
            {a.buildUp === 'long' ? 'LONG BUILD-UP' : 'SHORT BUILD-UP'}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-[11px] text-[#848e9c] hover:text-[#eaecef] px-2"
        >
          ✕
        </button>
      </div>

      <div className="px-3 pt-2 grid grid-cols-4 gap-2 text-[10px] font-mono">
        <div>
          <div className="text-[#848e9c]">RANK</div>
          <div>
            p{a.percentile.toFixed(1)} · #{a.rank}
          </div>
        </div>
        <div>
          <div className="text-[#848e9c]">LAST</div>
          <div>{fmtPx(a.lastPrice)}</div>
        </div>
        <div>
          <div className="text-[#848e9c]">VWAP</div>
          <div>{detail.vwap != null ? fmtPx(detail.vwap) : '—'}</div>
        </div>
        <div>
          <div className="text-[#848e9c]">R:R</div>
          <div className={detail.rr != null && detail.rr >= 1.5 ? 'text-[#0ecb81]' : ''}>
            {detail.rr != null ? detail.rr.toFixed(1) : '—'}
          </div>
        </div>
      </div>

      <div className="px-3 py-2">
        <MiniSpark candles={detail.candles} bull={bull} />
      </div>

      {detail.zone && (
        <div className="px-3 pb-2 grid grid-cols-4 gap-2 text-[10px] font-mono">
          <div>
            <div className="text-[#f0b90b]">Z</div>
            <div>{fmtPx(detail.zone.z)}</div>
          </div>
          <div>
            <div className="text-[#f6465d]">S1</div>
            <div>{fmtPx(detail.zone.s1)}</div>
          </div>
          <div>
            <div className="text-[#0ecb81]">R1</div>
            <div>{fmtPx(detail.zone.r1)}</div>
          </div>
          <div>
            <div className="text-[#0ecb81]">R2</div>
            <div>{fmtPx(detail.zone.r2)}</div>
          </div>
        </div>
      )}

      <div className="px-3 pb-3 flex-1 overflow-y-auto">
        <div className="text-[10px] text-[#848e9c] mb-1">
          ORDER BLOCKS ({detail.orderBlocks.length})
        </div>
        <div className="space-y-1">
          {detail.orderBlocks.slice(-5).map((ob, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-[10px] font-mono px-2 py-1 rounded bg-[#0d1117] border border-[#2b3139]"
            >
              <span className={ob.kind === 'bullish' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                {ob.kind === 'bullish' ? 'OB▲' : 'OB▼'}
              </span>
              <span>
                {fmtPx(ob.bottom)} – {fmtPx(ob.top)}
              </span>
            </div>
          ))}
          {!detail.orderBlocks.length && (
            <div className="text-[10px] text-[#848e9c]">Nessun OB recente su 15m</div>
          )}
        </div>
      </div>
    </div>
  )
}

function AssetTile({
  a,
  onPick,
}: {
  a: RankedAsset
  onPick: (a: RankedAsset) => void
}) {
  const bull = a.side === 'bullish'
  return (
    <button
      type="button"
      onClick={() => onPick(a)}
      className={`text-left rounded border px-2 py-1.5 transition hover:border-[#f0b90b]/40 ${
        bull ? 'border-[#0ecb81]/25 bg-[#0ecb81]/05' : 'border-[#f6465d]/25 bg-[#f6465d]/05'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-semibold">{a.base}</span>
        <span className={`text-[10px] font-mono ${bull ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
          {fmtPct(a.changePct)}
        </span>
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[9px] text-[#848e9c]">#{a.rank} · {a.sector}</span>
        {a.buildUp !== 'neutral' && (
          <span className={`text-[8px] ${a.buildUp === 'long' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
            {a.buildUp === 'long' ? 'LONG BU' : 'SHORT BU'}
          </span>
        )}
      </div>
      {/* strength bar */}
      <div className="mt-1 h-1 rounded bg-[#1e2329] overflow-hidden">
        <div
          className={`h-full ${bull ? 'bg-[#0ecb81]' : 'bg-[#f6465d]'}`}
          style={{ width: `${Math.min(100, Math.abs(a.strength) * 100)}%` }}
        />
      </div>
    </button>
  )
}

export function OrderBlockPanel() {
  const [data, setData] = useState<MarketBreadth | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ObBoardTab>('bullish')
  const [detail, setDetail] = useState<AssetDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      setErr(null)
      const m = await fetchMarketBreadth()
      setData(m)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(t)
  }, [load])

  const openDetail = useCallback(async (a: RankedAsset) => {
    setDetailLoading(true)
    try {
      const d = await fetchAssetDetail(a)
      setDetail(d)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const board = useMemo(() => {
    if (!data) return []
    if (tab === 'bullish') {
      return data.assets
        .filter((a) => a.side === 'bullish')
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 24)
    }
    if (tab === 'bearish') {
      return data.assets
        .filter((a) => a.side === 'bearish')
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 24)
    }
    return data.assets
  }, [data, tab])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] relative">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#2b3139] shrink-0">
        <span className="text-[11px] font-semibold text-[#0ecb81] tracking-wide">ORDER BLOCK</span>
        <span className="text-[10px] text-[#848e9c] font-mono">
          crypto X-ray · Binance 24h
        </span>
        {data && (
          <span className="text-[10px] font-mono ml-1">
            <span className="text-[#0ecb81]">{data.bullish}↑</span>
            {' / '}
            <span className="text-[#f6465d]">{data.bearish}↓</span>
            <span className="text-[#848e9c]"> · avg {fmtPct(data.avgChangePct)}</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto text-[10px] px-2 py-0.5 rounded border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-1 px-2 py-1 border-b border-[#2b3139] shrink-0">
        {(
          [
            ['bullish', 'Bullish'],
            ['bearish', 'Bearish'],
            ['breadth', 'Breadth'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`text-[10px] px-2 py-0.5 rounded border ${
              tab === id
                ? 'border-[#0ecb81]/50 bg-[#0ecb81]/15 text-[#0ecb81]'
                : 'border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && !data && (
        <div className="p-4 text-[12px] text-[#848e9c]">Carico ticker Binance…</div>
      )}
      {err && (
        <div className="px-3 py-2 text-[11px] text-[#f6465d] border-b border-[#2b3139]">{err}</div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {data && tab === 'breadth' && (
          <>
            <BreadthCanvas assets={data.assets} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {data.sectors.map((s) => (
                <div
                  key={s.sector}
                  className="rounded border border-[#2b3139] bg-[#12161c] px-2 py-1.5"
                >
                  <div className="text-[10px] text-[#848e9c]">{s.sector}</div>
                  <div
                    className={`text-[12px] font-mono ${
                      s.changePct >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                    }`}
                  >
                    {fmtPct(s.changePct)}
                  </div>
                  <div className="text-[9px] text-[#848e9c]">
                    {s.bullish}↑ {s.bearish}↓ · n={s.count}
                  </div>
                </div>
              ))}
            </div>
            {data.leadingSector && (
              <div className="text-[10px] text-[#848e9c]">
                Leading: <span className="text-[#0ecb81]">{data.leadingSector.sector}</span>
                {' · '}
                Lagging:{' '}
                <span className="text-[#f6465d]">{data.laggingSector?.sector}</span>
              </div>
            )}
          </>
        )}

        {data && tab !== 'breadth' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {board.map((a) => (
              <AssetTile key={a.symbol} a={a} onPick={openDetail} />
            ))}
          </div>
        )}

        {detailLoading && (
          <div className="text-[11px] text-[#848e9c] px-1">Apro chart + order blocks…</div>
        )}
      </div>

      {detail && <DetailCard detail={detail} onClose={() => setDetail(null)} />}

      {data && (
        <div className="shrink-0 px-2 py-1 border-t border-[#2b3139] text-[9px] text-[#848e9c] font-mono">
          Aggiornato {new Date(data.updatedAt).toLocaleTimeString()} · refresh 60s · dati pubblici
          Binance
        </div>
      )}
    </div>
  )
}
