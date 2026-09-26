/**
 * Per-panel market data: REST history → live WS with reconnect status.
 * Real data only – never mocks.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Candle, Interval, ConnectionStatus, MarketError, ExchangeId } from '@/types'
import { getExchangeClient } from '@/data/exchanges/registry'

/** Max bars from REST (Binance/KuCoin public limit ≈ 1000). */
const HISTORY_LIMIT = 1000
/** Max bars kept in memory while streaming. */
const LIVE_BUFFER_MAX = 1500

interface PanelMarketState {
  candles: Candle[]
  status: ConnectionStatus
  lastError: MarketError | null
  statusDetail?: string
}

export function usePanelMarket(
  symbol: string,
  interval: Interval,
  exchange: ExchangeId = 'binance'
) {
  const [state, setState] = useState<PanelMarketState>({
    candles: [],
    status: 'disconnected',
    lastError: null,
  })

  const unsubRef = useRef<(() => void) | null>(null)
  const mountedRef = useRef(true)

  const stopLive = useCallback(() => {
    unsubRef.current?.()
    unsubRef.current = null
  }, [])

  const loadAndStart = useCallback(async () => {
    stopLive()
    if (!mountedRef.current) return

    const client = getExchangeClient(exchange)

    setState((s) => ({
      ...s,
      status: 'connecting',
      lastError: null,
      candles: [],
      statusDetail: 'loading history',
    }))

    try {
      const candles = await client.getKlines(symbol, interval, HISTORY_LIMIT)
      if (!mountedRef.current) return

      setState({
        candles,
        status: 'connecting',
        lastError: null,
        statusDetail: 'opening websocket',
      })

      unsubRef.current = client.subscribeKlines(
        symbol,
        interval,
        (candle) => {
          if (!mountedRef.current) return
          setState((prev) => {
            const next = [...prev.candles]
            const last = next[next.length - 1]
            if (last && last.time === candle.time) {
              next[next.length - 1] = candle
            } else if (!last || candle.time > last.time) {
              next.push(candle)
              if (next.length > LIVE_BUFFER_MAX) next.shift()
            }
            return {
              ...prev,
              candles: next,
              status: 'connected',
              lastError: null,
              statusDetail: undefined,
            }
          })
        },
        (err) => {
          if (!mountedRef.current) return
          // Keep last candles visible; show error – never invent data
          setState((s) => ({
            ...s,
            status: 'error',
            lastError: err,
            statusDetail: err.message,
          }))
        },
        (status, detail) => {
          if (!mountedRef.current) return
          setState((s) => ({
            ...s,
            status,
            statusDetail: detail,
            lastError: status === 'error' ? s.lastError : status === 'connected' ? null : s.lastError,
          }))
        }
      )
    } catch (err: any) {
      if (!mountedRef.current) return
      setState({
        candles: [],
        status: 'error',
        lastError: err.code
          ? err
          : {
              code: 'LOAD_HIST',
              message: err.message || 'Failed to load historical data',
              exchange,
              timestamp: Date.now(),
            },
        statusDetail: err.message,
      })
    }
  }, [symbol, interval, exchange, stopLive])

  useEffect(() => {
    mountedRef.current = true
    loadAndStart()
    return () => {
      mountedRef.current = false
      stopLive()
    }
  }, [loadAndStart, stopLive])

  return {
    candles: state.candles,
    status: state.status,
    lastError: state.lastError,
    statusDetail: state.statusDetail,
    reload: loadAndStart,
  }
}
