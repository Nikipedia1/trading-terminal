/** Fetch real Binance 24h tickers for wallet assets (public REST, no key). */

import { useEffect, useState } from 'react'

export interface AssetTicker {
  symbol: string
  lastPrice: number
  priceChangePercent: number
}

const CACHE_MS = 15_000

export function useWalletPrices(assets: string[]): Record<string, AssetTicker> {
  const [map, setMap] = useState<Record<string, AssetTicker>>({})
  const key = assets.map((a) => a.toUpperCase()).sort().join(',')

  useEffect(() => {
    if (!key) {
      setMap({})
      return
    }
    let cancelled = false
    const list = key.split(',').filter(Boolean)

    const load = async () => {
      const next: Record<string, AssetTicker> = {}
      // Prefer batch endpoint once, then filter
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const all = (await res.json()) as Array<{
          symbol: string
          lastPrice: string
          priceChangePercent: string
        }>
        const want = new Set(list.map((a) => `${a}USDT`))
        for (const row of all) {
          if (!want.has(row.symbol)) continue
          const base = row.symbol.replace(/USDT$/, '')
          next[base] = {
            symbol: row.symbol,
            lastPrice: Number(row.lastPrice),
            priceChangePercent: Number(row.priceChangePercent),
          }
        }
        // USDT peg
        next['USDT'] = { symbol: 'USDTUSDT', lastPrice: 1, priceChangePercent: 0 }
        if (!cancelled) setMap(next)
      } catch (e) {
        console.warn('[wallet] ticker fetch failed', e)
        // Leave previous map – never invent prices
      }
    }

    void load()
    const t = window.setInterval(load, CACHE_MS)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [key])

  return map
}
