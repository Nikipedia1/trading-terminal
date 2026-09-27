/** Shared microstructure data layer */

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
export {
  getFeedHealth,
  getAllFeedHealth,
  subscribeFeedHealth,
  recordEventLatency,
  recordTick,
  recordBookUpdate,
  recordGap,
  recordResync,
  recordReconnect,
  recordFeedStatus,
  recordFeedError,
  clearFeedErrors,
  FEED_HEALTH_NOTES,
} from './feedHealth'
export type { FeedHealthSnapshot, FeedErrorEntry } from './feedHealth'
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
