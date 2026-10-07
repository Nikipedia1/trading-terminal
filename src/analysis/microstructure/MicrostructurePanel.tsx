/**
 * Microstructure panel – live OFI (L1 + multi-level), VPIN, depth imbalance from real feeds.
 */

import { useEffect, useState } from 'react'
import { startMicroEngine, type MicroSnapshot } from './engine'
import { useChartLink } from '@/hooks/useChartLink'
import { ChartLinkBar } from '@/ui/ChartLinkBar'

function fmt(n: number | null, d = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: d })
}

function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string
  value: string
  tone?: 'up' | 'down' | 'neutral'
  hint?: string
}) {
  const color =
    tone === 'up'
      ? 'text-[#0ecb81]'
      : tone === 'down'
        ? 'text-[#f6465d]'
        : 'text-[#eaecef]'
  return (
    <div className="rounded border border-[#2b3139] bg-[#0d1118] px-2 py-1.5" title={hint}>
      <div className="text-[9px] text-[#5e6673] uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-mono-nums tabular-nums font-semibold ${color}`}>{value}</div>
    </div>
  )
}

export function MicrostructurePanel() {
  const link = useChartLink('follow')
  const symbol = link.symbol
  const exchange = link.exchange

  const [snap, setSnap] = useState<MicroSnapshot | null>(null)

  useEffect(() => {
    const h = startMicroEngine(exchange, symbol, setSnap)
    return () => h.unsubscribe()
  }, [exchange, symbol])

  const ofiTone =
    snap && snap.ofiCum > 0 ? 'up' : snap && snap.ofiCum < 0 ? 'down' : 'neutral'
  const multiOfiTone =
    snap && snap.multiOfiCum > 0 ? 'up' : snap && snap.multiOfiCum < 0 ? 'down' : 'neutral'
  const imbTone =
    snap && snap.depthImb > 0.05 ? 'up' : snap && snap.depthImb < -0.05 ? 'down' : 'neutral'
  const multiImbTone =
    snap && snap.multiDepthImb > 0.05
      ? 'up'
      : snap && snap.multiDepthImb < -0.05
        ? 'down'
        : 'neutral'
  const tradeTone =
    snap && snap.tradeImb > 0.05 ? 'up' : snap && snap.tradeImb < -0.05 ? 'down' : 'neutral'

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[11px]">
      <ChartLinkBar
        dense
        mode={link.mode}
        setMode={link.setMode}
        panels={link.panels}
        linkedPanelId={link.linkedPanelId}
        setLinkedPanelId={link.setLinkedPanelId}
        symbol={link.symbol}
        interval={link.interval}
        exchange={link.exchange}
        customSymbol={link.customSymbol}
        setCustomSymbol={link.setCustomSymbol}
        customInterval={link.customInterval}
        setCustomInterval={link.setCustomInterval}
        customExchange={link.customExchange}
        setCustomExchange={link.setCustomExchange}
        applyToChart={link.applyToChart}
        makePrimary={link.makePrimary}
        isPrimary={link.isPrimary}
      />
      <div className="shrink-0 px-2 py-1.5 border-b border-[#2b3139] flex items-center gap-2">
        <span className="text-[10px] font-semibold text-[#f0b90b]">MICRO</span>
        <span className="font-mono text-[#eaecef]">{symbol}</span>
        <span className="text-[#5e6673]">{exchange}</span>
        <span
          className={
            'ml-auto text-[9px] ' +
            (snap?.ready ? 'text-[#0ecb81]' : 'text-[#f0b90b]')
          }
        >
          {snap?.ready ? 'LIVE' : 'SYNC…'}
        </span>
      </div>

      {!snap?.ready && (
        <div className="flex-1 flex items-center justify-center text-[#5e6673] text-xs px-4 text-center">
          Waiting for real L2 + trades — no synthetic metrics
        </div>
      )}

      {snap?.ready && (
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <Metric
              label="OFI L1 cumulative"
              value={fmt(snap.ofiCum, 3)}
              tone={ofiTone}
              hint="Cont–Kukanov–Stoikov order flow imbalance (best quotes only)"
            />
            <Metric
              label="OFI L1 last step"
              value={fmt(snap.ofiStep, 3)}
              tone={snap.ofiStep > 0 ? 'up' : snap.ofiStep < 0 ? 'down' : 'neutral'}
            />
            <Metric
              label={`OFI multi-L${snap.multiLevels} cum`}
              value={fmt(snap.multiOfiCum, 3)}
              tone={multiOfiTone}
              hint={`Multi-level OFI summed over top ${snap.multiLevels} book levels (equal weight)`}
            />
            <Metric
              label={`OFI multi-L${snap.multiLevels} step`}
              value={fmt(snap.multiOfiStep, 3)}
              tone={
                snap.multiOfiStep > 0 ? 'up' : snap.multiOfiStep < 0 ? 'down' : 'neutral'
              }
            />
            <Metric
              label="Depth imbalance L1"
              value={fmt(snap.depthImb, 3)}
              tone={imbTone}
              hint="(bidSize − askSize) / (bid + ask) at top of book"
            />
            <Metric
              label={`Depth imbalance L${snap.multiLevels}`}
              value={fmt(snap.multiDepthImb, 3)}
              tone={multiImbTone}
              hint={`Aggregated size imbalance over top ${snap.multiLevels} levels`}
            />
            <Metric
              label="Trade imbalance"
              value={fmt(snap.tradeImb, 3)}
              tone={tradeTone}
              hint="Aggressor buy vs sell volume"
            />
            <Metric
              label="VPIN"
              value={snap.vpin != null ? fmt(snap.vpin, 3) : 'warming…'}
              tone={
                snap.vpin != null && snap.vpin > 0.7
                  ? 'down'
                  : snap.vpin != null && snap.vpin < 0.3
                    ? 'up'
                    : 'neutral'
              }
              hint="Volume-synchronized PIN (toxicity). Needs enough volume buckets."
            />
            <Metric label="Spread (bps)" value={fmt(snap.spreadBps, 2)} />
            <Metric label="Mid" value={fmt(snap.mid, 4)} />
            <Metric label="Micro-price" value={fmt(snap.microPrice, 4)} />
          </div>

          <div className="text-[9px] text-[#5e6673] leading-snug px-0.5 space-y-0.5">
            <p>
              Quotes {snap.quoteCount.toLocaleString()} · Trades{' '}
              {snap.tradeCount.toLocaleString()} · VPIN buckets {snap.bucketCount} · Multi-levels{' '}
              {snap.multiLevels}
            </p>
            <p>
              Algorithms: OFI L1 + multi-level (CKS 2014 / MLOFI) · VPIN (Easley et al. 2012) —
              computed only on live exchange L2 + trades.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
