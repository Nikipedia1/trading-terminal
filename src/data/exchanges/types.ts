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

  /** REST: historical klines – real data only */
  getKlines(symbol: string, interval: Interval, limit?: number): Promise<Candle[]>

  /** REST: current order book snapshot */
  getOrderBook(symbol: string, limit?: number): Promise<OrderBook>

  /** REST: 24h ticker */
  getTicker(symbol: string): Promise<Ticker>

  /**
   * WebSocket: kline stream with auto-reconnect.
   * Returns unsubscribe function (stops reconnect).
   */
  subscribeKlines(
    symbol: string,
    interval: Interval,
    onCandle: (candle: Candle, isFinal: boolean) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void

  /** WebSocket: aggregate / match trades */
  subscribeTrades(
    symbol: string,
    onTrade: (trade: Trade) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void

  /** WebSocket: depth updates */
  subscribeDepth(
    symbol: string,
    onUpdate: (book: OrderBook) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void

  getStatus(): ConnectionStatus
}

/** Documented public API constraints (not enforced client-side). */
export const PUBLIC_API_LIMITS = {
  binance: {
    restWeightPerMinute: 1200,
    klinesMaxLimit: 1000,
    wsMaxStreamsPerConnection: 1024,
    notes: [
      'REST weight budget shared per IP (~1200/min). Heavy multi-panel = risk of 429.',
      'Invalid symbol → HTTP 400; do not invent candles.',
      'WS disconnects are normal; client reconnects with backoff.',
    ],
  },
  binance_futures: {
    restWeightPerMinute: 2400,
    klinesMaxLimit: 1500,
    wsCombinedRecommended: true,
    notes: [
      'USDT-M: fapi.binance.com + fstream.binance.com – public, no key.',
      'forceOrder = liquidations; markPrice includes funding.',
      'openInterest / fundingRate are REST – poll gently (e.g. 15–60s).',
      'Many symbols in one browser share IP weight → 429 possible; surface error, no mocks.',
      'Not institutional proprietary data – public market microstructure only.',
    ],
  },
  kucoin: {
    restPublicSoftLimit: 'exchange-enforced; burst may 429',
    klinesMaxLimit: 1500,
    wsRequiresBulletToken: true,
    notes: [
      'Public WS requires POST /api/v1/bullet-public before connect.',
      'Symbol format is BASE-QUOTE (e.g. BTC-USDT), not BTCUSDT.',
      'Some intervals (3d, 1M) are not supported on KuCoin public candles.',
      'Ping must follow server pingInterval or connection drops.',
    ],
  },
} as const
