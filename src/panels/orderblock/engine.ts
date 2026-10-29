/**
 * Order Block market engine — Binance public data.
 * Strength = |session move| / typical range (high-low of day), signed by direction.
 */

import { detectOrderBlocks } from '@/analysis/aiDesk/smcEngine'
import type { Candle } from '@/types'
import { CRYPTO_UNIVERSE, SECTOR_ORDER } from './universe'
import type {
  AssetDetail,
  MarketBreadth,
  ObZoneView,
  RankedAsset,
  SectorRow,
} from './types'

const BINANCE = 'https://api.binance.com'

interface Binance24h {
  symbol: string
  lastPrice: string
  priceChangePercent: string
  highPrice: string
  lowPrice: string
  openPrice: string
  quoteVolume: string
}

export async function fetchMarketBreadth(): Promise<MarketBreadth> {
  const res = await fetch(`${BINANCE}/api/v3/ticker/24hr`)
  if (!res.ok) throw new Error(`Binance 24hr ${res.status}`)
  const all = (await res.json()) as Binance24h[]
  const bySym = new Map(all.map((t) => [t.symbol, t]))

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
    const side = changePct >= 0.05 ? 'bullish' : changePct <= -0.05 ? 'bearish' : 'bullish'
    const vol = parseFloat(t.quoteVolume)
    let buildUp: RankedAsset['buildUp'] = 'neutral'
    if (changePct > 1 && strength > 0.35) buildUp = 'long'
    else if (changePct < -1 && strength < -0.35) buildUp = 'short'

    assets.push({
      symbol: u.symbol,
      base: u.base,
      sector: u.sector,
      lastPrice: last,
      changePct,
      strength,
      volumeQuote: vol,
      high,
      low,
      open,
      side: changePct >= 0 ? 'bullish' : 'bearish',
      rank: 0,
      percentile: 0,
      buildUp,
    })
  }

  // Rank by absolute strength, then assign side ranks
  const bull = assets
    .filter((a) => a.changePct >= 0)
    .sort((a, b) => b.strength - a.strength || b.changePct - a.changePct)
  const bear = assets
    .filter((a) => a.changePct < 0)
    .sort((a, b) => a.strength - b.strength || a.changePct - b.changePct)

  bull.forEach((a, i) => {
    a.rank = i + 1
    a.percentile = bull.length ? 100 * (1 - i / bull.length) : 50
    a.side = 'bullish'
  })
  bear.forEach((a, i) => {
    a.rank = i + 1
    a.percentile = bear.length ? 100 * (i / bear.length) : 50
    a.side = 'bearish'
  })

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

  const bullish = assets.filter((a) => a.changePct >= 0).length
  const bearish = assets.filter((a) => a.changePct < 0).length
  const avg =
    assets.length > 0 ? assets.reduce((s, a) => s + a.changePct, 0) / assets.length : 0

  return {
    bullish,
    bearish,
    neutral: 0,
    avgChangePct: avg,
    leadingSector: sectors[0] ?? null,
    laggingSector: sectors[sectors.length - 1] ?? null,
    sectors,
    assets,
    updatedAt: Date.now(),
  }
}

export async function fetchKlines(symbol: string, interval = '15m', limit = 96): Promise<Candle[]> {
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

function levelsFromOb(
  asset: RankedAsset,
  obs: ObZoneView[]
): AssetDetail['zone'] {
  const bull = obs.filter((o) => o.kind === 'bullish').slice(-1)[0]
  const bear = obs.filter((o) => o.kind === 'bearish').slice(-1)[0]
  if (asset.side === 'bullish' && bull) {
    const z = (bull.top + bull.bottom) / 2
    const s1 = bull.bottom
    const r1 = asset.lastPrice + (asset.lastPrice - s1) * 0.5
    const r2 = asset.lastPrice + (asset.lastPrice - s1)
    return { z, s1, r1, r2 }
  }
  if (asset.side === 'bearish' && bear) {
    const z = (bear.top + bear.bottom) / 2
    const s1 = bear.top // invalidation above for short
    const r1 = asset.lastPrice - (s1 - asset.lastPrice) * 0.5
    const r2 = asset.lastPrice - (s1 - asset.lastPrice)
    return { z, s1, r1, r2 }
  }
  // fallback session levels
  const mid = (asset.high + asset.low) / 2
  return {
    z: mid,
    s1: asset.low,
    r1: asset.high * 0.5 + asset.lastPrice * 0.5,
    r2: asset.high,
  }
}

export async function fetchAssetDetail(asset: RankedAsset): Promise<AssetDetail> {
  const candles = await fetchKlines(asset.symbol, '15m', 120)
  const obs = detectOrderBlocks(candles, 80).map(
    (o): ObZoneView => ({
      kind: o.kind,
      top: o.top,
      bottom: o.bottom,
      time: o.time,
      endTime: o.endTime,
    })
  )
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
  return { asset, candles, orderBlocks: obs, zone, vwap, rr }
}
