/**
 * Build GEX-style model from Deribit public option book summaries.
 * Not full dealer GEX (no published gamma); OI-weighted proxy used by retail tools.
 */

import type { DeribitBookRow } from './deribit'
import { parseInstrument } from './deribit'
import type { GammaConfig, GammaLevel, GammaModel, GammaStrikeRow } from './types'

interface Agg {
  byStrike: GammaStrikeRow[]
  spot: number
}

function aggregate(rows: DeribitBookRow[]): Agg {
  const map = new Map<number, { callOi: number; putOi: number; spot: number }>()
  let spot = 0
  for (const r of rows) {
    const p = parseInstrument(r.instrument_name)
    if (!p) continue
    const oi = Number(r.open_interest) || 0
    if (oi <= 0) continue
    if (r.underlying_price > 0) spot = r.underlying_price
    let e = map.get(p.strike)
    if (!e) {
      e = { callOi: 0, putOi: 0, spot }
      map.set(p.strike, e)
    }
    if (p.isCall) e.callOi += oi
    else e.putOi += oi
  }
  const byStrike: GammaStrikeRow[] = []
  for (const [strike, v] of map) {
    const net = v.callOi - v.putOi
    const gex =
      strike >= spot ? v.callOi - v.putOi * 0.35 : -(v.putOi - v.callOi * 0.35)
    byStrike.push({
      strike,
      callOi: v.callOi,
      putOi: v.putOi,
      net,
      gex,
    })
  }
  byStrike.sort((a, b) => a.strike - b.strike)
  return { byStrike, spot }
}

function maxPainStrike(rows: GammaStrikeRow[]): number | null {
  if (!rows.length) return null
  let best = rows[0]!.strike
  let bestPain = Infinity
  for (const cand of rows) {
    let pain = 0
    for (const s of rows) {
      if (cand.strike > s.strike) pain += s.callOi * (cand.strike - s.strike)
      if (cand.strike < s.strike) pain += s.putOi * (s.strike - cand.strike)
    }
    if (pain < bestPain) {
      bestPain = pain
      best = cand.strike
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
  let callWall = byStrike[0]!
  let putWall = byStrike[0]!
  let maxPos = byStrike[0]!
  let maxNeg = byStrike[0]!

  for (const s of byStrike) {
    if (s.callOi > callWall.callOi) callWall = s
    if (s.putOi > putWall.putOi) putWall = s
    if (s.gex > maxPos.gex) maxPos = s
    if (s.gex < maxNeg.gex) maxNeg = s
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

  if (maxPos.gex > 0) {
    levels.push({
      price: maxPos.strike,
      value: maxPos.gex,
      kind: 'dominant_pos',
      label: `Max +GEX ${fmt(maxPos.strike)}`,
    })
  }
  if (maxNeg.gex < 0) {
    levels.push({
      price: maxNeg.strike,
      value: maxNeg.gex,
      kind: 'dominant_neg',
      label: `Max −GEX ${fmt(maxNeg.strike)}`,
    })
  }

  let flipStrike: number | null = null
  if (cfg.flip) {
    const near = byStrike.filter(
      (s) => s.strike >= spot * 0.85 && s.strike <= spot * 1.15
    )
    const pool = near.length ? near : byStrike
    let flip = pool[0]!
    let best = Math.abs(flip.callOi - flip.putOi)
    for (const s of pool) {
      const d = Math.abs(s.callOi - s.putOi)
      if (d < best) {
        best = d
        flip = s
      }
    }
    flipStrike = flip.strike
    levels.push({
      price: flip.strike,
      value: flip.callOi - flip.putOi,
      kind: 'flip',
      label: `Zero / Flip ~ ${fmt(flip.strike)}`,
    })
  }

  let mp: number | null = null
  if (cfg.maxPain) {
    mp = maxPainStrike(byStrike)
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
    let hvl = nearSpot[0]!
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

  const netGex = byStrike.reduce((a, s) => a + s.gex, 0)

  return {
    currency,
    spot,
    asOf: Date.now(),
    levels,
    profile: byStrike,
    netGex,
    callWall: callWall.callOi > 0 ? callWall.strike : null,
    putWall: putWall.putOi > 0 ? putWall.strike : null,
    flip: flipStrike,
    maxPain: mp,
    note:
      'Deribit public OI → GEX proxy (not full dealer gamma). Classic-style walls + profile.',
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
