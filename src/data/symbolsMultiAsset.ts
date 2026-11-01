/**
 * Multi-asset (non-crypto) presets + helpers.
 * Imported by symbols.ts so ChartPanel can resolve Yahoo tickers.
 */

export type AssetClass =
  | 'crypto'
  | 'stock'
  | 'etf'
  | 'index'
  | 'forex'
  | 'commodity'

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  crypto: 'Crypto',
  stock: 'Stocks',
  etf: 'ETFs',
  index: 'Indices',
  forex: 'Forex',
  commodity: 'Commodities',
}

export interface MultiAssetPreset {
  symbol: string
  label: string
  group: string
  name?: string
  assetClass: AssetClass
  preferredExchange: 'yahoo'
}

export const MULTI_ASSET_PRESETS: MultiAssetPreset[] = [
  { symbol: 'AAPL', label: 'AAPL', group: 'US Tech', name: 'Apple', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'MSFT', label: 'MSFT', group: 'US Tech', name: 'Microsoft', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'NVDA', label: 'NVDA', group: 'US Tech', name: 'NVIDIA', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'GOOGL', label: 'GOOGL', group: 'US Tech', name: 'Alphabet', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'AMZN', label: 'AMZN', group: 'US Tech', name: 'Amazon', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'META', label: 'META', group: 'US Tech', name: 'Meta Platforms', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'TSLA', label: 'TSLA', group: 'US Tech', name: 'Tesla', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'AMD', label: 'AMD', group: 'US Tech', name: 'AMD', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'AVGO', label: 'AVGO', group: 'US Tech', name: 'Broadcom', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'ORCL', label: 'ORCL', group: 'US Tech', name: 'Oracle', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'CRM', label: 'CRM', group: 'US Tech', name: 'Salesforce', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'NFLX', label: 'NFLX', group: 'US Tech', name: 'Netflix', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'INTC', label: 'INTC', group: 'US Tech', name: 'Intel', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'PLTR', label: 'PLTR', group: 'US Tech', name: 'Palantir', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'COIN', label: 'COIN', group: 'US Tech', name: 'Coinbase', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'MSTR', label: 'MSTR', group: 'US Tech', name: 'MicroStrategy', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'JPM', label: 'JPM', group: 'US Bluechip', name: 'JPMorgan', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'BAC', label: 'BAC', group: 'US Bluechip', name: 'Bank of America', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'GS', label: 'GS', group: 'US Bluechip', name: 'Goldman Sachs', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'V', label: 'V', group: 'US Bluechip', name: 'Visa', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'MA', label: 'MA', group: 'US Bluechip', name: 'Mastercard', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'WMT', label: 'WMT', group: 'US Bluechip', name: 'Walmart', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'XOM', label: 'XOM', group: 'US Bluechip', name: 'Exxon Mobil', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'JNJ', label: 'JNJ', group: 'US Bluechip', name: 'Johnson & Johnson', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'BRK-B', label: 'BRK.B', group: 'US Bluechip', name: 'Berkshire Hathaway B', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'SAP.DE', label: 'SAP', group: 'EU Stocks', name: 'SAP', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'ASML.AS', label: 'ASML', group: 'EU Stocks', name: 'ASML', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'MC.PA', label: 'MC', group: 'EU Stocks', name: 'LVMH', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'AIR.PA', label: 'AIR', group: 'EU Stocks', name: 'Airbus', assetClass: 'stock', preferredExchange: 'yahoo' },
  { symbol: 'SPY', label: 'SPY', group: 'ETFs', name: 'SPDR S&P 500', assetClass: 'etf', preferredExchange: 'yahoo' },
  { symbol: 'QQQ', label: 'QQQ', group: 'ETFs', name: 'Invesco QQQ', assetClass: 'etf', preferredExchange: 'yahoo' },
  { symbol: 'IWM', label: 'IWM', group: 'ETFs', name: 'iShares Russell 2000', assetClass: 'etf', preferredExchange: 'yahoo' },
  { symbol: 'GLD', label: 'GLD', group: 'ETFs', name: 'SPDR Gold', assetClass: 'etf', preferredExchange: 'yahoo' },
  { symbol: 'SLV', label: 'SLV', group: 'ETFs', name: 'iShares Silver', assetClass: 'etf', preferredExchange: 'yahoo' },
  { symbol: 'TLT', label: 'TLT', group: 'ETFs', name: 'iShares 20+Y Treasury', assetClass: 'etf', preferredExchange: 'yahoo' },
  { symbol: 'HYG', label: 'HYG', group: 'ETFs', name: 'iShares High Yield Corp', assetClass: 'etf', preferredExchange: 'yahoo' },
  { symbol: 'IBIT', label: 'IBIT', group: 'ETFs', name: 'iShares Bitcoin Trust', assetClass: 'etf', preferredExchange: 'yahoo' },
  { symbol: 'BITO', label: 'BITO', group: 'ETFs', name: 'ProShares Bitcoin Strategy', assetClass: 'etf', preferredExchange: 'yahoo' },
  { symbol: '^GSPC', label: 'SPX', group: 'Indices', name: 'S&P 500', assetClass: 'index', preferredExchange: 'yahoo' },
  { symbol: '^DJI', label: 'DJI', group: 'Indices', name: 'Dow Jones', assetClass: 'index', preferredExchange: 'yahoo' },
  { symbol: '^IXIC', label: 'IXIC', group: 'Indices', name: 'NASDAQ Composite', assetClass: 'index', preferredExchange: 'yahoo' },
  { symbol: '^NDX', label: 'NDX', group: 'Indices', name: 'NASDAQ 100', assetClass: 'index', preferredExchange: 'yahoo' },
  { symbol: '^VIX', label: 'VIX', group: 'Indices', name: 'CBOE Volatility', assetClass: 'index', preferredExchange: 'yahoo' },
  { symbol: '^GDAXI', label: 'DAX', group: 'Indices', name: 'DAX', assetClass: 'index', preferredExchange: 'yahoo' },
  { symbol: '^FTSE', label: 'FTSE', group: 'Indices', name: 'FTSE 100', assetClass: 'index', preferredExchange: 'yahoo' },
  { symbol: '^N225', label: 'N225', group: 'Indices', name: 'Nikkei 225', assetClass: 'index', preferredExchange: 'yahoo' },
  { symbol: 'EURUSD=X', label: 'EURUSD', group: 'Forex Majors', name: 'Euro / US Dollar', assetClass: 'forex', preferredExchange: 'yahoo' },
  { symbol: 'GBPUSD=X', label: 'GBPUSD', group: 'Forex Majors', name: 'Pound / US Dollar', assetClass: 'forex', preferredExchange: 'yahoo' },
  { symbol: 'USDJPY=X', label: 'USDJPY', group: 'Forex Majors', name: 'US Dollar / Yen', assetClass: 'forex', preferredExchange: 'yahoo' },
  { symbol: 'USDCHF=X', label: 'USDCHF', group: 'Forex Majors', name: 'US Dollar / Franc', assetClass: 'forex', preferredExchange: 'yahoo' },
  { symbol: 'AUDUSD=X', label: 'AUDUSD', group: 'Forex Majors', name: 'Aussie / US Dollar', assetClass: 'forex', preferredExchange: 'yahoo' },
  { symbol: 'USDCAD=X', label: 'USDCAD', group: 'Forex Majors', name: 'US Dollar / Cad', assetClass: 'forex', preferredExchange: 'yahoo' },
  { symbol: 'EURGBP=X', label: 'EURGBP', group: 'Forex Cross', name: 'Euro / Pound', assetClass: 'forex', preferredExchange: 'yahoo' },
  { symbol: 'EURJPY=X', label: 'EURJPY', group: 'Forex Cross', name: 'Euro / Yen', assetClass: 'forex', preferredExchange: 'yahoo' },
  { symbol: 'GC=F', label: 'GOLD', group: 'Metals', name: 'Gold Futures', assetClass: 'commodity', preferredExchange: 'yahoo' },
  { symbol: 'SI=F', label: 'SILVER', group: 'Metals', name: 'Silver Futures', assetClass: 'commodity', preferredExchange: 'yahoo' },
  { symbol: 'CL=F', label: 'WTI', group: 'Energy', name: 'Crude Oil WTI', assetClass: 'commodity', preferredExchange: 'yahoo' },
  { symbol: 'BZ=F', label: 'BRENT', group: 'Energy', name: 'Brent Crude', assetClass: 'commodity', preferredExchange: 'yahoo' },
  { symbol: 'NG=F', label: 'NATGAS', group: 'Energy', name: 'Natural Gas', assetClass: 'commodity', preferredExchange: 'yahoo' },
  { symbol: 'ZC=F', label: 'CORN', group: 'Agri', name: 'Corn Futures', assetClass: 'commodity', preferredExchange: 'yahoo' },
  { symbol: 'HG=F', label: 'COPPER', group: 'Metals', name: 'Copper Futures', assetClass: 'commodity', preferredExchange: 'yahoo' },
  { symbol: 'BTC-USD', label: 'BTC-USD', group: 'Major', name: 'Bitcoin (Yahoo)', assetClass: 'crypto', preferredExchange: 'yahoo' },
  { symbol: 'ETH-USD', label: 'ETH-USD', group: 'Major', name: 'Ethereum (Yahoo)', assetClass: 'crypto', preferredExchange: 'yahoo' },
]

export function getMultiPreset(symbol: string): MultiAssetPreset | undefined {
  const s = symbol.trim().toUpperCase()
  return MULTI_ASSET_PRESETS.find((p) => p.symbol.toUpperCase() === s)
}

export function inferAssetFromSymbol(raw: string): {
  assetClass: AssetClass
  preferredExchange: 'binance' | 'binance_futures' | 'yahoo'
} {
  const s = raw.trim()
  const u = s.toUpperCase()
  const multi = getMultiPreset(s) ?? getMultiPreset(u)
  if (multi) {
    return { assetClass: multi.assetClass, preferredExchange: multi.preferredExchange }
  }
  if (u.endsWith('USDT') || u.endsWith('USDC') || u.endsWith('BUSD')) {
    return { assetClass: 'crypto', preferredExchange: 'binance' }
  }
  if (u.includes('=X')) return { assetClass: 'forex', preferredExchange: 'yahoo' }
  if (u.includes('=F')) return { assetClass: 'commodity', preferredExchange: 'yahoo' }
  if (u.startsWith('^')) return { assetClass: 'index', preferredExchange: 'yahoo' }
  if (u.includes('-USD')) return { assetClass: 'crypto', preferredExchange: 'yahoo' }
  if (/^[A-Z][A-Z0-9.-]{0,11}$/.test(u) && !u.endsWith('USDT')) {
    return { assetClass: 'stock', preferredExchange: 'yahoo' }
  }
  return { assetClass: 'crypto', preferredExchange: 'binance' }
}

export function normalizeSymbolInput(raw: string, exchange?: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (exchange === 'yahoo' || inferAssetFromSymbol(t).preferredExchange === 'yahoo') {
    return t.toUpperCase().replace(/\s+/g, '')
  }
  return t.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
