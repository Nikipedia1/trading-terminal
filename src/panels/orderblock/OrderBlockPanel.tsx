/**
 * Order Block terminal — Market X-Ray for crypto.
 * Bullish/Bearish boards, liquidity score, sector-capped PICKS,
 * OB zones (Z / S1 / R1 / R2), VWAP, R:R — OrderBlock playbook style.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAssetDetail, fetchMarketBreadth } from './engine'
import type { AssetDetail, MarketBreadth, ObBoardTab, RankedAsset } from './types'
import { useLayoutStore } from '@/stores/layoutStore'
import { useMarketStore } from '@/stores/marketStore'

const REFRESH_MS = 60_000

function fmtPct(n: number) {
  const s = n >= 0 ? '+' : ''
  return `${s}${n.toFixed(2)}%`
}

function fmtPx(n: number) {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1000) return n.toFixed(2)
  if (n >= 1) return n.toFixed(4)
  return n.toPrecision(4)
}

function ruleLabel(a: RankedAsset): string {
  if (a.isPick) return `PICK · ${a.side.toUpperCase()} #${a.rank}`
  switch (a.pickRule) {
    case 'NOT_PICKED_SECTOR_CAP':
      return 'NOT PICKED · sector cap'
    case 'NOT_PICKED_CHOPPY':
      return 'NOT PICKED · choppy'
    case 'NOT_PICKED_LOW_LIQ':
      return 'NOT PICKED · low liq'
    default:
      return `NOT PICKED · outside top 3`
  }
}

function BreadthCanvas({ assets }: { assets: RankedAsset[] }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c || !assets.length) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = c.clientWidth || 320
    const h = c.clientHeight || 88
    c.width = Math.floor(w * dpr)
    c.height = Math.floor(h * dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const maxAbs = Math.max(3, ...assets.map((a) => Math.abs(a.changePct)))
    const midY = h / 2
    ctx.strokeStyle = '#2b3139'
    ctx.beginPath()
    ctx.moveTo(8, midY)
    ctx.lineTo(w - 8, midY)
    ctx.stroke()

    const sorted = [...assets].sort((a, b) => a.changePct - b.changePct)
    sorted.forEach((a, i) => {
      const x = 12 + (i / Math.max(1, sorted.length - 1)) * (w - 24)
      const y = midY - (a.changePct / maxAbs) * (h * 0.42)
      ctx.beginPath()
      ctx.fillStyle = a.changePct >= 0 ? '#0ecb81' : '#f6465d'
      if (a.isPick) {
        ctx.arc(x, y, 4.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#F4D35E'
        ctx.lineWidth = 1.2
        ctx.stroke()
      } else {
        ctx.arc(x, y, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  }, [assets])

  return <canvas ref={ref} className="w-full h-[88px] rounded bg-[#0d1117]" />
}

function ZoneChart({ detail }: { detail: AssetDetail }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { candles, orderBlocks, zone, vwap, asset } = detail
  const bull = asset.side === 'bullish'

  useEffect(() => {
    const c = ref.current
    if (!c || candles.length < 2) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = c.clientWidth || 320
    const h = c.clientHeight || 160
    c.width = Math.floor(w * dpr)
    c.height = Math.floor(h * dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const prices = candles.flatMap((x) => [x.high, x.low])
    if (zone) prices.push(zone.s1, zone.r1, zone.r2, zone.z)
    if (vwap) prices.push(vwap)
    const hi = Math.max(...prices)
    const lo = Math.min(...prices)
    const span = hi - lo || 1
    const pad = 6
    const xAt = (i: number) => pad + (i / (candles.length - 1)) * (w - pad * 2)
    const yAt = (p: number) => h - pad - ((p - lo) / span) * (h - pad * 2)

    for (const ob of orderBlocks.slice(-6)) {
      const y1 = yAt(ob.top)
      const y2 = yAt(ob.bottom)
      ctx.fillStyle =
        ob.kind === 'bullish' ? 'rgba(14,203,129,0.12)' : 'rgba(246,70,93,0.12)'
      ctx.fillRect(pad, Math.min(y1, y2), w - pad * 2, Math.abs(y2 - y1) || 2)
    }

    if (zone) {
      const yTop = yAt(zone.obTop)
      const yBot = yAt(zone.obBottom)
      ctx.fillStyle = bull ? 'rgba(244,211,94,0.18)' : 'rgba(244,211,94,0.14)'
      ctx.fillRect(pad, Math.min(yTop, yBot), w - pad * 2, Math.abs(yBot - yTop) || 3)
      ctx.strokeStyle = '#F4D35E'
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(pad, yAt(zone.z))
      ctx.lineTo(w - pad, yAt(zone.z))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.strokeStyle = '#f6465d'
      ctx.beginPath()
      ctx.moveTo(pad, yAt(zone.s1))
      ctx.lineTo(w - pad, yAt(zone.s1))
      ctx.stroke()
      ctx.strokeStyle = '#0ecb81'
      ctx.setLineDash([2, 3])
      ;[zone.r1, zone.r2].forEach((lv) => {
        ctx.beginPath()
        ctx.moveTo(pad, yAt(lv))
        ctx.lineTo(w - pad, yAt(lv))
        ctx.stroke()
      })
      ctx.setLineDash([])
    }

    if (vwap != null) {
      ctx.strokeStyle = '#60a5fa'
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(pad, yAt(vwap))
      ctx.lineTo(w - pad, yAt(vwap))
      ctx.stroke()
      ctx.setLineDash([])
    }

    candles.forEach((bar, i) => {
      const x = xAt(i)
      const up = bar.close >= bar.open
      ctx.strokeStyle = up ? '#0ecb81' : '#f6465d'
      ctx.fillStyle = up ? 'rgba(14,203,129,0.4)' : 'rgba(246,70,93,0.4)'
      ctx.beginPath()
      ctx.moveTo(x, yAt(bar.high))
      ctx.lineTo(x, yAt(bar.low))
      ctx.stroke()
      const y0 = yAt(Math.max(bar.open, bar.close))
      const y1 = yAt(Math.min(bar.open, bar.close))
      ctx.fillRect(x - 1.6, y0, 3.2, Math.max(1, y1 - y0))
    })

    ctx.font = '9px ui-monospace, monospace'
    if (zone) {
      ctx.fillStyle = '#F4D35E'
      ctx.fillText('Z', w - 18, yAt(zone.z) - 2)
      ctx.fillStyle = '#f6465d'
      ctx.fillText('S1', w - 22, yAt(zone.s1) - 2)
      ctx.fillStyle = '#0ecb81'
      ctx.fillText('R1', w - 22, yAt(zone.r1) - 2)
    }
  }, [candles, orderBlocks, zone, vwap, bull])

  return <canvas ref={ref} className="w-full h-[160px] rounded bg-[#0b0e11]" />
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
      className="text-left rounded-lg border px-2 py-1.5 transition-colors hover:border-[#F4D35E]/50"
      style={{
        background: a.isPick ? 'rgba(244,211,94,0.06)' : '#12161c',
        borderColor: a.isPick ? 'rgba(244,211,94,0.35)' : '#2b3139',
      }}
    >
      <div className="flex items-center gap-1">
        <span className="text-[12px] font-bold text-[#eaecef]">{a.base}</span>
        {a.isPick && (
          <span className="text-[8px] font-bold px-1 rounded bg-[#F4D35E] text-[#1a1a1a]">
            PICK
          </span>
        )}
        <span className="ml-auto text-[9px] text-[#5e6673]">#{a.rank}</span>
      </div>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span
          className={`text-[12px] font-mono font-semibold ${
            bull ? 'text-[#0ecb81]' : 'text-[#f6465d]'
          }`}
        >
          {fmtPct(a.changePct)}
        </span>
        <span className="text-[10px] text-[#848e9c] font-mono">{fmtPx(a.lastPrice)}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-1 text-[9px] text-[#5e6673]">
        <span>{a.sector}</span>
        <span className="text-[#848e9c]">Liq {a.liquidityScore}</span>
        {!a.clean && <span className="text-[#f0b90b]">choppy</span>}
      </div>
    </button>
  )
}

function DetailCard({
  detail,
  onClose,
  onTrade,
}: {
  detail: AssetDetail
  onClose: () => void
  onTrade: () => void
}) {
  const a = detail.asset
  const bull = a.side === 'bullish'
  return (
    <div className="absolute inset-1.5 z-30 flex flex-col rounded-lg border border-[#2b3139] bg-[#0d1117] shadow-2xl overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-[#2b3139]"
        style={{ background: 'linear-gradient(90deg,#1a1208 0%,#12161c 55%)' }}
      >
        <span className="text-[14px] font-bold text-[#eaecef]">{a.base}</span>
        <span className="text-[10px] text-[#5e6673]">{a.symbol}</span>
        <span
          className={`text-[12px] font-mono font-bold ${
            bull ? 'text-[#0ecb81]' : 'text-[#f6465d]'
          }`}
        >
          {fmtPct(a.changePct)}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e2329] text-[#848e9c]">
          {a.sector}
        </span>
        {a.isPick && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F4D35E] text-[#1a1a1a]">
            PICK
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-[12px] text-[#848e9c] hover:text-[#eaecef] w-7 h-7"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 py-2 border-b border-[#1e2329] text-[10px] font-mono">
        <div>
          <div className="text-[#5e6673] tracking-wide">RANK</div>
          <div className="text-[#eaecef]">
            p{a.percentile.toFixed(1)} · #{a.rank}
          </div>
        </div>
        <div>
          <div className="text-[#5e6673] tracking-wide">RULE</div>
          <div className={a.isPick ? 'text-[#F4D35E]' : 'text-[#848e9c]'}>
            {ruleLabel(a)}
          </div>
        </div>
      </div>

      <div className="px-3 pt-2">
        <ZoneChart detail={detail} />
      </div>

      {detail.zone && (
        <div className="grid grid-cols-4 gap-1.5 px-3 py-2 text-[10px] font-mono">
          {[
            { k: 'Z', v: detail.zone.z, c: '#F4D35E' },
            { k: 'S1', v: detail.zone.s1, c: '#f6465d' },
            { k: 'R1', v: detail.zone.r1, c: '#0ecb81' },
            { k: 'R2', v: detail.zone.r2, c: '#0ecb81' },
          ].map((x) => (
            <div
              key={x.k}
              className="rounded border border-[#1e2329] bg-[#12161c] px-1.5 py-1"
            >
              <div className="text-[#5e6673]">{x.k}</div>
              <div style={{ color: x.c }}>{fmtPx(x.v)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5 px-3 pb-2 text-[10px] font-mono">
        <div className="rounded border border-[#1e2329] bg-[#12161c] px-1.5 py-1">
          <div className="text-[#5e6673]">LIQ</div>
          <div className="text-[#eaecef]">{a.liquidityScore}</div>
        </div>
        <div className="rounded border border-[#1e2329] bg-[#12161c] px-1.5 py-1">
          <div className="text-[#5e6673]">R:R</div>
          <div className="text-[#F4D35E]">
            {detail.rr != null ? `${detail.rr.toFixed(1)}:1` : '—'}
          </div>
        </div>
        <div className="rounded border border-[#1e2329] bg-[#12161c] px-1.5 py-1">
          <div className="text-[#5e6673]">VWAP</div>
          <div className="text-[#60a5fa]">
            {detail.vwap != null ? fmtPx(detail.vwap) : '—'}
          </div>
        </div>
        <div className="rounded border border-[#1e2329] bg-[#12161c] px-1.5 py-1">
          <div className="text-[#5e6673]">TF</div>
          <div className="text-[#eaecef]">{detail.interval}</div>
        </div>
      </div>

      <div className="mt-auto px-3 py-2 border-t border-[#1e2329] flex gap-2">
        <button
          type="button"
          onClick={onTrade}
          className="flex-1 text-[11px] font-bold py-2 rounded"
          style={{ background: '#F4D35E', color: '#1a1a1a' }}
        >
          Apri sul chart
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] px-3 py-2 rounded border border-[#2b3139] text-[#848e9c]"
        >
          Chiudi
        </button>
      </div>
    </div>
  )
}

export function OrderBlockPanel() {
  const [tab, setTab] = useState<ObBoardTab>('picks')
  const [data, setData] = useState<MarketBreadth | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [detail, setDetail] = useState<AssetDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const updatePanel = useLayoutStore((s) => s.updatePanel)
  const setSymbol = useMarketStore((s) => s.setSymbol)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const m = await fetchMarketBreadth()
      setData(m)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = window.setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  const board = useMemo(() => {
    if (!data) return []
    if (tab === 'bullish') return data.bullBoard
    if (tab === 'bearish') return data.bearBoard
    if (tab === 'picks') return [...data.picksBull, ...data.picksBear]
    return []
  }, [data, tab])

  const openDetail = async (a: RankedAsset) => {
    setDetailLoading(true)
    try {
      const d = await fetchAssetDetail(a, '5m')
      setDetail(d)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Detail failed')
    } finally {
      setDetailLoading(false)
    }
  }

  const openOnChart = () => {
    if (!detail) return
    const sym = detail.asset.symbol
    setSymbol(sym)
    if (primaryPanelId) {
      updatePanel(primaryPanelId, {
        symbol: sym,
        interval: '5m',
        exchange: 'binance',
      })
    }
  }

  const tabs: { id: ObBoardTab; label: string }[] = [
    { id: 'picks', label: 'PICKS' },
    { id: 'bullish', label: 'BULLISH' },
    { id: 'bearish', label: 'BEARISH' },
    { id: 'breadth', label: 'X-RAY' },
  ]

  return (
    <div className="h-full min-h-0 flex flex-col relative bg-[#0b0e11] text-[#eaecef]">
      <div
        className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-[#2b3139]"
        style={{ background: 'linear-gradient(90deg,#1a1208 0%,#12161c 60%)' }}
      >
        <div>
          <div className="text-[12px] font-extrabold tracking-widest text-[#F4D35E]">
            ORDER BLOCK
          </div>
          <div className="text-[10px] text-[#848e9c]">
            Market X-Ray · {data ? `${data.assets.length} assets` : '…'} · 5m OB
            {data ? ` · ${new Date(data.updatedAt).toLocaleTimeString()}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-[10px] font-bold px-2.5 py-1 rounded"
          style={{
            background: '#F4D35E',
            color: '#1a1a1a',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'SCAN…' : 'REFRESH'}
        </button>
      </div>

      {data && (
        <div className="shrink-0 grid grid-cols-4 gap-1.5 px-2 py-2 border-b border-[#1e2329] bg-[#0d1117]">
          {[
            { l: 'BULL', v: data.bullish, c: '#0ecb81' },
            { l: 'BEAR', v: data.bearish, c: '#f6465d' },
            { l: 'AVG', v: fmtPct(data.avgChangePct), c: '#eaecef' },
            {
              l: 'LEAD',
              v: data.leadingSector?.sector ?? '—',
              c: '#F4D35E',
            },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded border border-[#1e2329] bg-[#12161c] px-1.5 py-1"
            >
              <div className="text-[8px] text-[#5e6673] tracking-wide">{s.l}</div>
              <div className="text-[12px] font-bold font-mono" style={{ color: s.c }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="shrink-0 flex gap-1 px-2 py-1.5 border-b border-[#1e2329]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="text-[10px] font-bold px-2.5 py-1 rounded"
            style={{
              background: tab === t.id ? '#F4D35E' : '#1e2329',
              color: tab === t.id ? '#1a1a1a' : '#848e9c',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && (
        <div className="shrink-0 px-3 py-1.5 text-[11px] text-[#f6465d] bg-[#2e0a12]">
          {err}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {loading && !data && (
          <div className="p-4 text-[12px] text-[#848e9c]">Scansione universo Binance…</div>
        )}

        {data && tab === 'breadth' && (
          <>
            <div className="text-[9px] text-[#5e6673] px-0.5">
              Ogni punto = asset · oro = PICK · sopra = bullish · sotto = bearish
            </div>
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
                Leading:{' '}
                <span className="text-[#0ecb81]">{data.leadingSector.sector}</span>
                {' · '}
                Lagging:{' '}
                <span className="text-[#f6465d]">{data.laggingSector?.sector}</span>
              </div>
            )}
          </>
        )}

        {data && tab !== 'breadth' && (
          <>
            {tab === 'picks' && board.length === 0 && (
              <div className="text-[11px] text-[#848e9c] p-3 text-center">
                Nessun PICK pulito in questo momento — apri BULLISH/BEARISH o attendi il
                prossimo refresh.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {board.map((a) => (
                <AssetTile key={a.symbol} a={a} onPick={openDetail} />
              ))}
            </div>
          </>
        )}

        {detailLoading && (
          <div className="text-[11px] text-[#848e9c] px-1">Carico chart + order blocks…</div>
        )}
      </div>

      {detail && (
        <DetailCard
          detail={detail}
          onClose={() => setDetail(null)}
          onTrade={openOnChart}
        />
      )}

      <div className="shrink-0 px-2 py-1 border-t border-[#2b3139] text-[9px] text-[#5e6673] font-mono">
        Playbook: X-Ray → lato → shortlist → zona (first retest) · refresh 60s · Binance public
      </div>
    </div>
  )
}

export default OrderBlockPanel
