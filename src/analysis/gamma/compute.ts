/**
 * Gamma-style levels from Deribit option OI (public).
 * Call/put walls, flip proxy, max pain, HVL — not full dealer GEX.
 */

import type { DeribitBookRow } from './deribit'
import { parseInstrument } from './deribit'
import type { GammaConfig, GammaLevel, GammaModel } from './types'

interface StrikeAgg {
  strike: number
  callOi: number
  putOi: number
}

function aggregate(rows: DeribitBookRow[]): { byStrike: StrikeAgg[]; spot: number } {
  const map = new Map<number, StrikeAgg>()
  let spot = 0
  for (const r of rows) {
    const p = parseInstrument(r.instrument_name)
    if (!p) continue
    const oi = Number(r.open_interest) || 0
    if (oi <= 0) continue
    if (r.underlying_price > 0) spot = r.underlying_price
    let a = map.get(p.strike)
    if (!a) {
      a = { strike: p.strike, callOi: 0, putOi: 0 }
      map.set(p.strike, a)
    }
    if (p.isCall) a.callOi += oi
    else a.putOi += oi
  }
  const byStrike = [...map.values()].sort((a, b) => a.strike - b.strike)
  return { byStrike, spot }
}

function maxPainStrike(byStrike: StrikeAgg[]): number | null {
  if (!byStrike.length) return null
  let best = byStrike[0].strike
  let bestCost = Infinity
  for (const pivot of byStrike) {
    let cost = 0
    for (const s of byStrike) {
      if (s.strike < pivot.strike) cost += (pivot.strike - s.strike) * s.putOi
      else if (s.strike > pivot.strike) cost += (s.strike - pivot.strike) * s.callOi
    }
    if (cost < bestCost) {
      bestCost = cost
      best = pivot.strike
    }
  }
  return best
}

export function buildGammaModel(
  currency: 'BTC' | 'ETH',
  rows: DeribitBookRow[],
  cfg: GammaConfig
): GammaModel | null {
  const { byStrike, spot } = aggregate(rows)
  if (!byStrike.length || !(spot > 0)) return null

  const levels: GammaLevel[] = []

  let callWall = byStrike[0]
  let putWall = byStrike[0]
  for (const s of byStrike) {
    if (s.callOi > callWall.callOi) callWall = s
    if (s.putOi > putWall.putOi) putWall = s
  }

  if (cfg.walls) {
    if (callWall.callOi > 0) {
      levels.push({
        price: callWall.strike,
        value: callWall.callOi,
        kind: 'call_wall',
        label: `Call wall ${fmt(callWall.strike)} · OI ${fmtOi(callWall.callOi)}`,
      })
    }
    if (putWall.putOi > 0) {
      levels.push({
        price: putWall.strike,
        value: putWall.putOi,
        kind: 'put_wall',
        label: `Put wall ${fmt(putWall.strike)} · OI ${fmtOi(putWall.putOi)}`,
      })
    }
  }

  if (cfg.flip) {
    const near = byStrike.filter(
      (s) => s.strike >= spot * 0.85 && s.strike <= spot * 1.15
    )
    const pool = near.length ? near : byStrike
    let flip = pool[0]
    let best = Math.abs(flip.callOi - flip.putOi)
    for (const s of pool) {
      const d = Math.abs(s.callOi - s.putOi)
      if (d < best) {
        best = d
        flip = s
      }
    }
    levels.push({
      price: flip.strike,
      value: flip.callOi - flip.putOi,
      kind: 'flip',
      label: `Flip ~ ${fmt(flip.strike)}`,
    })
  }

  if (cfg.maxPain) {
    const mp = maxPainStrike(byStrike)
    if (mp != null) {
      levels.push({
        price: mp,
        value: 0,
        kind: 'max_pain',
        label: `Max pain ${fmt(mp)}`,
      })
    }
  }

  const nearSpot = byStrike.filter(
    (s) => s.strike >= spot * 0.9 && s.strike <= spot * 1.1
  )
  if (nearSpot.length) {
    let hvl = nearSpot[0]
    for (const s of nearSpot) {
      if (s.callOi + s.putOi > hvl.callOi + hvl.putOi) hvl = s
    }
    levels.push({
      price: hvl.strike,
      value: hvl.callOi + hvl.putOi,
      kind: 'hvl',
      label: `HVL ${fmt(hvl.strike)} · OI ${fmtOi(hvl.callOi + hvl.putOi)}`,
    })
  }

  return {
    currency,
    spot,
    asOf: Date.now(),
    levels,
    note:
      'Deribit public OI walls / max-pain / flip proxy — not full dealer GEX.',
    source: 'deribit',
  }
}

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return n.toFixed(2)
}

function fmtOi(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toFixed(0)
}
