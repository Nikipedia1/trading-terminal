/**
 * Shared microstructure data layer – entry point for future deep-analysis modules.
 *
 * Usage:
 *   const sub = subscribeTradeFeed('binance', 'BTCUSDT', { onTrade: ... })
 *   const book = subscribeOrderBookFeed('binance', 'BTCUSDT', { onBook: ... })
 *   // later: sub.unsubscribe(); book.unsubscribe()
 */

export { EventBus } from './eventBus'
export { subscribeTradeFeed, activeTradeFeedKeys } from './tradeFeed'
export type { TradeFeedSubscription } from './tradeFeed'
export { subscribeOrderBookFeed, activeOrderBookFeedKeys } from './orderBookFeed'
export type { OrderBookFeedSubscription } from './orderBookFeed'
export type {
  AggressorTrade,
  AggressorSide,
  BookLevel,
  LocalOrderBook,
  OrderBookSnapshot,
  FeedStatus,
  FeedStatusEvent,
  FeedErrorEvent,
} from './types'
export { feedKey, aggressorFromBuyerMaker } from './types'
