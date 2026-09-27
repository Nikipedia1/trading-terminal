/**
 * Shared microstructure data layer – entry point for analysis modules.
 */

export { EventBus } from './eventBus'
export { subscribeTradeFeed, activeTradeFeedKeys } from './tradeFeed'
export type { TradeFeedSubscription } from './tradeFeed'
export { subscribeOrderBookFeed, activeOrderBookFeedKeys } from './orderBookFeed'
export type { OrderBookFeedSubscription } from './orderBookFeed'
export {
  subscribeFuturesMetrics,
  activeFuturesMetricsKeys,
} from './futuresMetricsFeed'
export type { FuturesMetricsSubscription } from './futuresMetricsFeed'
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
