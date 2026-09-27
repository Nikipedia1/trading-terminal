import type {
  Candle,
  Trade,
  OrderBook,
  Ticker,
  Interval,
  ConnectionStatus,
  MarketError,
} from '@/types'

export type StatusCallback = (status: ConnectionStatus, detail?: string) => void

export interface ExchangeClient {
  readonly name: string
  getKlines(symbol: string, interval: Interval, limit?: number): Promise<Candle[]>
  getOrderBook(symbol: string, limit?: number): Promise<OrderBook>
  getTicker(symbol: string): Promise<Ticker>
  subscribeKlines(
    symbol: string,
    interval: Interval,
    onCandle: (candle: Candle, isFinal: boolean) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void
  subscribeTrades(
    symbol: string,
    onTrade: (trade: Trade) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void
  subscribeDepth(
    symbol: string,
    onUpdate: (book: OrderBook) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void
  getStatus(): ConnectionStatus
}

export const PUBLIC_API_LIMITS = {
  binance: {
    notes: [
      'REST weight ~1200/min/IP. Multi-panel risk of 429.',
      'Public aggregated L2 – not MBO.',
    ],
  },
  binance_futures: {
    notes: [
      'USDT-M public: mark, funding, OI, forceOrder free.',
      'Multi-symbol shares IP weight.',
    ],
  },
  kucoin: {
    notes: ['Public L2 ≤100 levels/side.', 'Bullet token required for WS.'],
  },
  bybit: {
    notes: ['v5 public spot WS/REST free.', 'Rate limits enforced per IP.'],
  },
  okx: {
    notes: ['v5 public; instId BASE-QUOTE.', 'books5 = top 5 – not full depth.'],
  },
} as const
