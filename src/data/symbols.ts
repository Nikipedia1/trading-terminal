/**
 * Popular spot symbols (USDT) – real pairs on Binance / KuCoin.
 * User can still type any valid symbol in the input.
 */

export interface SymbolPreset {
  symbol: string
  label: string
  group: 'Major' | 'L1' | 'DeFi' | 'Meme' | 'Other'
}

/** Binance-style symbols (no dash). KuCoin client normalizes to BASE-QUOTE. */
export const SYMBOL_PRESETS: SymbolPreset[] = [
  // Major
  { symbol: 'BTCUSDT', label: 'BTC', group: 'Major' },
  { symbol: 'ETHUSDT', label: 'ETH', group: 'Major' },
  { symbol: 'BNBUSDT', label: 'BNB', group: 'Major' },
  { symbol: 'SOLUSDT', label: 'SOL', group: 'Major' },
  { symbol: 'XRPUSDT', label: 'XRP', group: 'Major' },
  { symbol: 'ADAUSDT', label: 'ADA', group: 'Major' },
  { symbol: 'DOGEUSDT', label: 'DOGE', group: 'Major' },
  { symbol: 'AVAXUSDT', label: 'AVAX', group: 'Major' },
  { symbol: 'DOTUSDT', label: 'DOT', group: 'Major' },
  { symbol: 'LINKUSDT', label: 'LINK', group: 'Major' },
  // L1 / ecosystem
  { symbol: 'MATICUSDT', label: 'MATIC', group: 'L1' },
  { symbol: 'NEARUSDT', label: 'NEAR', group: 'L1' },
  { symbol: 'ATOMUSDT', label: 'ATOM', group: 'L1' },
  { symbol: 'APTUSDT', label: 'APT', group: 'L1' },
  { symbol: 'SUIUSDT', label: 'SUI', group: 'L1' },
  { symbol: 'SEIUSDT', label: 'SEI', group: 'L1' },
  { symbol: 'INJUSDT', label: 'INJ', group: 'L1' },
  { symbol: 'TIAUSDT', label: 'TIA', group: 'L1' },
  { symbol: 'OPUSDT', label: 'OP', group: 'L1' },
  { symbol: 'ARBUSDT', label: 'ARB', group: 'L1' },
  // DeFi
  { symbol: 'UNIUSDT', label: 'UNI', group: 'DeFi' },
  { symbol: 'AAVEUSDT', label: 'AAVE', group: 'DeFi' },
  { symbol: 'MKRUSDT', label: 'MKR', group: 'DeFi' },
  { symbol: 'LDOUSDT', label: 'LDO', group: 'DeFi' },
  { symbol: 'CRVUSDT', label: 'CRV', group: 'DeFi' },
  { symbol: 'PENDLEUSDT', label: 'PENDLE', group: 'DeFi' },
  // Meme / high vol
  { symbol: 'PEPEUSDT', label: 'PEPE', group: 'Meme' },
  { symbol: 'WIFUSDT', label: 'WIF', group: 'Meme' },
  { symbol: 'BONKUSDT', label: 'BONK', group: 'Meme' },
  { symbol: 'FLOKIUSDT', label: 'FLOKI', group: 'Meme' },
  // Other liquid
  { symbol: 'LTCUSDT', label: 'LTC', group: 'Other' },
  { symbol: 'BCHUSDT', label: 'BCH', group: 'Other' },
  { symbol: 'TRXUSDT', label: 'TRX', group: 'Other' },
  { symbol: 'TONUSDT', label: 'TON', group: 'Other' },
  { symbol: 'SHIBUSDT', label: 'SHIB', group: 'Other' },
  { symbol: 'FILUSDT', label: 'FIL', group: 'Other' },
  { symbol: 'RENDERUSDT', label: 'RENDER', group: 'Other' },
  { symbol: 'FETUSDT', label: 'FET', group: 'Other' },
  { symbol: 'TAOUSDT', label: 'TAO', group: 'Other' },
  { symbol: 'WLDUSDT', label: 'WLD', group: 'Other' },
]

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
