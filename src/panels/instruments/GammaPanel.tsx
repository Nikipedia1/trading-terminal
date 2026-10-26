/**
 * Standalone Gamma panel — Deribit OI walls / flip / max pain (public data).
 */
import { useEffect, useState } from 'react'
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
  call_wall: '#f6465d',
  put_wall: '#0ecb81',
  flip: '#f0b90b',
  max_pain: '#a855f7',
  hvl: '#848e9c',
}

function fmt(p: number) {
  if (!Number.isFinite(p)) return '—'
  if (p >= 1000) return p.toFixed(0)
  if (p >= 1) return p.toFixed(2)
  return p.toFixed(4)
}

export function GammaPanel() {
  const link = useResolvedChartLink('follow')
  const { symbol } = link
  const currency = symbolToDeribitCurrency(symbol)
  const [model, setModel] = useState<GammaModel | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const cfg = DEFAULT_GAMMA_CONFIG

  useEffect(() => {
    if (!currency) {
      setModel(null)
      setErr('Gamma disponibile solo per simboli BTC / ETH')
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
  }, [currency, cfg.pollSec, cfg.walls, cfg.flip, cfg.maxPain])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] text-[11px] font-mono">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex flex-wrap gap-2 items-center">
        <span className="text-[#f0b90b] font-semibold">GAMMA / GEX</span>
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

      {model?.note && (
        <div className="px-2 py-1 text-[9px] text-[#5e6673] border-b border-[#1e2329]">{model.note}</div>
      )}

      {!model && !err && (
        <div className="flex-1 flex items-center justify-center text-[#5e6673]">
          {loading ? 'Caricamento Deribit…' : 'Nessun dato'}
        </div>
      )}

      {model && (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#0b0e11] text-[10px] text-[#5e6673] z-10">
              <tr>
                <th className="text-left px-2 py-1">Kind</th>
                <th className="text-right px-2 py-1">Price</th>
                <th className="text-right px-2 py-1">Value</th>
                <th className="text-left px-2 py-1">Label</th>
              </tr>
            </thead>
            <tbody>
              {model.levels.map((lv, i) => (
                <tr key={`${lv.kind}-${lv.price}-${i}`} className="border-b border-[#1e2329]/50">
                  <td className="px-2 py-1">
                    <span style={{ color: KIND_COLOR[lv.kind] ?? '#848e9c' }}>{lv.kind}</span>
                  </td>
                  <td className="px-2 py-1 text-right text-[#eaecef]">{fmt(lv.price)}</td>
                  <td className="px-2 py-1 text-right text-[#848e9c]">{lv.value.toFixed(0)}</td>
                  <td className="px-2 py-1 text-[10px] text-[#848e9c] truncate max-w-[12rem]">{lv.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {model.levels.length === 0 && (
            <div className="p-4 text-center text-[#5e6673]">Nessun livello attivo in config</div>
          )}
          <div className="px-2 py-2 text-[9px] text-[#3d4450]">
            asOf {new Date(model.asOf).toLocaleString()} · source {model.source}
          </div>
        </div>
      )}
    </div>
  )
}
