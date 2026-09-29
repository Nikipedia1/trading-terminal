/**
 * Market sentiment – composite local score + optional Fear & Greed.
 * Score ∈ [-1, +1]: bearish → bullish.
 */

import type { CandleLike } from './engine'

export type SentimentLabel =
  | 'extreme_fear'
  | 'fear'
  | 'neutral'
  | 'greed'
  | 'extreme_greed'

export interface SentimentSnapshot {
  score: number
  label: SentimentLabel
  components: {
    momentum: number
    rsi: number
    volume: number
    fearGreed: number | null
  }
  updatedAt: number
  source: string
}

function clamp(n: number, a = -1, b = 1) {
  return Math.max(a, Math.min(b, n))
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  let gains = 0
  let losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    if (d >= 0) gains += d
    else losses -= d
  }
  if (losses === 0) return 100
  const rs = gains / losses
  return 100 - 100 / (1 + rs)
}

function labelFromScore(score: number): SentimentLabel {
  if (score <= -0.6) return 'extreme_fear'
  if (score <= -0.2) return 'fear'
  if (score < 0.2) return 'neutral'
  if (score < 0.6) return 'greed'
  return 'extreme_greed'
}

export function computeSentiment(
  candles: CandleLike[],
  change24hPct?: number | null,
  fearGreedIndex?: number | null
): SentimentSnapshot {
  const closes = candles.map((c) => c.close)
  const vols = candles.map((c) => c.volume ?? 0)
  const n = closes.length

  let momentum = 0
  if (n >= 21) {
    const ret = (closes[n - 1] - closes[n - 21]) / closes[n - 21]
    momentum = clamp(ret / 0.08)
  } else if (change24hPct != null && Number.isFinite(change24hPct)) {
    momentum = clamp(change24hPct / 8)
  }

  const r = rsi(closes, 14)
  const rsiScore = r == null ? 0 : clamp((r - 50) / 30)

  let volume = 0
  if (n >= 20) {
    const recent = vols.slice(-5).reduce((a, b) => a + b, 0) / 5
    const base = vols.slice(-20).reduce((a, b) => a + b, 0) / 20
    if (base > 0) volume = clamp((recent / base - 1) / 1.5)
  }

  const fg =
    fearGreedIndex != null && Number.isFinite(fearGreedIndex)
      ? clamp((fearGreedIndex - 50) / 50)
      : null

  let score =
    momentum * 0.35 + rsiScore * 0.35 + volume * 0.15 + (fg != null ? fg * 0.15 : 0)
  if (fg == null) {
    score = momentum * 0.4 + rsiScore * 0.4 + volume * 0.2
  }
  score = clamp(score)

  return {
    score,
    label: labelFromScore(score),
    components: {
      momentum,
      rsi: rsiScore,
      volume,
      fearGreed: fg,
    },
    updatedAt: Date.now(),
    source: fg != null ? 'local+fng' : 'local',
  }
}

let cachedFg: { value: number; at: number } | null = null

export async function fetchFearGreed(): Promise<number | null> {
  if (cachedFg && Date.now() - cachedFg.at < 30 * 60_000) return cachedFg.value
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return cachedFg?.value ?? null
    const data = await res.json()
    const v = Number(data?.data?.[0]?.value)
    if (!Number.isFinite(v)) return cachedFg?.value ?? null
    cachedFg = { value: v, at: Date.now() }
    return v
  } catch {
    return cachedFg?.value ?? null
  }
}
