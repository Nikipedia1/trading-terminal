/**
 * Microstructure panel – live OFI, VPIN, depth imbalance from real feeds.
 */

import { useEffect, useState } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import { startMicroEngine, type MicroSnapshot } from './engine'

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
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const panels = useLayoutStore((s) => s.panels)
  const primary = panels.find((p) => p.id === primaryPanelId) ?? panels[0]
  const symbol = primary?.symbol ?? 'BTCUSDT'
  const exchange = primary?.exchange ?? 'binance'

  const [snap, setSnap] = useState<MicroSnapshot | null>(null)

  useEffect(() => {
    const h = startMicroEngine(exchange, symbol, setSnap)
    return () => h.unsubscribe()
  }, [exchange, symbol])

  const ofiTone =
    snap && snap.ofiCum > 0 ? 'up' : snap && snap.ofiCum < 0 ? 'down' : 'neutral'
  const imbTone =
    snap && snap.depthImb > 0.05 ? 'up' : snap && snap.depthImb < -0.05 ? 'down' : 'neutral'
  const tradeTone =
    snap && snap.tradeImb > 0.05 ? 'up' : snap && snap.tradeImb < -0.05 ? 'down' : 'neutral'

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[11px]">
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
              label="OFI cumulative"
              value={fmt(snap.ofiCum, 3)}
              tone={ofiTone}
              hint="Cont–Kukanov–Stoikov order flow imbalance"
            />
            <Metric
              label="OFI last step"
              value={fmt(snap.ofiStep, 3)}
              tone={snap.ofiStep > 0 ? 'up' : snap.ofiStep < 0 ? 'down' : 'neutral'}
            />
            <Metric
              label="Depth imbalance"
              value={fmt(snap.depthImb, 3)}
              tone={imbTone}
              hint="(bidSize − askSize) / (bid + ask) at top of book"
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
            <Metric
              label="Spread (bps)"
              value={fmt(snap.spreadBps, 2)}
            />
            <Metric label="Mid" value={fmt(snap.mid, 4)} />
            <Metric label="Micro-price" value={fmt(snap.microPrice, 4)} />
          </div>

          <div className="text-[9px] text-[#5e6673] leading-snug px-0.5 space-y-0.5">
            <p>
              Quotes {snap.quoteCount.toLocaleString()} · Trades{' '}
              {snap.tradeCount.toLocaleString()} · VPIN buckets {snap.bucketCount}
            </p>
            <p>
              Algorithms: OFI (CKS 2014) · VPIN (Easley et al. 2012) — same family as
              orderflow-metrics, computed only on live exchange data.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
