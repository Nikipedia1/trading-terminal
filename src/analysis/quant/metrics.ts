/**
 * Quant metrics from real OHLCV closes — desk research helpers.
 */

export interface QuantSnapshot {
  n: number
  meanReturn: number
  volatility: number
  sharpe: number
  sortino: number
  maxDrawdown: number
  var95: number
  cvar95: number
  kellyFraction: number
  halfLifeBars: number | null
  hurst: number | null
  skew: number
  kurtosis: number
}

function returnsFromCloses(closes: number[]): number[] {
  const r: number[] = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) r.push(Math.log(closes[i] / closes[i - 1]))
  }
  return r
}

function mean(xs: number[]): number {
  if (!xs.length) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function std(xs: number[], m?: number): number {
  if (xs.length < 2) return 0
  const mu = m ?? mean(xs)
  let s = 0
  for (const x of xs) s += (x - mu) ** 2
  return Math.sqrt(s / (xs.length - 1))
}

export function computeQuantSnapshot(
  closes: number[],
  barsPerYear = 365 * 24
): QuantSnapshot {
  const r = returnsFromCloses(closes)
  const n = r.length
  const empty: QuantSnapshot = {
    n: 0,
    meanReturn: 0,
    volatility: 0,
    sharpe: 0,
    sortino: 0,
    maxDrawdown: 0,
    var95: 0,
    cvar95: 0,
    kellyFraction: 0,
    halfLifeBars: null,
    hurst: null,
    skew: 0,
    kurtosis: 0,
  }
  if (n < 20) return empty

  const mu = mean(r)
  const sig = std(r, mu)
  const downside = r.filter((x) => x < 0)
  const dsig = std(downside.length ? downside : [0])

  const annMu = mu * barsPerYear
  const annSig = sig * Math.sqrt(barsPerYear)
  const sharpe = annSig > 0 ? annMu / annSig : 0
  const sortino =
    dsig > 0 ? (mu * barsPerYear) / (dsig * Math.sqrt(barsPerYear)) : 0

  let peak = closes[0]
  let maxDd = 0
  for (const c of closes) {
    if (c > peak) peak = c
    const dd = peak > 0 ? (peak - c) / peak : 0
    if (dd > maxDd) maxDd = dd
  }

  const sorted = r.slice().sort((a, b) => a - b)
  const idx = Math.max(0, Math.floor(0.05 * sorted.length) - 1)
  const var95 = -sorted[idx]
  let csum = 0
  let cn = 0
  for (let i = 0; i <= idx; i++) {
    csum += sorted[i]
    cn++
  }
  const cvar95 = cn ? -csum / cn : 0

  const kelly = sig > 0 ? Math.max(0, Math.min(1, mu / (sig * sig))) : 0

  let halfLife: number | null = null
  const logp = closes.map((c) => Math.log(Math.max(c, 1e-12)))
  const lpMean = mean(logp)
  let num = 0
  let den = 0
  for (let i = 1; i < logp.length; i++) {
    const x = logp[i - 1] - lpMean
    const y = logp[i] - lpMean
    num += x * y
    den += x * x
  }
  if (den > 0) {
    const phi = num / den
    if (phi > 0 && phi < 1) {
      halfLife = Math.log(2) / -Math.log(phi)
    }
  }

  let hurst: number | null = null
  if (n >= 64) {
    const chunk = Math.floor(n / 4)
    const rs: number[] = []
    for (let start = 0; start + chunk <= n; start += chunk) {
      const slice = r.slice(start, start + chunk)
      const m = mean(slice)
      let cum = 0
      let maxC = -Infinity
      let minC = Infinity
      for (const x of slice) {
        cum += x - m
        if (cum > maxC) maxC = cum
        if (cum < minC) minC = cum
      }
      const s = std(slice, m)
      if (s > 0) rs.push((maxC - minC) / s)
    }
    if (rs.length >= 2) {
      const logRS = mean(rs.map((v) => Math.log(Math.max(v, 1e-12))))
      const logN = Math.log(chunk)
      hurst = Math.max(0, Math.min(1, logRS / logN))
    }
  }

  let m3 = 0
  let m4 = 0
  for (const x of r) {
    const d = x - mu
    m3 += d ** 3
    m4 += d ** 4
  }
  m3 /= n
  m4 /= n
  const skew = sig > 0 ? m3 / sig ** 3 : 0
  const kurtosis = sig > 0 ? m4 / sig ** 4 - 3 : 0

  return {
    n,
    meanReturn: mu,
    volatility: sig,
    sharpe,
    sortino,
    maxDrawdown: maxDd,
    var95,
    cvar95,
    kellyFraction: kelly,
    halfLifeBars: halfLife,
    hurst,
    skew,
    kurtosis,
  }
}

export function rollingSharpe(
  closes: number[],
  window: number,
  barsPerYear = 365 * 24
): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null)
  for (let i = window; i < closes.length; i++) {
    const snap = computeQuantSnapshot(closes.slice(i - window, i + 1), barsPerYear)
    out[i] = snap.sharpe
  }
  return out
}
