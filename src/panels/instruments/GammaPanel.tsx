/**
 * Gamma Classic panel — GEX profile, walls, MAX CHANGE multi-window.
 * Public Deribit OI proxy (BTC/ETH).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import {
  buildGammaModel,
  fetchDeribitOptionBook,
  symbolToDeribitCurrency,
  DEFAULT_GAMMA_CONFIG,
  type GammaModel,
  type GammaLevel,
} from '@/analysis/gamma'

const KIND_COLOR: Record<GammaLevel['kind'], string> = {
  call_wall: '#00e5a0',
  put_wall: '#c084fc',
  flip: '#f0b90b',
  max_pain: '#60a5fa',
  hvl: '#f59e0b',
  dominant_pos: '#2dd4bf',
  dominant_neg: '#f472b6',
}

type Snap = { t: number; netGex: number }

const WINDOWS = [
  { id: '1m', ms: 60_000 },
  { id: '5m', ms: 5 * 60_000 },
  { id: '10m', ms: 10 * 60_000 },
  { id: '15m', ms: 15 * 60_000 },
  { id: '30m', ms: 30 * 60_000 },
] as const

function fmt(p: number) {
  if (!Number.isFinite(p)) return '—'
  if (p >= 1000) return p.toFixed(0)
  if (p >= 1) return p.toFixed(2)
  return p.toFixed(4)
}

function fmtGex(n: number) {
  const abs = Math.abs(n)
  const sign = n >= 0 ? '+' : '−'
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}k`
  return `${sign}${abs.toFixed(0)}`
}

export function GammaPanel() {
  const link = useResolvedChartLink('follow')
  const { symbol } = link
  const currency = symbolToDeribitCurrency(symbol)
  const [model, setModel] = useState<GammaModel | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const snapsRef = useRef<Snap[]>([])
  const [snapN, setSnapN] = useState(0)
  const profileRef = useRef<HTMLCanvasElement>(null)
  const cfg = DEFAULT_GAMMA_CONFIG

  useEffect(() => {
    if (!currency) {
      setModel(null)
      setErr('Gamma Classic: solo BTC / ETH (Deribit public options)')
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const rows = await fetchDeribitOptionBook(currency)
        if (cancelled) return
        const m = buildGammaModel(currency, rows, cfg)
        setModel(m)
        setErr(m ? null : 'Nessun livello OI disponibile')
        if (m) {
          const now = Date.now()
          snapsRef.current.push({ t: now, netGex: m.netGex })
          snapsRef.current = snapsRef.current.filter((s) => now - s.t < 2 * 3600_000)
          setSnapN(snapsRef.current.length)
        }
      } catch (e: unknown) {
        if (cancelled) return
        setErr(e instanceof Error ? e.message : 'Deribit fetch failed')
        setModel(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const id = window.setInterval(load, Math.max(15, cfg.pollSec) * 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [currency, cfg.pollSec])

  const maxChange = useMemo(() => {
    const snaps = snapsRef.current
    if (!snaps.length || !model) return []
    const now = Date.now()
    const cur = model.netGex
    return WINDOWS.map((w) => {
      const target = now - w.ms
      let best = snaps[0]!
      for (const s of snaps) {
        if (Math.abs(s.t - target) < Math.abs(best.t - target)) best = s
      }
      const ready = now - best.t >= w.ms * 0.5
      return { id: w.id, delta: ready ? cur - best.netGex : null }
    })
  }, [model, snapN])

  useEffect(() => {
    const canvas = profileRef.current
    const m = model
    if (!canvas || !m?.profile?.length) return
    const w = canvas.clientWidth || 120
    const h = canvas.clientHeight || 280
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const rows = m.profile
    const minP = Math.min(...rows.map((r) => r.strike))
    const maxP = Math.max(...rows.map((r) => r.strike))
    const span = Math.max(1, maxP - minP)
    const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.gex)))

    const sy = h - ((m.spot - minP) / span) * h
    ctx.strokeStyle = '#eaecef55'
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(0, sy)
    ctx.lineTo(w, sy)
    ctx.stroke()
    ctx.setLineDash([])

    for (const r of rows) {
      const y = h - ((r.strike - minP) / span) * h
      const mag = Math.abs(r.gex) / maxAbs
      const bw = Math.max(1, mag * (w * 0.85))
      ctx.globalAlpha = 0.45 + mag * 0.5
      ctx.fillStyle = r.gex >= 0 ? '#14b8a6' : '#e11d48'
      if (r.gex >= 0) ctx.fillRect(0, y - 2, bw, 4)
      else ctx.fillRect(w - bw, y - 2, bw, 4)
    }
    ctx.globalAlpha = 1

    for (const lv of m.levels) {
      if (lv.kind !== 'call_wall' && lv.kind !== 'put_wall' && lv.kind !== 'flip') continue
      const y = h - ((lv.price - minP) / span) * h
      ctx.fillStyle = KIND_COLOR[lv.kind]
      ctx.fillRect(0, y - 1, w, 2)
    }
  }, [model])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] text-[11px] font-mono">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex flex-wrap gap-2 items-center">
        <span className="text-[#f0b90b] font-semibold tracking-wide">GAMMA Classic</span>
        <span className="text-[#848e9c]">
          {symbol}
          {currency ? ` · Deribit ${currency}` : ''}
        </span>
        {model && (
          <span className="ml-auto text-[#848e9c]">
            spot {fmt(model.spot)}
            {loading ? ' · …' : ''}
          </span>
        )}
      </div>

      {err && (
        <div className="px-2 py-2 text-[#f6465d] text-[10px] border-b border-[#1e2329]">{err}</div>
      )}

      {model && (
        <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329]">
          <div className="text-[9px] uppercase tracking-wider text-[#5e6673] mb-1">
            Max change GEX
          </div>
          <div className="grid grid-cols-5 gap-1">
            {maxChange.map((c) => (
              <div
                key={c.id}
                className="rounded border border-[#1e2329] bg-[#12161c] px-1 py-1 text-center"
              >
                <div className="text-[9px] text-[#5e6673]">{c.id}</div>
                <div
                  className={`text-[10px] font-semibold ${
                    c.delta == null
                      ? 'text-[#5e6673]'
                      : c.delta >= 0
                        ? 'text-[#0ecb81]'
                        : 'text-[#f6465d]'
                  }`}
                >
                  {c.delta == null ? '…' : fmtGex(c.delta)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 text-[9px] text-[#5e6673]">
            Net GEX{' '}
            <span className={model.netGex >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
              {fmtGex(model.netGex)}
            </span>
            {model.callWall != null && <> · Call {fmt(model.callWall)}</>}
            {model.putWall != null && <> · Put {fmt(model.putWall)}</>}
            {model.flip != null && <> · Flip {fmt(model.flip)}</>}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        <div className="w-[7rem] shrink-0 border-r border-[#1e2329] relative">
          <canvas ref={profileRef} className="absolute inset-0 w-full h-full" />
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {!model && !err && (
            <div className="flex items-center justify-center h-full text-[#5e6673]">
              {loading ? 'Caricamento Deribit…' : 'Nessun dato'}
            </div>
          )}
          {model && (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-[#0b0e11] text-[10px] text-[#5e6673] z-10">
                <tr>
                  <th className="text-left px-2 py-1">Level</th>
                  <th className="text-right px-2 py-1">Price</th>
                  <th className="text-right px-2 py-1">Value</th>
                </tr>
              </thead>
              <tbody>
                {model.levels.map((lv, i) => (
                  <tr
                    key={`${lv.kind}-${lv.price}-${i}`}
                    className="border-b border-[#1e2329]/50"
                  >
                    <td className="px-2 py-1">
                      <span style={{ color: KIND_COLOR[lv.kind] ?? '#848e9c' }}>
                        {lv.kind.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right text-[#eaecef]">{fmt(lv.price)}</td>
                    <td className="px-2 py-1 text-right text-[#848e9c]">{fmtGex(lv.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {model?.note && (
            <div className="px-2 py-2 text-[9px] text-[#3d4450]">{model.note}</div>
          )}
        </div>
      </div>
    </div>
  )
}
