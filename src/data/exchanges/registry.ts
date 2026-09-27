/**
 * Exchange registry – resolve ExchangeClient by id.
 */

import type { ExchangeId } from '@/types'
import type { ExchangeClient } from './types'
import { binanceClient } from './binance'
import { binanceFuturesClient } from './binanceFutures'
import { kucoinClient } from './kucoin'

const CLIENTS: Record<ExchangeId, ExchangeClient> = {
  binance: binanceClient,
  binance_futures: binanceFuturesClient,
  kucoin: kucoinClient,
}

export function getExchangeClient(exchange: ExchangeId): ExchangeClient {
  const client = CLIENTS[exchange]
  if (!client) {
    throw new Error(`No exchange client registered for "${exchange}"`)
  }
  return client
}

export const SUPPORTED_EXCHANGES: ExchangeId[] = [
  'binance',
  'binance_futures',
  'kucoin',
]

export const EXCHANGE_LABELS: Record<ExchangeId, string> = {
  binance: 'Binance Spot',
  binance_futures: 'Binance Futures',
  kucoin: 'KuCoin',
}
