/**
 * Order Flow Imbalance – Cont, Kukanov & Stoikov (2014).
 * Inspired by twowaymind/orderflow-metrics API; vendored (zero runtime deps).
 * Real L1 quotes only – never invent book levels.
 */

export interface L1Quote {
  bidPrice: number
  bidSize: number
  askPrice: number
  askSize: number
  time?: number
}

/** Single-step OFI contribution from prev → curr best quotes. */
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
