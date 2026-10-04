/**
 * Discrete Fourier analysis on real price series (closes).
 * Educational / research – not a prediction guarantee.
 */

export interface Harmonic {
  k: number
  freq: number
  amp: number
  phase: number
  re: number
  im: number
  power: number
}

export interface DftResult {
  n: number
  mean: number
  harmonics: Harmonic[]
  top: Harmonic[]
}

/** Real DFT on centered series. O(n²) – use n ≤ 512. */
export function computeDft(closes: number[], maxK?: number): DftResult {
  const n = closes.length
  if (n < 8) {
    return { n, mean: 0, harmonics: [], top: [] }
  }
  let mean = 0
  for (let i = 0; i < n; i++) mean += closes[i]
  mean /= n

  const K = Math.min(maxK ?? Math.floor(n / 2), Math.floor(n / 2))
  const harmonics: Harmonic[] = []

  for (let k = 0; k <= K; k++) {
    let re = 0
    let im = 0
    for (let t = 0; t < n; t++) {
      const x = closes[t] - mean
      const ang = (-2 * Math.PI * k * t) / n
      re += x * Math.cos(ang)
      im += x * Math.sin(ang)
    }
    re /= n
    im /= n
    const raw = Math.hypot(re, im)
    const amp = k === 0 ? raw : 2 * raw
    const phase = Math.atan2(im, re)
    harmonics.push({
      k,
      freq: k / n,
      amp,
      phase,
      re,
      im,
      power: amp * amp,
    })
  }

  const top = harmonics
    .filter((h) => h.k > 0)
    .slice()
    .sort((a, b) => b.power - a.power)

  return { n, mean, harmonics, top }
}

export function reconstruct(
  dft: DftResult,
  length: number,
  count: number
): number[] {
  const out = new Array(length).fill(dft.mean)
  const use = dft.top.slice(0, Math.max(0, count))
  for (let t = 0; t < length; t++) {
    let y = dft.mean
    for (const h of use) {
      y += h.amp * Math.cos((2 * Math.PI * h.k * t) / dft.n + h.phase)
    }
    out[t] = y
  }
  return out
}

export function forecastHalf(closes: number[], harmonicCount: number): {
  fit: number[]
  forecast: number[]
  dft: DftResult
} {
  const n = closes.length
  const mid = Math.floor(n / 2)
  const train = closes.slice(0, mid)
  const dft = computeDft(train, Math.min(64, Math.floor(mid / 2)))
  const fit = reconstruct(dft, mid, harmonicCount)
  const forecast: number[] = []
  const use = dft.top.slice(0, harmonicCount)
  for (let t = mid; t < n; t++) {
    let y = dft.mean
    for (const h of use) {
      y += h.amp * Math.cos((2 * Math.PI * h.k * t) / dft.n + h.phase)
    }
    forecast.push(y)
  }
  return { fit, forecast, dft }
}

export function epicycleRadii(
  dft: DftResult,
  count: number
): { amp: number; phase: number; k: number }[] {
  return dft.top.slice(0, count).map((h) => ({
    amp: h.amp,
    phase: h.phase,
    k: h.k,
  }))
}
