import { useMemo } from 'react'
import { computeQuantSnapshot } from '@/analysis/quant'
import type { Candle } from '@/types'

const CONCEPTS: { id: string; title: string; blurb: string }[] = [
  { id: 'bs', title: 'Black-Scholes', blurb: 'Closed-form option pricing under lognormal diffusion.' },
  { id: 'bm', title: 'Brownian Motion', blurb: 'Continuous random walk model for prices.' },
  { id: 'mc', title: 'Monte Carlo', blurb: 'Simulate many paths to estimate distributions.' },
  { id: 'greeks', title: 'Greeks', blurb: 'Δ Γ Θ ν ρ — sensitivity of option value.' },
  { id: 'mr', title: 'Mean Reversion', blurb: 'Prices tend to pull back toward a mean (OU / half-life).' },
  { id: 'sharpe', title: 'Sharpe Ratio', blurb: 'Excess return per unit of volatility.' },
  { id: 'ef', title: 'Efficient Frontier', blurb: 'Best expected return for each risk level.' },
  { id: 'capm', title: 'CAPM & Beta', blurb: 'Asset return vs market; β = sensitivity.' },
  { id: 'var', title: 'Value at Risk', blurb: 'Loss threshold at a confidence level.' },
  { id: 'kelly', title: 'Kelly Criterion', blurb: 'Optimal fraction of capital to bet.' },
  { id: 'clt', title: 'Central Limit Theorem', blurb: 'Averages of samples approach normality.' },
  { id: 'bayes', title: "Bayes' Theorem", blurb: 'Update beliefs as evidence arrives.' },
  { id: 'coint', title: 'Cointegration', blurb: 'Linked assets; trade the spread.' },
  { id: 'garch', title: 'GARCH', blurb: 'Volatility clustering over time.' },
  { id: 'mm', title: 'Market Making', blurb: 'Quote both sides; earn the spread.' },
]

function barsPerYear(interval?: string): number {
  const m: Record<string, number> = {
    '1m': 365 * 24 * 60,
    '5m': 365 * 24 * 12,
    '15m': 365 * 24 * 4,
    '1h': 365 * 24,
    '4h': 365 * 6,
    '1d': 365,
  }
  return m[interval || '1h'] ?? 365 * 24
}

export function QuantConceptsView({
  candles,
  intervalHint,
}: {
  candles: Candle[]
  intervalHint?: string
}) {
  const closes = useMemo(() => candles.map((c) => c.close), [candles])
  const snap = useMemo(
    () => computeQuantSnapshot(closes, barsPerYear(intervalHint)),
    [closes, intervalHint]
  )

  const live: Record<string, string> = {
    sharpe: snap.sharpe.toFixed(2),
    mr: snap.halfLifeBars != null ? `half-life ≈ ${snap.halfLifeBars.toFixed(1)} bars` : 'n/a',
    var: `VaR95 ≈ ${(snap.var95 * 100).toFixed(3)}% / bar`,
    kelly: `f* ≈ ${(snap.kellyFraction * 100).toFixed(1)}%`,
    garch: `vol ≈ ${(snap.volatility * 100).toFixed(3)}% / bar`,
    bm: `σ√t · n=${snap.n}`,
    clt: `skew=${snap.skew.toFixed(2)} kurt=${snap.kurtosis.toFixed(2)}`,
  }

  return (
    <div className="p-2 space-y-3 text-[11px] text-[#eaecef]">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { k: 'Sharpe', v: snap.sharpe.toFixed(2), c: 'text-[#f0b90b]' },
          { k: 'Sortino', v: snap.sortino.toFixed(2), c: 'text-[#0ecb81]' },
          { k: 'Max DD', v: `${(snap.maxDrawdown * 100).toFixed(1)}%`, c: 'text-[#f6465d]' },
          { k: 'VaR 95%', v: `${(snap.var95 * 100).toFixed(3)}%`, c: 'text-[#a855f7]' },
          { k: 'CVaR 95%', v: `${(snap.cvar95 * 100).toFixed(3)}%`, c: 'text-[#a855f7]' },
          { k: 'Kelly f*', v: `${(snap.kellyFraction * 100).toFixed(1)}%`, c: 'text-[#f0b90b]' },
          {
            k: 'Half-life',
            v: snap.halfLifeBars != null ? snap.halfLifeBars.toFixed(1) : '—',
            c: 'text-[#5b8def]',
          },
          {
            k: 'Hurst',
            v: snap.hurst != null ? snap.hurst.toFixed(2) : '—',
            c: 'text-[#5b8def]',
          },
        ].map((m) => (
          <div key={m.k} className="rounded-lg border border-[#2b3139] bg-[#0b0e11]/80 px-2.5 py-2">
            <div className="text-[9px] text-[#848e9c] uppercase tracking-wider">{m.k}</div>
            <div className={`font-mono text-sm font-semibold tabular-nums ${m.c}`}>{m.v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {CONCEPTS.map((c, i) => (
          <div
            key={c.id}
            className="rounded-lg border border-[#2b3139] bg-gradient-to-br from-[#12161c] to-[#0b0e11] p-3 min-h-[88px]"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[#f0b90b] font-bold text-[10px]">{i + 1}.</span>
              <span className="font-semibold text-[12px]">{c.title}</span>
            </div>
            <p className="text-[10px] text-[#848e9c] leading-snug mb-1.5">{c.blurb}</p>
            {live[c.id] && <p className="text-[10px] font-mono text-[#0ecb81]">{live[c.id]}</p>}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-[#5e6673] px-1">
        Metrics from live chart closes (log-returns). Research only — not investment advice.
      </p>
    </div>
  )
}
