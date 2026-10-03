/**
 * Title/source → asset & macro tags + optional tradable USDT symbol.
 * Shared client logic; API uses a parallel rule set in functions/api/news.ts.
 */

import { SYMBOL_PRESETS } from '@/data/symbols'

export interface TagRule {
  tag: string
  /** Word-boundary regex against title + source */
  re: RegExp
  /** If set, clicking the news can switch the chart to this pair */
  symbol?: string
}

/** Ordered: more specific / longer tokens first where relevant. */
export const ASSET_TAG_RULES: TagRule[] = [
  // Majors
  { tag: 'BTC', re: /\b(bitcoin|btc)\b/i, symbol: 'BTCUSDT' },
  { tag: 'ETH', re: /\b(ethereum|ether|eth)\b/i, symbol: 'ETHUSDT' },
  { tag: 'SOL', re: /\b(solana|sol)\b/i, symbol: 'SOLUSDT' },
  { tag: 'BNB', re: /\b(binance coin|bnb)\b/i, symbol: 'BNBUSDT' },
  { tag: 'XRP', re: /\b(ripple|xrp)\b/i, symbol: 'XRPUSDT' },
  { tag: 'ADA', re: /\b(cardano|ada)\b/i, symbol: 'ADAUSDT' },
  { tag: 'DOGE', re: /\b(dogecoin|doge)\b/i, symbol: 'DOGEUSDT' },
  { tag: 'AVAX', re: /\b(avalanche|avax)\b/i, symbol: 'AVAXUSDT' },
  { tag: 'DOT', re: /\b(polkadot|dot)\b/i, symbol: 'DOTUSDT' },
  { tag: 'LINK', re: /\b(chainlink|link)\b/i, symbol: 'LINKUSDT' },
  { tag: 'TON', re: /\b(toncoin|ton)\b/i, symbol: 'TONUSDT' },
  { tag: 'TRX', re: /\b(tron|trx)\b/i, symbol: 'TRXUSDT' },
  { tag: 'LTC', re: /\b(litecoin|ltc)\b/i, symbol: 'LTCUSDT' },
  { tag: 'ATOM', re: /\b(cosmos|atom)\b/i, symbol: 'ATOMUSDT' },
  { tag: 'NEAR', re: /\b(near protocol|near)\b/i, symbol: 'NEARUSDT' },
  { tag: 'APT', re: /\b(aptos|apt)\b/i, symbol: 'APTUSDT' },
  { tag: 'SUI', re: /\b(sui)\b/i, symbol: 'SUIUSDT' },
  { tag: 'ARB', re: /\b(arbitrum|arb)\b/i, symbol: 'ARBUSDT' },
  { tag: 'OP', re: /\b(optimism|op token)\b/i, symbol: 'OPUSDT' },
  { tag: 'MATIC', re: /\b(polygon|matic|pol token)\b/i, symbol: 'MATICUSDT' },
  { tag: 'PEPE', re: /\b(pepe)\b/i, symbol: 'PEPEUSDT' },
  { tag: 'SHIB', re: /\b(shiba|shib)\b/i, symbol: 'SHIBUSDT' },
  { tag: 'WIF', re: /\b(dogwifhat|wif)\b/i, symbol: 'WIFUSDT' },
  { tag: 'UNI', re: /\b(uniswap|uni)\b/i, symbol: 'UNIUSDT' },
  { tag: 'AAVE', re: /\b(aave)\b/i, symbol: 'AAVEUSDT' },
  { tag: 'RENDER', re: /\b(render|rndr)\b/i, symbol: 'RENDERUSDT' },
  { tag: 'TAO', re: /\b(bittensor|tao)\b/i, symbol: 'TAOUSDT' },
  { tag: 'FIL', re: /\b(filecoin|fil)\b/i, symbol: 'FILUSDT' },

  // Macro / events (no chart symbol)
  { tag: 'FOMC', re: /\b(fomc|federal open market)\b/i },
  { tag: 'CPI', re: /\b(cpi|consumer price index)\b/i },
  { tag: 'ETF', re: /\b(etf|exchange[- ]traded fund)\b/i },
  { tag: 'SEC', re: /\b(sec\b|securities and exchange)\b/i },
  { tag: 'FED', re: /\b(federal reserve|\bfed\b|powell)\b/i },
  {
    tag: 'macro',
    re: /\b(inflation|gdp|treasury|rate cut|rate hike|recession|regulation|macro|interest rate)\b/i,
  },
]

const PRESET_BY_BASE = new Map(
  SYMBOL_PRESETS.map((p) => [p.label.toUpperCase(), p.symbol] as const)
)

/** Extract tags from title (and optional source). Deduped, stable order. */
export function extractAssetTags(title: string, source = ''): string[] {
  const hay = `${title} ${source}`
  const tags: string[] = []
  const seen = new Set<string>()
  for (const rule of ASSET_TAG_RULES) {
    if (rule.re.test(hay) && !seen.has(rule.tag)) {
      seen.add(rule.tag)
      tags.push(rule.tag)
    }
  }
  return tags
}

/** Merge API tags with client-side extraction (client wins on extras). */
export function enrichTags(
  title: string,
  source: string,
  apiTags: string[] | undefined
): string[] {
  const fromApi = Array.isArray(apiTags) ? apiTags : []
  const fromTitle = extractAssetTags(title, source)
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of [...fromTitle, ...fromApi]) {
    const k = t.trim()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(k)
  }
  return out
}

/** Base asset of a pair: BTCUSDT → BTC, 1000PEPEUSDT → PEPE-ish keep full label if needed */
export function baseFromSymbol(symbol: string): string {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (s.endsWith('USDT')) return s.slice(0, -4)
  if (s.endsWith('USD')) return s.slice(0, -3)
  return s
}

/** True if news tags/title relate to the active chart symbol. */
export function matchesActiveSymbol(
  tags: string[],
  title: string,
  activeSymbol: string
): boolean {
  const base = baseFromSymbol(activeSymbol)
  if (!base) return false
  if (tags.some((t) => t.toUpperCase() === base)) return true
  // also match full pair in title
  const re = new RegExp(`\\b${base}\\b`, 'i')
  return re.test(title)
}

/**
 * Resolve a tradable USDT symbol from tags (first asset rule with symbol wins).
 * Macro-only tags return null.
 */
export function symbolFromTags(tags: string[]): string | null {
  for (const t of tags) {
    const rule = ASSET_TAG_RULES.find((r) => r.tag === t && r.symbol)
    if (rule?.symbol) return rule.symbol
    const preset = PRESET_BY_BASE.get(t.toUpperCase())
    if (preset) return preset
  }
  return null
}

export function symbolFromTitle(title: string, tags: string[]): string | null {
  const fromTags = symbolFromTags(tags)
  if (fromTags) return fromTags
  // fallback: scan rules against title only
  for (const rule of ASSET_TAG_RULES) {
    if (rule.symbol && rule.re.test(title)) return rule.symbol
  }
  return null
}
