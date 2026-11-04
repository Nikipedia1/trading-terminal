/**
 * Order Block market engine — Binance public data.
 * Precise OB detection + liquidity-ranked boards + sector-capped PICKS.
 */

import type { Candle } from '@/types'
import { CRYPTO_UNIVERSE, SECTOR_ORDER } from './universe'
import { detectPreciseOrderBlocks, sessionAtr } from './obDetect'
import type {
  AssetDetail,
  MarketBreadth,
  ObZoneView,
  PickRule,
  RankedAsset,
  SectorRow,
  ZoneLevels,
} from './types'

const BINANCE = 'https://api.binance.com'
const BOARD_SIZE = 20
const PICKS_PER_SIDE = 3
const MAX_PER_SECTOR = 2
const CHOPPY_ABS_STRENGTH = 0.18
const MIN_LIQ_FOR_PICK = 35

interface Binance24h {
  symbol: string
  lastPrice: string
  priceChangePercent: string
  highPrice: string
  lowPrice: string
  openPrice: string
  quoteVolume: string
}

function assignPicks(ranked: RankedAsset[]): RankedAsset[] {
  const sectorCount = new Map<string, number>()
  let picksLeft = PICKS_PER_SIDE
  return ranked.map((a) => {
    let rule: PickRule = 'NOT_PICKED_OUTSIDE_TOP'
    let isPick = false
    if (!a.clean) {
      rule = 'NOT_PICKED_CHOPPY'
    } else if (a.liquidityScore < MIN_LIQ_FOR_PICK) {
      rule = 'NOT_PICKED_LOW_LIQ'
    } else if (picksLeft > 0) {
      const n = sectorCount.get(a.sector) ?? 0
      if (n >= MAX_PER_SECTOR) {
        rule = 'NOT_PICKED_SECTOR_CAP'
      } else {
        rule = 'PICK'
        isPick = true
        picksLeft--
        sectorCount.set(a.sector, n + 1)
      }
    }
    return { ...a, pickRule: rule, isPick }
  })
}

export async function fetchMarketBreadth(): Promise<MarketBreadth> {
  const res = await fetch(`${BINANCE}/api/v3/ticker/24hr`)
  if (!res.ok) throw new Error(`Binance 24hr ${res.status}`)
  const all = (await res.json()) as Binance24h[]
  const bySym = new Map(all.map((t) => [t.symbol, t]))

  const vols: number[] = []
  for (const u of CRYPTO_UNIVERSE) {
    const t = bySym.get(u.symbol)
    if (t) vols.push(parseFloat(t.quoteVolume) || 0)
  }
  vols.sort((a, b) => a - b)
  const volAt = (v: number) => {
    if (!vols.length) return 50
    let i = 0
    while (i < vols.length && vols[i]! < v) i++
    return Math.round((i / vols.length) * 100)
  }

  const assets: RankedAsset[] = []
  for (const u of CRYPTO_UNIVERSE) {
    const t = bySym.get(u.symbol)
    if (!t) continue
    const last = parseFloat(t.lastPrice)
    const open = parseFloat(t.openPrice)
    const high = parseFloat(t.highPrice)
    const low = parseFloat(t.lowPrice)
    const changePct = parseFloat(t.priceChangePercent)
    const range = high - low || last * 0.01
    const move = last - open
    const strength = range > 0 ? move / range : 0
    const absStrength = Math.min(1, Math.abs(strength))
    const vol = parseFloat(t.quoteVolume) || 0
    const volPct = volAt(vol)
    const purity = absStrength * 100
    const liquidityScore = Math.round(Math.min(99, volPct * 0.55 + purity * 0.45))
    const clean = absStrength >= CHOPPY_ABS_STRENGTH && Math.abs(changePct) >= 0.35
    let buildUp: RankedAsset['buildUp'] = 'neutral'
    if (changePct > 1.2 && strength > 0.4) buildUp = 'long'
    else if (changePct < -1.2 && strength < -0.4) buildUp = 'short'

    assets.push({
      symbol: u.symbol,
      base: u.base,
      sector: u.sector,
      lastPrice: last,
      changePct,
      strength,
      absStrength,
      liquidityScore,
      volumeQuote: vol,
      high,
      low,
      open,
      side: changePct >= 0 ? 'bullish' : 'bearish',
      rank: 0,
      percentile: 0,
      buildUp,
      clean,
      pickRule: 'NOT_PICKED_OUTSIDE_TOP',
      isPick: false,
    })
  }

  const score = (a: RankedAsset) => a.absStrength * (0.55 + a.liquidityScore / 220)
  const bull = assets
    .filter((a) => a.changePct >= 0)
    .sort((a, b) => score(b) - score(a) || b.changePct - a.changePct)
  const bear = assets
    .filter((a) => a.changePct < 0)
    .sort((a, b) => score(b) - score(a) || a.changePct - b.changePct)

  bull.forEach((a, i) => {
    a.rank = i + 1
    a.percentile = bull.length ? 100 * (1 - i / bull.length) : 50
    a.side = 'bullish'
  })
  bear.forEach((a, i) => {
    a.rank = i + 1
    a.percentile = bear.length ? 100 * (1 - i / bear.length) : 50
    a.side = 'bearish'
  })

  const bullBoard = assignPicks(bull.slice(0, BOARD_SIZE))
  const bearBoard = assignPicks(bear.slice(0, BOARD_SIZE))
  const picksBull = bullBoard.filter((a) => a.isPick)
  const picksBear = bearBoard.filter((a) => a.isPick)

  const pickMap = new Map<string, RankedAsset>()
  for (const a of [...bullBoard, ...bearBoard]) pickMap.set(a.symbol, a)
  for (let i = 0; i < assets.length; i++) {
    const p = pickMap.get(assets[i]!.symbol)
    if (p) assets[i] = p
  }

  const sectorMap = new Map<string, { sum: number; n: number; bull: number; bear: number }>()
  for (const a of assets) {
    const s = sectorMap.get(a.sector) ?? { sum: 0, n: 0, bull: 0, bear: 0 }
    s.sum += a.changePct
    s.n++
    if (a.changePct >= 0) s.bull++
    else s.bear++
    sectorMap.set(a.sector, s)
  }
  const sectors: SectorRow[] = SECTOR_ORDER.filter((sec) => sectorMap.has(sec)).map((sec) => {
    const s = sectorMap.get(sec)!
    return {
      sector: sec,
      changePct: s.n ? s.sum / s.n : 0,
      bullish: s.bull,
      bearish: s.bear,
      count: s.n,
    }
  })
  sectors.sort((a, b) => b.changePct - a.changePct)

  return {
    bullish: assets.filter((a) => a.changePct >= 0).length,
    bearish: assets.filter((a) => a.changePct < 0).length,
    neutral: 0,
    avgChangePct:
      assets.length > 0 ? assets.reduce((s, a) => s + a.changePct, 0) / assets.length : 0,
    leadingSector: sectors[0] ?? null,
    laggingSector: sectors[sectors.length - 1] ?? null,
    sectors,
    assets,
    bullBoard,
    bearBoard,
    picksBull,
    picksBear,
    updatedAt: Date.now(),
  }
}

export async function fetchKlines(
  symbol: string,
  interval = '5m',
  limit = 144
): Promise<Candle[]> {
  const url = `${BINANCE}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`klines ${symbol} ${res.status}`)
  const raw = (await res.json()) as unknown[][]
  return raw.map((k) => ({
    time: Math.floor(Number(k[0]) / 1000),
    open: parseFloat(String(k[1])),
    high: parseFloat(String(k[2])),
    low: parseFloat(String(k[3])),
    close: parseFloat(String(k[4])),
    volume: parseFloat(String(k[5])),
  }))
}

function levelsFromOb(asset: RankedAsset, obs: ObZoneView[]): ZoneLevels | null {
  const sideObs = obs
    .filter((o) => o.kind === asset.side && o.mitigation !== 'broken')
    .sort((a, b) => {
      const order = { fresh: 0, tested: 1, mitigated: 2, broken: 3 }
      return order[a.mitigation] - order[b.mitigation] || b.quality - a.quality || b.index - a.index
    })
  const primary = sideObs[0]
  if (!primary) {
    const z = (asset.high + asset.low) / 2
    if (asset.side === 'bullish') {
      return {
        z,
        s1: asset.low,
        r1: asset.lastPrice + (asset.lastPrice - asset.low) * 0.5,
        r2: asset.high,
        obTop: z * 1.002,
        obBottom: asset.low,
        bodyTop: z * 1.001,
        bodyBottom: asset.low,
        quality: 0.3,
        mitigation: 'fresh',
      }
    }
    return {
      z,
      s1: asset.high,
      r1: asset.lastPrice - (asset.high - asset.lastPrice) * 0.5,
      r2: asset.low,
      obTop: asset.high,
      obBottom: z * 0.998,
      bodyTop: asset.high,
      bodyBottom: z * 0.999,
      quality: 0.3,
      mitigation: 'fresh',
    }
  }

  const z = (primary.bodyTop + primary.bodyBottom) / 2
  if (asset.side === 'bullish') {
    const s1 = primary.bodyBottom
    const risk = Math.max(asset.lastPrice - s1, asset.lastPrice * 0.0015)
    return {
      z,
      s1,
      r1: asset.lastPrice + risk * 1.6,
      r2: asset.lastPrice + risk * 3.2,
      obTop: primary.top,
      obBottom: primary.bottom,
      bodyTop: primary.bodyTop,
      bodyBottom: primary.bodyBottom,
      quality: primary.quality,
      mitigation: primary.mitigation,
    }
  }
  const s1 = primary.bodyTop
  const risk = Math.max(s1 - asset.lastPrice, asset.lastPrice * 0.0015)
  return {
    z,
    s1,
    r1: asset.lastPrice - risk * 1.6,
    r2: asset.lastPrice - risk * 3.2,
    obTop: primary.top,
    obBottom: primary.bottom,
    bodyTop: primary.bodyTop,
    bodyBottom: primary.bodyBottom,
    quality: primary.quality,
    mitigation: primary.mitigation,
  }
}

export async function fetchAssetDetail(
  asset: RankedAsset,
  interval: '5m' | '15m' = '5m'
): Promise<AssetDetail> {
  const candles = await fetchKlines(asset.symbol, interval, 160)
  const obs = detectPreciseOrderBlocks(candles, 130)
  let vwap: number | null = null
  if (candles.length) {
    let pv = 0
    let v = 0
    for (const c of candles) {
      const tp = (c.high + c.low + c.close) / 3
      pv += tp * c.volume
      v += c.volume
    }
    vwap = v > 0 ? pv / v : null
  }
  const zone = levelsFromOb(asset, obs)
  let rr: number | null = null
  if (zone) {
    const risk = Math.abs(asset.lastPrice - zone.s1)
    const reward = Math.abs(zone.r1 - asset.lastPrice)
    if (risk > 0) rr = reward / risk
  }
  const atr = sessionAtr(candles)
  return {
    asset,
    candles,
    orderBlocks: obs,
    zone,
    vwap,
    rr,
    interval,
    atr: atr > 0 ? atr : null,
  }
}
