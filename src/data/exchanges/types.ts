import type { Candle, Trade, OrderBook, Ticker, Interval, ConnectionStatus, MarketError } from '@/types'

export interface ExchangeClient {
  readonly name: string

  /** REST: historical klines */
  getKlines(symbol: string, interval: Interval, limit?: number): Promise<Candle[]>

  /** REST: current order book snapshot */
  getOrderBook(symbol: string, limit?: number): Promise<OrderBook>

  /** REST: 24h ticker */
  getTicker(symbol: string): Promise<Ticker>

  /** WebSocket: subscribe to kline stream */
  subscribeKlines(
    symbol: string,
    interval: Interval,
    onCandle: (candle: Candle, isFinal: boolean) => void,
    onError: (err: MarketError) => void
  ): () => void

  /** WebSocket: subscribe to aggregate trades */
  subscribeTrades(
    symbol: string,
    onTrade: (trade: Trade) => void,
    onError: (err: MarketError) => void
  ): () => void

  /** WebSocket: subscribe to depth updates */
  subscribeDepth(
    symbol: string,
    onUpdate: (book: OrderBook) => void,
    onError: (err: MarketError) => void
  ): () => void

  getStatus(): ConnectionStatus
}
