/**
 * Exchange registry – free public venues only.
 */

import type { ExchangeId } from '@/types'
import type { ExchangeClient } from './types'
import { binanceClient } from './binance'
import { binanceFuturesClient } from './binanceFutures'
import { kucoinClient } from './kucoin'
import { bybitClient } from './bybit'
import { okxClient } from './okx'

const CLIENTS: Record<ExchangeId, ExchangeClient> = {
  binance: binanceClient,
  binance_futures: binanceFuturesClient,
  kucoin: kucoinClient,
  bybit: bybitClient,
  okx: okxClient,
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
  'bybit',
  'okx',
]

export const EXCHANGE_LABELS: Record<ExchangeId, string> = {
  binance: 'Binance Spot',
  binance_futures: 'Binance Futures',
  kucoin: 'KuCoin',
  bybit: 'Bybit',
  okx: 'OKX',
}
