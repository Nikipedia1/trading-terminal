/** OFI / multi-OFI / VPIN / depth imbalance — live microstructure. */
import { useEffect, useState } from 'react'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import { startMicroEngine, type MicroSnapshot } from '@/analysis/microstructure'

function Gauge({
  label,
  value,
  min = -1,
  max = 1,
  format = (v: number) => v.toFixed(3),
}: {
  label: string
  value: number | null
  min?: number
  max?: number
  format?: (v: number) => string
}) {
  const v = value ?? 0
  const pct = Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))
  const color = v >= 0 ? '#0ecb81' : '#f6465d'
  return (
    <div className="px-2 py-1.5 border-b border-[#1e2329]/60">
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-[#848e9c]">{label}</span>
        <span style={{ color }}>{value == null ? '—' : format(value)}</span>
      </div>
      <div className="h-1.5 bg-[#12161c] rounded-full overflow-hidden relative">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#2b3139]" />
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{
            width: `${Math.abs(pct - 50) * 2}%`,
            marginLeft: v >= 0 ? '50%' : `${pct}%`,
            background: color,
          }}
        />
      </div>
    </div>
  )
}

export function OfiPanel() {
  const link = useResolvedChartLink('follow')
  const { symbol, exchange } = link
  const [snap, setSnap] = useState<MicroSnapshot | null>(null)

  useEffect(() => {
    const h = startMicroEngine(exchange, (symbol ?? '').toUpperCase(), (s) => setSnap({ ...s }))
    return () => h.unsubscribe()
  }, [exchange, symbol])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] text-[11px] font-mono">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex gap-2 items-center">
        <span className="text-[#f0b90b] font-semibold">OFI / VPIN</span>
        <span className="text-[#848e9c]">
          {symbol} · {exchange}
        </span>
        {snap?.ready && (
          <span className="ml-auto text-[10px] text-[#0ecb81]">LIVE</span>
        )}
      </div>
      {!snap?.ready && (
        <div className="flex-1 flex items-center justify-center text-[#5e6673]">
          Warm-up book + trades…
        </div>
      )}
      {snap?.ready && (
        <div className="flex-1 min-h-0 overflow-auto">
          <Gauge label="OFI step (L1)" value={snap.ofiStep} />
          <Gauge label="OFI cum" value={snap.ofiCum} min={-50} max={50} format={(v) => v.toFixed(2)} />
          <Gauge label={`Multi-OFI step (top ${snap.multiLevels})`} value={snap.multiOfiStep} />
          <Gauge
            label="Multi-OFI cum"
            value={snap.multiOfiCum}
            min={-80}
            max={80}
            format={(v) => v.toFixed(2)}
          />
          <Gauge label="Depth imbalance" value={snap.depthImb} />
          <Gauge label="Multi depth imbalance" value={snap.multiDepthImb} />
          <Gauge label="Trade imbalance" value={snap.tradeImb} />
          <Gauge label="VPIN" value={snap.vpin} min={0} max={1} format={(v) => v.toFixed(3)} />
          <div className="px-2 py-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-[#848e9c]">
            <span>Mid</span>
            <span className="text-right text-[#eaecef]">
              {snap.mid != null ? snap.mid.toFixed(2) : '—'}
            </span>
            <span>Micro price</span>
            <span className="text-right text-[#eaecef]">
              {snap.microPrice != null ? snap.microPrice.toFixed(2) : '—'}
            </span>
            <span>Spread bps</span>
            <span className="text-right text-[#eaecef]">
              {snap.spreadBps != null ? snap.spreadBps.toFixed(2) : '—'}
            </span>
            <span>Trades / Quotes</span>
            <span className="text-right text-[#eaecef]">
              {snap.tradeCount} / {snap.quoteCount}
            </span>
            <span>VPIN buckets</span>
            <span className="text-right text-[#eaecef]">{snap.bucketCount}</span>
          </div>
        </div>
      )}
    </div>
  )
}
