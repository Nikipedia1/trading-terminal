/**
 * Liquid crypto instruments – Binance-style USDT symbols.
 * Multi-asset (stocks/ETFs/indices/forex/commodities) via symbolsMultiAsset + Yahoo exchange.
 */

import {
  MULTI_ASSET_PRESETS,
  inferAssetFromSymbol,
  normalizeSymbolInput,
  type AssetClass,
} from './symbolsMultiAsset'

export type { AssetClass } from './symbolsMultiAsset'
export {
  MULTI_ASSET_PRESETS,
  ASSET_CLASS_LABELS,
  inferAssetFromSymbol,
  normalizeSymbolInput,
  getMultiPreset,
} from './symbolsMultiAsset'

export type SymbolGroup =
  | 'Major'
  | 'L1'
  | 'L2'
  | 'DeFi'
  | 'AI'
  | 'Meme'
  | 'Gaming'
  | 'RWA'
  | 'Exchange'
  | 'Payments'
  | 'Infra'
  | 'Other'
  | 'US Tech'
  | 'US Bluechip'
  | 'EU Stocks'
  | 'ETFs'
  | 'Indices'
  | 'Forex Majors'
  | 'Forex Cross'
  | 'Metals'
  | 'Energy'
  | 'Agri'

export interface SymbolPreset {
  symbol: string
  label: string
  group: SymbolGroup
  name?: string
  assetClass?: AssetClass
  preferredExchange?: 'binance' | 'binance_futures' | 'yahoo'
}

export const SYMBOL_GROUPS: SymbolGroup[] = [
  'Major',
  'L1',
  'L2',
  'DeFi',
  'AI',
  'Meme',
  'Gaming',
  'RWA',
  'Exchange',
  'Payments',
  'Infra',
  'Other',
  'US Tech',
  'US Bluechip',
  'EU Stocks',
  'ETFs',
  'Indices',
  'Forex Majors',
  'Forex Cross',
  'Metals',
  'Energy',
  'Agri',
]

const CRYPTO_PRESETS: SymbolPreset[] = [
  { symbol: 'BTCUSDT', label: 'BTC', group: 'Major', name: 'Bitcoin', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'ETHUSDT', label: 'ETH', group: 'Major', name: 'Ethereum', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'BNBUSDT', label: 'BNB', group: 'Major', name: 'BNB', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'SOLUSDT', label: 'SOL', group: 'Major', name: 'Solana', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'XRPUSDT', label: 'XRP', group: 'Major', name: 'XRP', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'ADAUSDT', label: 'ADA', group: 'Major', name: 'Cardano', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'DOGEUSDT', label: 'DOGE', group: 'Major', name: 'Dogecoin', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'AVAXUSDT', label: 'AVAX', group: 'Major', name: 'Avalanche', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'DOTUSDT', label: 'DOT', group: 'Major', name: 'Polkadot', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'LINKUSDT', label: 'LINK', group: 'Major', name: 'Chainlink', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'TRXUSDT', label: 'TRX', group: 'Major', name: 'TRON', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'TONUSDT', label: 'TON', group: 'Major', name: 'Toncoin', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'LTCUSDT', label: 'LTC', group: 'Major', name: 'Litecoin', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'BCHUSDT', label: 'BCH', group: 'Major', name: 'Bitcoin Cash', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'ATOMUSDT', label: 'ATOM', group: 'Major', name: 'Cosmos', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'NEARUSDT', label: 'NEAR', group: 'Major', name: 'NEAR', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'APTUSDT', label: 'APT', group: 'L1', name: 'Aptos', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'SUIUSDT', label: 'SUI', group: 'L1', name: 'Sui', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'ARBUSDT', label: 'ARB', group: 'L2', name: 'Arbitrum', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'OPUSDT', label: 'OP', group: 'L2', name: 'Optimism', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'UNIUSDT', label: 'UNI', group: 'DeFi', name: 'Uniswap', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'AAVEUSDT', label: 'AAVE', group: 'DeFi', name: 'Aave', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'PEPEUSDT', label: 'PEPE', group: 'Meme', name: 'Pepe', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'SHIBUSDT', label: 'SHIB', group: 'Meme', name: 'Shiba Inu', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'WIFUSDT', label: 'WIF', group: 'Meme', name: 'dogwifhat', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'TAOUSDT', label: 'TAO', group: 'AI', name: 'Bittensor', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'FETUSDT', label: 'FET', group: 'AI', name: 'Fetch.ai', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'ONDOUSDT', label: 'ONDO', group: 'RWA', name: 'Ondo', assetClass: 'crypto', preferredExchange: 'binance' },
  { symbol: 'FILUSDT', label: 'FIL', group: 'Infra', name: 'Filecoin', assetClass: 'crypto', preferredExchange: 'binance' },
]

export const SYMBOL_PRESETS: SymbolPreset[] = [
  ...CRYPTO_PRESETS,
  ...MULTI_ASSET_PRESETS.map((p) => ({
    symbol: p.symbol,
    label: p.label,
    group: p.group as SymbolGroup,
    name: p.name,
    assetClass: p.assetClass,
    preferredExchange: p.preferredExchange,
  })),
]

export function uniquePresets(): SymbolPreset[] {
  const seen = new Set<string>()
  const out: SymbolPreset[] = []
  for (const p of SYMBOL_PRESETS) {
    const k = p.symbol.toUpperCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(p)
  }
  return out
}

export function presetsByGroup(group: SymbolGroup): SymbolPreset[] {
  return uniquePresets().filter((p) => p.group === group)
}

export function searchPresets(query: string, assetClass?: AssetClass | 'all'): SymbolPreset[] {
  const q = query.trim().toLowerCase()
  let list = uniquePresets()
  if (assetClass && assetClass !== 'all') {
    list = list.filter((p) => (p.assetClass ?? 'crypto') === assetClass)
  }
  if (!q) return list
  return list.filter(
    (p) =>
      p.symbol.toLowerCase().includes(q) ||
      p.label.toLowerCase().includes(q) ||
      (p.name?.toLowerCase().includes(q) ?? false) ||
      p.group.toLowerCase().includes(q)
  )
}

export function getPreset(symbol: string): SymbolPreset | undefined {
  const s = symbol.trim().toUpperCase()
  return uniquePresets().find((p) => p.symbol.toUpperCase() === s)
}

export const ALL_INTERVALS = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
] as const

// silence unused if tree-shaken oddly
void inferAssetFromSymbol
void normalizeSymbolInput
