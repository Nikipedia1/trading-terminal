/**
 * Per-panel market data hook.
 * Each ChartPanel owns independent symbol/interval subscriptions.
 * Real data only – reuses binanceClient, never mocks.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Candle, Interval, ConnectionStatus, MarketError, ExchangeId } from '@/types'
import { binanceClient } from '@/data/exchanges/binance'

interface PanelMarketState {
  candles: Candle[]
  status: ConnectionStatus
  lastError: MarketError | null
}

export function usePanelMarket(
  symbol: string,
  interval: Interval,
  _exchange: ExchangeId = 'binance'
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

    setState((s) => ({ ...s, status: 'connecting', lastError: null, candles: [] }))

    try {
      const candles = await binanceClient.getKlines(symbol, interval, 300)
      if (!mountedRef.current) return

      setState({ candles, status: 'connected', lastError: null })

      unsubRef.current = binanceClient.subscribeKlines(
        symbol,
        interval,
        (candle) => {
          if (!mountedRef.current) return
          setState((prev) => {
            const candles = [...prev.candles]
            const last = candles[candles.length - 1]
            if (last && last.time === candle.time) {
              candles[candles.length - 1] = candle
            } else if (!last || candle.time > last.time) {
              candles.push(candle)
              if (candles.length > 500) candles.shift()
            }
            return { ...prev, candles, status: 'connected' }
          })
        },
        (err) => {
          if (!mountedRef.current) return
          setState((s) => ({ ...s, status: 'error', lastError: err }))
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
              exchange: 'binance',
              timestamp: Date.now(),
            },
      })
    }
  }, [symbol, interval, stopLive])

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
    reload: loadAndStart,
  }
}
