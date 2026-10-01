/**
 * Order Flow Imbalance – Cont, Kukanov & Stoikov (2014).
 * Multi-level extension (MLOFI) – sum of per-level contributions over top N.
 * Inspired by twowaymind/orderflow-metrics API; vendored (zero runtime deps).
 * Real L2 quotes only – never invent book levels.
 */

export interface L1Quote {
  bidPrice: number
  bidSize: number
  askPrice: number
  askSize: number
  time?: number
}

/** One side level (price + size). */
export interface BookSideLevel {
  price: number
  size: number
}

/** Top-N levels snapshot for multi-level OFI. */
export interface LnQuote {
  bids: BookSideLevel[] // index 0 = best, sorted desc
  asks: BookSideLevel[] // index 0 = best, sorted asc
  time?: number
}

/** Single-step OFI contribution from prev → curr best quotes (L1). */
export function ofiContribution(prev: L1Quote, curr: L1Quote): number {
  let ofi = 0

  // Bid side
  if (curr.bidPrice > prev.bidPrice) {
    ofi += curr.bidSize
  } else if (curr.bidPrice === prev.bidPrice) {
    ofi += curr.bidSize - prev.bidSize
  } else {
    ofi -= prev.bidSize
  }

  // Ask side (size increase at same/lower ask = sell pressure → negative OFI)
  if (curr.askPrice < prev.askPrice) {
    ofi -= curr.askSize
  } else if (curr.askPrice === prev.askPrice) {
    ofi -= curr.askSize - prev.askSize
  } else {
    ofi += prev.askSize
  }

  return ofi
}

/** Per-step OFI series (length = quotes.length - 1). */
export function ofiSeries(quotes: L1Quote[]): number[] {
  if (quotes.length < 2) return []
  const out: number[] = []
  for (let i = 1; i < quotes.length; i++) {
    out.push(ofiContribution(quotes[i - 1], quotes[i]))
  }
  return out
}

/** Cumulative OFI over the quote path. */
export function ofi(quotes: L1Quote[]): number {
  return ofiSeries(quotes).reduce((a, b) => a + b, 0)
}

/** Top-of-book depth imbalance in [-1, 1]: (bid - ask) / (bid + ask). */
export function depthImbalance(q: L1Quote): number {
  const den = q.bidSize + q.askSize
  if (den <= 0) return 0
  return (q.bidSize - q.askSize) / den
}

/** Weighted mid / micro-price. */
export function weightedMid(q: L1Quote): number {
  const den = q.bidSize + q.askSize
  if (den <= 0) return (q.bidPrice + q.askPrice) / 2
  return (q.askPrice * q.bidSize + q.bidPrice * q.askSize) / den
}

export function relativeSpreadBps(q: L1Quote): number {
  const mid = (q.bidPrice + q.askPrice) / 2
  if (mid <= 0) return 0
  return ((q.askPrice - q.bidPrice) / mid) * 10_000
}

// ─── Multi-level OFI (MLOFI) ───────────────────────────────────────────────

/**
 * Per-level bid contribution (Cont-style rules applied to one level).
 * Same semantics as L1 bid half of ofiContribution.
 */
function levelBidContribution(prev: BookSideLevel | undefined, curr: BookSideLevel | undefined): number {
  if (!curr) {
    // level disappeared → treat as full removal of previous size
    return prev ? -prev.size : 0
  }
  if (!prev) {
    // new level appeared
    return curr.size
  }
  if (curr.price > prev.price) return curr.size
  if (curr.price === prev.price) return curr.size - prev.size
  return -prev.size
}

/**
 * Per-level ask contribution (sign inverted: size increase = sell pressure).
 */
function levelAskContribution(prev: BookSideLevel | undefined, curr: BookSideLevel | undefined): number {
  if (!curr) {
    return prev ? prev.size : 0 // ask level gone → remove sell pressure
  }
  if (!prev) {
    return -curr.size // new ask level → sell pressure
  }
  if (curr.price < prev.price) return -curr.size
  if (curr.price === prev.price) return -(curr.size - prev.size)
  return prev.size
}

export type MultiLevelWeight = 'equal' | 'harmonic' | 'linear'

function levelWeight(k: number, n: number, mode: MultiLevelWeight): number {
  if (mode === 'equal') return 1
  if (mode === 'harmonic') return 1 / (k + 1)
  // linear decay: level 0 = 1, last level ≈ 1/n
  return Math.max(0, (n - k) / n)
}

/**
 * Multi-level OFI contribution over top `levels` of the book.
 * Applies Cont rules independently at each level, then sums (optionally weighted).
 * Missing levels contribute 0; never invents prices/sizes.
 *
 * @param prev previous LnQuote
 * @param curr current LnQuote
 * @param levels max depth (default 5; literature often uses 5–10)
 * @param weight equal | harmonic (1/(k+1)) | linear decay
 */
export function multiLevelOfiContribution(
  prev: LnQuote,
  curr: LnQuote,
  levels = 5,
  weight: MultiLevelWeight = 'equal'
): number {
  const n = Math.max(1, Math.floor(levels))
  let ofi = 0
  for (let k = 0; k < n; k++) {
    const w = levelWeight(k, n, weight)
    ofi += w * levelBidContribution(prev.bids[k], curr.bids[k])
    ofi += w * levelAskContribution(prev.asks[k], curr.asks[k])
  }
  return ofi
}

/** Series of multi-level OFI steps. */
export function multiLevelOfiSeries(
  quotes: LnQuote[],
  levels = 5,
  weight: MultiLevelWeight = 'equal'
): number[] {
  if (quotes.length < 2) return []
  const out: number[] = []
  for (let i = 1; i < quotes.length; i++) {
    out.push(multiLevelOfiContribution(quotes[i - 1], quotes[i], levels, weight))
  }
  return out
}

/** Cumulative multi-level OFI. */
export function multiLevelOfi(
  quotes: LnQuote[],
  levels = 5,
  weight: MultiLevelWeight = 'equal'
): number {
  return multiLevelOfiSeries(quotes, levels, weight).reduce((a, b) => a + b, 0)
}

/**
 * Multi-level depth imbalance in [-1, 1].
 * Sums sizes over top N levels, then (bidTot − askTot) / (bidTot + askTot).
 */
export function multiLevelDepthImbalance(q: LnQuote, levels = 5): number {
  const n = Math.max(1, Math.floor(levels))
  let bid = 0
  let ask = 0
  for (let k = 0; k < n; k++) {
    if (q.bids[k]) bid += q.bids[k].size
    if (q.asks[k]) ask += q.asks[k].size
  }
  const den = bid + ask
  if (den <= 0) return 0
  return (bid - ask) / den
}

/**
 * Build LnQuote from sorted bid/ask arrays (desc/asc).
 * Only real levels; empty arrays → empty quote.
 */
export function lnQuoteFromLevels(
  bids: { price: number; qty: number }[],
  asks: { price: number; qty: number }[],
  levels = 5,
  time?: number
): LnQuote {
  const n = Math.max(1, Math.floor(levels))
  return {
    bids: bids.slice(0, n).map((l) => ({ price: l.price, size: l.qty })),
    asks: asks.slice(0, n).map((l) => ({ price: l.price, size: l.qty })),
    time,
  }
}

/** Convenience: L1Quote from first level of LnQuote (or null). */
export function topOfLn(q: LnQuote): L1Quote | null {
  const b = q.bids[0]
  const a = q.asks[0]
  if (!b || !a || b.price <= 0 || a.price <= 0) return null
  return {
    bidPrice: b.price,
    bidSize: b.size,
    askPrice: a.price,
    askSize: a.size,
    time: q.time,
  }
}
