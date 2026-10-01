/**
 * VPIN – Volume-Synchronized Probability of Informed Trading
 * (Easley, López de Prado & O'Hara 2012).
 * Pattern aligned with orderflow-metrics; pure TS, real trades only.
 */

export interface SignedTrade {
  price: number
  qty: number
  /** +1 buy aggressor, -1 sell aggressor */
  sign: 1 | -1
  time?: number
}

export interface VolumeBucket {
  buyVol: number
  sellVol: number
  totalVol: number
  /** Mid price of last trade in bucket */
  lastPrice: number
  /** Start/end times if available */
  t0?: number
  t1?: number
}

/** Split trade stream into equal-volume buckets (real qty only). */
export function bucketByVolume(
  trades: SignedTrade[],
  bucketSize: number
): VolumeBucket[] {
  if (bucketSize <= 0 || trades.length === 0) return []
  const buckets: VolumeBucket[] = []
  let buy = 0
  let sell = 0
  let total = 0
  let lastPrice = trades[0].price
  let t0 = trades[0].time

  for (const t of trades) {
    if (!Number.isFinite(t.qty) || t.qty <= 0) continue
    if (!Number.isFinite(t.price) || t.price <= 0) continue
    lastPrice = t.price
    let remaining = t.qty
    while (remaining > 1e-12) {
      const room = bucketSize - total
      const take = Math.min(remaining, room)
      if (t.sign === 1) buy += take
      else sell += take
      total += take
      remaining -= take
      if (total >= bucketSize - 1e-12) {
        buckets.push({
          buyVol: buy,
          sellVol: sell,
          totalVol: total,
          lastPrice,
          t0,
          t1: t.time,
        })
        buy = 0
        sell = 0
        total = 0
        t0 = t.time
      }
    }
  }
  return buckets
}

/**
 * VPIN = average |V_buy - V_sell| / V_bucket over a rolling window of buckets.
 * Returns value in [0, 1], or null if insufficient buckets.
 */
export function vpin(
  buckets: VolumeBucket[],
  window = 50
): number | null {
  if (window < 1 || buckets.length < window) return null
  const slice = buckets.slice(-window)
  let sum = 0
  for (const b of slice) {
    const den = b.totalVol > 0 ? b.totalVol : 1
    sum += Math.abs(b.buyVol - b.sellVol) / den
  }
  return sum / slice.length
}

/** Trade imbalance from signed flow: (buy - sell) / (buy + sell). */
export function tradeImbalance(trades: SignedTrade[]): number {
  let buy = 0
  let sell = 0
  for (const t of trades) {
    if (t.sign === 1) buy += t.qty
    else sell += t.qty
  }
  const den = buy + sell
  if (den <= 0) return 0
  return (buy - sell) / den
}
