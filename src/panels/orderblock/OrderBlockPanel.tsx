/**
 * Order Block terminal — professional graphics + precise zones.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAssetDetail, fetchMarketBreadth } from './engine'
import type { AssetDetail, MarketBreadth, ObBoardTab, RankedAsset } from './types'
import { useLayoutStore } from '@/stores/layoutStore'
import { useMarketStore } from '@/stores/marketStore'
import { SectorStrip, SectorRankList, SectorFlowChart } from './BreadthGraphics'

const REFRESH_MS = 60_000

function fmtPct(n: number) {
  const s = n >= 0 ? '+' : ''
  return `${s}${n.toFixed(2)}%`
}

function fmtPx(n: number) {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1000) return n.toFixed(2)
  if (n >= 10) return n.toFixed(3)
  if (n >= 1) return n.toFixed(4)
  return n.toPrecision(5)
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
      return 'NOT PICKED · outside top 3'
  }
}

function mitColor(m: string) {
  if (m === 'fresh') return '#0ecb81'
  if (m === 'tested') return '#F4D35E'
  if (m === 'mitigated') return '#f0b90b'
  return '#f6465d'
}

function ZoneChart({ detail }: { detail: AssetDetail }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { candles, orderBlocks, zone, vwap, asset } = detail
  const bull = asset.side === 'bullish'

  useEffect(() => {
    const c = ref.current
    if (!c || candles.length < 2) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = c.clientWidth || 340
    const h = c.clientHeight || 200
    c.width = Math.floor(w * dpr)
    c.height = Math.floor(h * dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#080b0f'
    ctx.fillRect(0, 0, w, h)

    const volH = 28
    const chartH = h - volH - 4
    const padL = 2
    const padR = 52
    const padT = 10
    const padB = 4
    const plotW = w - padL - padR

    const prices = candles.flatMap((x) => [x.high, x.low])
    if (zone) prices.push(zone.s1, zone.r1, zone.r2, zone.z, zone.bodyTop, zone.bodyBottom)
    if (vwap) prices.push(vwap)
    prices.push(asset.lastPrice)
    let hi = Math.max(...prices)
    let lo = Math.min(...prices)
    const pad = (hi - lo) * 0.04 || asset.lastPrice * 0.001
    hi += pad
    lo -= pad
    const span = hi - lo || 1

    const xAt = (i: number) => padL + (i / (candles.length - 1)) * plotW
    const yAt = (p: number) => padT + ((hi - p) / span) * (chartH - padT - padB)

    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace'
    for (let g = 0; g <= 4; g++) {
      const p = hi - (span * g) / 4
      const y = yAt(p)
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(padL + plotW, y)
      ctx.stroke()
      ctx.fillStyle = '#5e6673'
      ctx.fillText(fmtPx(p), padL + plotW + 4, y + 3)
    }

    for (const ob of orderBlocks.slice(-8)) {
      const y1 = yAt(ob.bodyTop)
      const y2 = yAt(ob.bodyBottom)
      const grad = ctx.createLinearGradient(0, Math.min(y1, y2), 0, Math.max(y1, y2))
      if (ob.kind === 'bullish') {
        grad.addColorStop(0, 'rgba(14,203,129,0.06)')
        grad.addColorStop(1, 'rgba(14,203,129,0.18)')
      } else {
        grad.addColorStop(0, 'rgba(246,70,93,0.18)')
        grad.addColorStop(1, 'rgba(246,70,93,0.06)')
      }
      ctx.fillStyle = grad
      ctx.fillRect(padL, Math.min(y1, y2), plotW, Math.max(2, Math.abs(y2 - y1)))
    }

    if (zone) {
      const y1 = yAt(zone.bodyTop)
      const y2 = yAt(zone.bodyBottom)
      const top = Math.min(y1, y2)
      const bot = Math.max(y1, y2)
      const gg = ctx.createLinearGradient(0, top, 0, bot)
      gg.addColorStop(0, 'rgba(244,211,94,0.08)')
      gg.addColorStop(0.5, 'rgba(244,211,94,0.28)')
      gg.addColorStop(1, 'rgba(244,211,94,0.08)')
      ctx.fillStyle = gg
      ctx.fillRect(padL, top, plotW, Math.max(3, bot - top))
      ctx.strokeStyle = 'rgba(244,211,94,0.7)'
      ctx.lineWidth = 1
      ctx.strokeRect(padL + 0.5, top, plotW - 1, Math.max(3, bot - top))

      const drawLevel = (price: number, color: string, dash: number[], label: string) => {
        const y = yAt(price)
        ctx.strokeStyle = color
        ctx.setLineDash(dash)
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(padL + plotW, y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = color
        ctx.font = 'bold 9px ui-monospace,monospace'
        ctx.fillText(label, padL + plotW + 4, y + 3)
      }
      drawLevel(zone.z, '#F4D35E', [5, 3], 'Z')
      drawLevel(zone.s1, '#f6465d', [], 'S1')
      drawLevel(zone.r1, '#0ecb81', [3, 3], 'R1')
      drawLevel(zone.r2, 'rgba(14,203,129,0.55)', [2, 4], 'R2')
    }

    if (vwap != null) {
      const y = yAt(vwap)
      ctx.strokeStyle = 'rgba(96,165,250,0.85)'
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(padL + plotW, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#60a5fa'
      ctx.font = '9px ui-monospace,monospace'
      ctx.fillText('VWAP', padL + plotW + 4, y + 3)
    }

    const barW = Math.max(1.5, (plotW / candles.length) * 0.65)
    candles.forEach((bar, i) => {
      const x = xAt(i)
      const up = bar.close >= bar.open
      ctx.strokeStyle = up ? '#0ecb81' : '#f6465d'
      ctx.fillStyle = up ? '#0ecb81' : '#f6465d'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, yAt(bar.high))
      ctx.lineTo(x, yAt(bar.low))
      ctx.stroke()
      const y0 = yAt(Math.max(bar.open, bar.close))
      const y1 = yAt(Math.min(bar.open, bar.close))
      const bh = Math.max(1, y1 - y0)
      ctx.fillRect(x - barW / 2, y0, barW, bh)
    })

    const ly = yAt(asset.lastPrice)
    ctx.strokeStyle = bull ? 'rgba(14,203,129,0.9)' : 'rgba(246,70,93,0.9)'
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.moveTo(padL, ly)
    ctx.lineTo(padL + plotW, ly)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = bull ? '#0ecb81' : '#f6465d'
    ctx.fillRect(padL + plotW + 2, ly - 7, 48, 14)
    ctx.fillStyle = '#0b0e11'
    ctx.font = 'bold 9px ui-monospace,monospace'
    ctx.fillText(fmtPx(asset.lastPrice), padL + plotW + 4, ly + 3)

    const maxVol = Math.max(...candles.map((x) => x.volume), 1)
    candles.forEach((bar, i) => {
      const x = xAt(i)
      const vh = (bar.volume / maxVol) * (volH - 4)
      const up = bar.close >= bar.open
      ctx.fillStyle = up ? 'rgba(14,203,129,0.35)' : 'rgba(246,70,93,0.35)'
      ctx.fillRect(x - barW / 2, h - 2 - vh, barW, vh)
    })
  }, [candles, orderBlocks, zone, vwap, asset, bull])

  return (
    <canvas
      ref={ref}
      className="w-full h-[200px] rounded-lg border border-[#1e2329]"
      style={{ background: '#080b0f' }}
    />
  )
}

function AssetTile({ a, onPick }: { a: RankedAsset; onPick: (a: RankedAsset) => void }) {
  const bull = a.side === 'bullish'
  return (
    <button
      type="button"
      onClick={() => onPick(a)}
      className="text-left rounded-xl border px-2.5 py-2 transition-all hover:scale-[1.02]"
      style={{
        background: a.isPick
          ? 'linear-gradient(145deg,rgba(244,211,94,0.12),#12161c 60%)'
          : 'linear-gradient(145deg,#141a22,#0d1117)',
        borderColor: a.isPick ? 'rgba(244,211,94,0.45)' : '#1e2329',
        boxShadow: a.isPick ? '0 0 12px rgba(244,211,94,0.12)' : 'none',
      }}
    >
      <div className="flex items-center gap-1">
        <span className="text-[12px] font-bold tracking-wide text-[#eaecef]">{a.base}</span>
        {a.isPick && (
          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded" style={{ background: '#F4D35E', color: '#1a1a1a' }}>
            PICK
          </span>
        )}
        <span className="ml-auto text-[9px] text-[#5e6673] font-mono">#{a.rank}</span>
      </div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="text-[13px] font-mono font-bold" style={{ color: bull ? '#0ecb81' : '#f6465d' }}>
          {fmtPct(a.changePct)}
        </span>
        <span className="text-[10px] text-[#848e9c] font-mono">{fmtPx(a.lastPrice)}</span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-[#1e2329] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, a.absStrength * 100)}%`,
            background: bull ? 'linear-gradient(90deg,#0a5c40,#0ecb81)' : 'linear-gradient(90deg,#7a1a28,#f6465d)',
          }}
        />
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
    <div
      className="absolute inset-1 z-30 flex flex-col rounded-xl overflow-hidden"
      style={{ background: '#0b0e11', border: '1px solid #2a3140', boxShadow: '0 20px 50px rgba(0,0,0,0.65)' }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5 shrink-0"
        style={{ background: 'linear-gradient(90deg,#1a1408 0%,#0f1319 55%)', borderBottom: '1px solid #2a3140' }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-extrabold text-[#eaecef]">{a.base}</span>
            <span className="text-[10px] text-[#5e6673]">{a.symbol}</span>
            {a.isPick && (
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded" style={{ background: '#F4D35E', color: '#1a1a1a' }}>
                PICK
              </span>
            )}
          </div>
          <div className="text-[10px] text-[#848e9c]">
            {a.sector} · p{a.percentile.toFixed(0)} · #{a.rank} · {detail.interval}
          </div>
        </div>
        <span className="ml-auto text-[14px] font-mono font-bold" style={{ color: bull ? '#0ecb81' : '#f6465d' }}>
          {fmtPct(a.changePct)}
        </span>
        <button type="button" onClick={onClose} className="text-[#848e9c] hover:text-white w-8 h-8 rounded-lg border border-white/10">
          ×
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 py-2 border-b border-[#1e2329] text-[10px] font-mono shrink-0">
        <div>
          <div className="text-[#5e6673]">RULE</div>
          <div className={a.isPick ? 'text-[#F4D35E]' : 'text-[#848e9c]'}>{ruleLabel(a)}</div>
        </div>
        <div>
          <div className="text-[#5e6673]">ZONE STATE</div>
          <div style={{ color: detail.zone ? mitColor(detail.zone.mitigation) : '#848e9c' }}>
            {detail.zone ? `${detail.zone.mitigation.toUpperCase()} · Q${(detail.zone.quality * 100).toFixed(0)}` : '—'}
          </div>
        </div>
      </div>

      <div className="px-3 pt-2 shrink-0">
        <ZoneChart detail={detail} />
      </div>

      {detail.zone && (
        <div className="grid grid-cols-4 gap-1.5 px-3 py-2 text-[10px] font-mono shrink-0">
          {[
            { k: 'Z', v: detail.zone.z, c: '#F4D35E' },
            { k: 'S1', v: detail.zone.s1, c: '#f6465d' },
            { k: 'R1', v: detail.zone.r1, c: '#0ecb81' },
            { k: 'R2', v: detail.zone.r2, c: '#0ecb81' },
          ].map((x) => (
            <div key={x.k} className="rounded-lg border border-[#1e2329] px-1.5 py-1.5" style={{ background: '#12161c' }}>
              <div className="text-[#5e6673] text-[8px] tracking-wider">{x.k}</div>
              <div style={{ color: x.c, fontWeight: 700 }}>{fmtPx(x.v)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5 px-3 pb-2 text-[10px] font-mono shrink-0">
        {[
          { k: 'LIQ', v: String(a.liquidityScore), c: '#eaecef' },
          { k: 'R:R', v: detail.rr != null ? `${detail.rr.toFixed(2)}:1` : '—', c: '#F4D35E' },
          { k: 'VWAP', v: detail.vwap != null ? fmtPx(detail.vwap) : '—', c: '#60a5fa' },
          { k: 'ATR', v: detail.atr != null ? fmtPx(detail.atr) : '—', c: '#848e9c' },
        ].map((x) => (
          <div key={x.k} className="rounded-lg border border-[#1e2329] px-1.5 py-1.5" style={{ background: '#12161c' }}>
            <div className="text-[#5e6673] text-[8px]">{x.k}</div>
            <div style={{ color: x.c, fontWeight: 600 }}>{x.v}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2">
        <div className="text-[9px] text-[#5e6673] mb-1 tracking-wide">
          ORDER BLOCKS ({detail.orderBlocks.length}) · body zone · BOS confirmed
        </div>
        <div className="space-y-1">
          {detail.orderBlocks
            .slice()
            .reverse()
            .slice(0, 5)
            .map((ob, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-[10px] font-mono px-2 py-1.5 rounded-lg border border-[#1e2329]"
                style={{ background: '#0d1117' }}
              >
                <span style={{ color: ob.kind === 'bullish' ? '#0ecb81' : '#f6465d', fontWeight: 700 }}>
                  {ob.kind === 'bullish' ? 'OB▲' : 'OB▼'}
                </span>
                <span className="text-[#c8d0dc]">
                  {fmtPx(ob.bodyBottom)}–{fmtPx(ob.bodyTop)}
                </span>
                <span style={{ color: mitColor(ob.mitigation) }} className="ml-auto text-[9px]">
                  {ob.mitigation}
                </span>
                <span className="text-[#5e6673]">Q{(ob.quality * 100).toFixed(0)}</span>
              </div>
            ))}
        </div>
      </div>

      <div className="shrink-0 px-3 py-2.5 flex gap-2 border-t border-[#1e2329]">
        <button
          type="button"
          onClick={onTrade}
          className="flex-1 text-[12px] font-extrabold py-2.5 rounded-lg"
          style={{ background: 'linear-gradient(90deg,#F4D35E,#e0a800)', color: '#1a1a1a' }}
        >
          Apri sul chart · 5m
        </button>
        <button type="button" onClick={onClose} className="text-[11px] px-4 py-2.5 rounded-lg border border-[#2b3139] text-[#848e9c]">
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
      setData(await fetchMarketBreadth())
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
      setDetail(await fetchAssetDetail(a, '5m'))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Detail failed')
    } finally {
      setDetailLoading(false)
    }
  }

  const openOnChart = () => {
    if (!detail) return
    setSymbol(detail.asset.symbol)
    if (primaryPanelId) {
      updatePanel(primaryPanelId, { symbol: detail.asset.symbol, interval: '5m', exchange: 'binance' })
    }
  }

  const tabs: { id: ObBoardTab; label: string }[] = [
    { id: 'picks', label: 'PICKS' },
    { id: 'bullish', label: 'BULLISH' },
    { id: 'bearish', label: 'BEARISH' },
    { id: 'breadth', label: 'X-RAY' },
  ]

  return (
    <div className="h-full min-h-0 flex flex-col relative text-[#eaecef]" style={{ background: '#080b0f' }}>
      <div
        className="shrink-0 flex items-center justify-between gap-2 px-3 py-2.5"
        style={{ background: 'linear-gradient(90deg,#1a1408 0%,#0f1319 55%)', borderBottom: '1px solid #2a3140' }}
      >
        <div>
          <div className="text-[12px] font-extrabold tracking-[0.12em] text-[#F4D35E]">ORDER BLOCK</div>
          <div className="text-[10px] text-[#848e9c]">
            Precise OB · body zone · BOS · {data ? `${data.assets.length} assets` : '…'}
            {data ? ` · ${new Date(data.updatedAt).toLocaleTimeString()}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-[10px] font-extrabold px-3 py-1.5 rounded-lg"
          style={{ background: 'linear-gradient(90deg,#F4D35E,#e0a800)', color: '#1a1a1a', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'SCAN…' : 'REFRESH'}
        </button>
      </div>

      {data && (
        <div className="shrink-0 grid grid-cols-4 gap-1.5 px-2 py-2 border-b border-[#1e2329]">
          {[
            { l: 'BULL', v: data.bullish, c: '#0ecb81' },
            { l: 'BEAR', v: data.bearish, c: '#f6465d' },
            { l: 'AVG', v: fmtPct(data.avgChangePct), c: '#eaecef' },
            { l: 'LEAD', v: data.leadingSector?.sector ?? '—', c: '#F4D35E' },
          ].map((s) => (
            <div key={s.l} className="rounded-lg px-1.5 py-1.5 border border-[#1e2329]" style={{ background: '#12161c' }}>
              <div className="text-[8px] text-[#5e6673] tracking-wider">{s.l}</div>
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
            className="text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg"
            style={{
              background: tab === t.id ? '#F4D35E' : '#1a1f27',
              color: tab === t.id ? '#1a1a1a' : '#848e9c',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <div className="shrink-0 px-3 py-1.5 text-[11px] text-[#f6465d] bg-[#2e0a12]">{err}</div>}

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {loading && !data && (
          <div className="p-4 text-[12px] text-[#848e9c]">Scansione universo Binance…</div>
        )}

        {data && tab === 'breadth' && (
          <div className="space-y-2">
            <SectorStrip
              assets={data.assets}
              leading={data.leadingSector?.sector ?? null}
              lagging={data.laggingSector?.sector ?? null}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" style={{ minHeight: 200 }}>
              <SectorRankList sectors={data.sectors} />
              <SectorFlowChart sectors={data.sectors} />
            </div>
          </div>
        )}

        {data && tab !== 'breadth' && (
          <>
            {tab === 'picks' && board.length === 0 && (
              <div className="text-[11px] text-[#848e9c] p-4 text-center">
                Nessun PICK pulito — apri BULLISH/BEARISH o attendi refresh.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {board.map((a) => (
                <AssetTile key={a.symbol} a={a} onPick={openDetail} />
              ))}
            </div>
          </>
        )}

        {detailLoading && (
          <div className="text-[11px] text-[#848e9c]">Calcolo OB precisi (BOS + body)…</div>
        )}
      </div>

      {detail && (
        <DetailCard detail={detail} onClose={() => setDetail(null)} onTrade={openOnChart} />
      )}

      <div className="shrink-0 px-2 py-1.5 border-t border-[#1e2329] text-[9px] text-[#5e6673] font-mono">
        Body zone · break of structure · mitigation fresh/tested · ATR R:R · refresh 60s
      </div>
    </div>
  )
}

export default OrderBlockPanel
