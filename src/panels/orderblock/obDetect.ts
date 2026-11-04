/**
 * High-precision order block detector.
 * - Requires break of structure (close beyond prior swing)
 * - Zone from candle BODY (institutional), not only wicks
 * - Displacement quality + mitigation / first-retest state
 */
import type { Candle } from '@/types'
import type { MitigationState, ObSide, ObZoneView } from './types'

function swingPoints(candles: Candle[], left = 3, right = 3) {
  const highs: { i: number; price: number }[] = []
  const lows: { i: number; price: number }[] = []
  for (let i = left; i < candles.length - right; i++) {
    let isH = true
    let isL = true
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue
      if (candles[j]!.high >= candles[i]!.high) isH = false
      if (candles[j]!.low <= candles[i]!.low) isL = false
    }
    if (isH) highs.push({ i, price: candles[i]!.high })
    if (isL) lows.push({ i, price: candles[i]!.low })
  }
  return { highs, lows }
}

function bodyBounds(c: Candle) {
  const bodyTop = Math.max(c.open, c.close)
  const bodyBottom = Math.min(c.open, c.close)
  return { bodyTop, bodyBottom }
}

function atr(candles: Candle[], n = 14): number {
  if (candles.length < 2) return 0
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!
    const p = candles[i - 1]!
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)))
  }
  const slice = trs.slice(-n)
  return slice.reduce((a, b) => a + b, 0) / (slice.length || 1)
}

function mitigationOf(
  kind: ObSide,
  bodyTop: number,
  bodyBottom: number,
  after: Candle[]
): { state: MitigationState; touches: number } {
  let touches = 0
  let broken = false
  for (const c of after) {
    if (kind === 'bullish') {
      if (c.low <= bodyTop && c.high >= bodyBottom) touches++
      if (c.close < bodyBottom) {
        broken = true
        break
      }
    } else {
      if (c.high >= bodyBottom && c.low <= bodyTop) touches++
      if (c.close > bodyTop) {
        broken = true
        break
      }
    }
  }
  if (broken) return { state: 'broken', touches }
  if (touches === 0) return { state: 'fresh', touches }
  if (touches === 1) return { state: 'tested', touches }
  return { state: 'mitigated', touches }
}

export function detectPreciseOrderBlocks(
  candles: Candle[],
  lookback = 120
): ObZoneView[] {
  if (candles.length < 20) return []
  const start = Math.max(5, candles.length - lookback)
  const { highs, lows } = swingPoints(candles)
  const avgAtr = atr(candles, 14)
  const out: ObZoneView[] = []
  const last = candles[candles.length - 1]!

  for (let i = start; i < candles.length - 4; i++) {
    const c = candles[i]!
    const { bodyTop, bodyBottom } = bodyBounds(c)
    const body = bodyTop - bodyBottom
    if (body < avgAtr * 0.05) continue

    const endJ = Math.min(candles.length - 1, i + 5)
    const impulseClose = candles[endJ]!.close
    const moveUp = impulseClose - c.high
    const moveDown = c.low - impulseClose

    const priorHigh = highs.filter((h) => h.i < i).slice(-1)[0]
    const priorLow = lows.filter((l) => l.i < i).slice(-1)[0]

    if (c.close < c.open && moveUp > avgAtr * 1.15) {
      const bos =
        priorHigh != null
          ? candles.slice(i + 1, endJ + 1).some((x) => x.close > priorHigh.price)
          : moveUp > avgAtr * 1.8
      if (bos) {
        const quality = Math.min(
          1,
          (moveUp / (avgAtr || 1)) * 0.35 + (body / (c.high - c.low || 1)) * 0.25 + 0.2
        )
        const after = candles.slice(endJ + 1)
        const mit = mitigationOf('bullish', bodyTop, bodyBottom, after)
        out.push({
          kind: 'bullish',
          top: c.high,
          bottom: c.low,
          bodyTop,
          bodyBottom,
          time: c.time,
          endTime: last.time,
          index: i,
          quality,
          mitigation: mit.state,
          touches: mit.touches,
        })
      }
    }

    if (c.close > c.open && moveDown > avgAtr * 1.15) {
      const bos =
        priorLow != null
          ? candles.slice(i + 1, endJ + 1).some((x) => x.close < priorLow.price)
          : moveDown > avgAtr * 1.8
      if (bos) {
        const quality = Math.min(
          1,
          (moveDown / (avgAtr || 1)) * 0.35 + (body / (c.high - c.low || 1)) * 0.25 + 0.2
        )
        const after = candles.slice(endJ + 1)
        const mit = mitigationOf('bearish', bodyTop, bodyBottom, after)
        out.push({
          kind: 'bearish',
          top: c.high,
          bottom: c.low,
          bodyTop,
          bodyBottom,
          time: c.time,
          endTime: last.time,
          index: i,
          quality,
          mitigation: mit.state,
          touches: mit.touches,
        })
      }
    }
  }

  const filtered: ObZoneView[] = []
  const sorted = [...out].sort((a, b) => b.index - a.index || b.quality - a.quality)
  for (const ob of sorted) {
    const near = filtered.some(
      (f) =>
        f.kind === ob.kind &&
        Math.abs((f.bodyTop + f.bodyBottom) / 2 - (ob.bodyTop + ob.bodyBottom) / 2) /
          Math.max(1e-9, (ob.bodyTop + ob.bodyBottom) / 2) <
          0.0025
    )
    if (!near) filtered.push(ob)
    if (filtered.length >= 8) break
  }
  return filtered.sort((a, b) => a.index - b.index)
}

export function sessionAtr(candles: Candle[]): number {
  return atr(candles, 14)
}
