/**
 * Per-panel market data: REST history (paginated beyond 1000) → live WS.
 * Real data only – never mocks.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Candle, Interval, ConnectionStatus, MarketError, ExchangeId } from '@/types'
import { getExchangeClient } from '@/data/exchanges/registry'
import {
  PAGE_LIMIT,
  MAX_BARS_IN_MEMORY,
  mergeCandlesOlder,
  appendLiveCandle,
  fetchKlinesPage,
} from '@/data/klines/history'

interface PanelMarketState {
  candles: Candle[]
  status: ConnectionStatus
  lastError: MarketError | null
  statusDetail?: string
  /** True while a deeper-history page is in flight */
  loadingMore: boolean
  /** False when exchange returned a short page (no older data) */
  hasMoreHistory: boolean
}

export function usePanelMarket(
  symbol: string,
  interval: Interval,
  exchange: ExchangeId = 'binance'
) {
  const instrumentKey = `${exchange}|${symbol.toUpperCase()}|${interval}`

  const [state, setState] = useState<PanelMarketState>({
    candles: [],
    status: 'disconnected',
    lastError: null,
    loadingMore: false,
    hasMoreHistory: true,
  })

  // Clear stale candles in the same render as the instrument change
  const [seenKey, setSeenKey] = useState(instrumentKey)
  if (seenKey !== instrumentKey) {
    setSeenKey(instrumentKey)
    setState({
      candles: [],
      status: 'connecting',
      lastError: null,
      statusDetail: `loading ${symbol.toUpperCase()}`,
      loadingMore: false,
      hasMoreHistory: true,
    })
  }

  const unsubRef = useRef<(() => void) | null>(null)
  const mountedRef = useRef(true)
  const genRef = useRef(0)
  const loadingMoreRef = useRef(false)
  const hasMoreRef = useRef(true)
  const candlesRef = useRef<Candle[]>([])
  candlesRef.current = state.candles
  hasMoreRef.current = state.hasMoreHistory

  const stopLive = useCallback(() => {
    unsubRef.current?.()
    unsubRef.current = null
  }, [])

  const loadAndStart = useCallback(async () => {
    stopLive()
    if (!mountedRef.current) return

    const gen = ++genRef.current
    const client = getExchangeClient(exchange)
    const sym = symbol.toUpperCase()
    const pageSize = PAGE_LIMIT[exchange] ?? 1000
    loadingMoreRef.current = false
    hasMoreRef.current = true

    setState({
      candles: [],
      status: 'connecting',
      lastError: null,
      statusDetail: `loading ${sym}`,
      loadingMore: false,
      hasMoreHistory: true,
    })

    try {
      const candles = await fetchKlinesPage(client, sym, interval, { limit: pageSize })
      if (!mountedRef.current || gen !== genRef.current) return

      hasMoreRef.current = candles.length >= pageSize
      setState({
        candles,
        status: 'connecting',
        lastError: null,
        statusDetail: 'opening websocket',
        loadingMore: false,
        hasMoreHistory: candles.length >= pageSize,
      })

      unsubRef.current = client.subscribeKlines(
        sym,
        interval,
        (candle) => {
          if (!mountedRef.current || gen !== genRef.current) return
          setState((prev) => ({
            ...prev,
            candles: appendLiveCandle(prev.candles, candle),
            status: 'connected',
            lastError: null,
            statusDetail: undefined,
          }))
        },
        (err) => {
          if (!mountedRef.current || gen !== genRef.current) return
          setState((s) => ({
            ...s,
            status: 'error',
            lastError: err,
            statusDetail: err.message,
          }))
        },
        (status, detail) => {
          if (!mountedRef.current || gen !== genRef.current) return
          setState((s) => ({
            ...s,
            status,
            statusDetail: detail,
            lastError:
              status === 'error'
                ? s.lastError
                : status === 'connected'
                  ? null
                  : s.lastError,
          }))
        }
      )
    } catch (err: any) {
      if (!mountedRef.current || gen !== genRef.current) return
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
        loadingMore: false,
        hasMoreHistory: false,
      })
    }
  }, [symbol, interval, exchange, stopLive])

  /**
   * Load one older page (before current oldest bar). Safe to call from scroll handler.
   * Returns number of bars prepended (0 if none / busy / exhausted).
   */
  const loadMoreHistory = useCallback(async (): Promise<number> => {
    if (!mountedRef.current) return 0
    if (loadingMoreRef.current || !hasMoreRef.current) return 0
    const current = candlesRef.current
    if (current.length === 0) return 0
    if (current.length >= MAX_BARS_IN_MEMORY) {
      hasMoreRef.current = false
      setState((s) => ({ ...s, hasMoreHistory: false }))
      return 0
    }

    const oldest = current[0]
    if (!oldest) return 0

    loadingMoreRef.current = true
    setState((s) => ({ ...s, loadingMore: true, statusDetail: 'loading older history' }))

    const gen = genRef.current
    const client = getExchangeClient(exchange)
    const sym = symbol.toUpperCase()
    const pageSize = PAGE_LIMIT[exchange] ?? 1000

    try {
      const older = await fetchKlinesPage(client, sym, interval, {
        limit: pageSize,
        beforeTimeSec: oldest.time,
      })
      if (!mountedRef.current || gen !== genRef.current) {
        loadingMoreRef.current = false
        return 0
      }

      // Drop any bar >= oldest (safety against inclusive endTime)
      const strictlyOlder = older.filter((c) => c.time < oldest.time)
      if (strictlyOlder.length === 0) {
        hasMoreRef.current = false
        loadingMoreRef.current = false
        setState((s) => ({
          ...s,
          loadingMore: false,
          hasMoreHistory: false,
          statusDetail: undefined,
        }))
        return 0
      }

      const beforeLen = current.length
      const merged = mergeCandlesOlder(current, strictlyOlder)
      const added = merged.length - beforeLen
      const stillMore = strictlyOlder.length >= pageSize * 0.9

      hasMoreRef.current = stillMore
      loadingMoreRef.current = false
      setState((s) => ({
        ...s,
        candles: merged,
        loadingMore: false,
        hasMoreHistory: stillMore,
        statusDetail: undefined,
      }))
      return Math.max(0, added)
    } catch (err: any) {
      loadingMoreRef.current = false
      if (!mountedRef.current || gen !== genRef.current) return 0
      setState((s) => ({
        ...s,
        loadingMore: false,
        statusDetail: err?.message || 'history page failed',
        lastError: err?.code
          ? err
          : {
              code: 'LOAD_MORE_HIST',
              message: err?.message || 'Failed to load older history',
              exchange,
              timestamp: Date.now(),
            },
      }))
      return 0
    }
  }, [symbol, interval, exchange])

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
    loadingMore: state.loadingMore,
    hasMoreHistory: state.hasMoreHistory,
    loadMoreHistory,
    reload: loadAndStart,
  }
}
