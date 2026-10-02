/**
 * Native LWC price lines – paper entry/TP/SL + best bid/ask.
 * Uses series.createPriceLine (stays aligned on pan/zoom/resize).
 */

import { useEffect, useRef } from 'react'
import type { IPriceLine, ISeriesApi } from 'lightweight-charts'
import { LineStyle } from 'lightweight-charts'
import { usePaperStore } from '@/trading/paper/paperStore'
import { subscribeOrderBookFeed } from '@/data/shared/orderBookFeed'
import type { ExchangeId } from '@/types'

type CandleSeries = ISeriesApi<'Candlestick'>

export function NativeLwcLines({
  series,
  symbol,
  exchange,
  enabled = true,
}: {
  series: CandleSeries | null
  symbol: string
  exchange: ExchangeId
  enabled?: boolean
}) {
  const positions = usePaperStore((s) => s.positions)
  const linesRef = useRef<IPriceLine[]>([])
  const bidAskRef = useRef<{ bid?: IPriceLine; ask?: IPriceLine }>({})

  useEffect(() => {
    if (!series || !enabled) return
    for (const l of linesRef.current) {
      try {
        series.removePriceLine(l)
      } catch {
        /* */
      }
    }
    linesRef.current = []

    const sym = symbol.toUpperCase()
    for (const p of positions.filter((x) => x.symbol === sym)) {
      const entryColor = p.side === 'long' ? '#0ecb81' : '#f6465d'
      linesRef.current.push(
        series.createPriceLine({
          price: p.entryPrice,
          color: entryColor,
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: p.side === 'long' ? 'LONG' : 'SHORT',
        })
      )
      if (p.takeProfit != null && p.takeProfit > 0) {
        linesRef.current.push(
          series.createPriceLine({
            price: p.takeProfit,
            color: '#f0b90b',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'TP',
          })
        )
      }
      if (p.stopLoss != null && p.stopLoss > 0) {
        linesRef.current.push(
          series.createPriceLine({
            price: p.stopLoss,
            color: '#a855f7',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'SL',
          })
        )
      }
    }

    return () => {
      for (const l of linesRef.current) {
        try {
          series.removePriceLine(l)
        } catch {
          /* */
        }
      }
      linesRef.current = []
    }
  }, [series, positions, symbol, enabled])

  useEffect(() => {
    if (!series || !enabled) return

    const clearBA = () => {
      const { bid, ask } = bidAskRef.current
      try {
        if (bid) series.removePriceLine(bid)
        if (ask) series.removePriceLine(ask)
      } catch {
        /* */
      }
      bidAskRef.current = {}
    }

    const sub = subscribeOrderBookFeed(exchange, symbol, {
      onBook: (snap) => {
        const b = snap.bids[0]?.price
        const a = snap.asks[0]?.price
        if (b == null || a == null || !(b > 0) || !(a > 0)) return
        try {
          if (!bidAskRef.current.bid) {
            bidAskRef.current.bid = series.createPriceLine({
              price: b,
              color: 'rgba(14, 203, 129, 0.55)',
              lineWidth: 1,
              lineStyle: LineStyle.Dotted,
              axisLabelVisible: true,
              title: 'BID',
            })
          } else {
            bidAskRef.current.bid.applyOptions({ price: b })
          }
          if (!bidAskRef.current.ask) {
            bidAskRef.current.ask = series.createPriceLine({
              price: a,
              color: 'rgba(246, 70, 93, 0.55)',
              lineWidth: 1,
              lineStyle: LineStyle.Dotted,
              axisLabelVisible: true,
              title: 'ASK',
            })
          } else {
            bidAskRef.current.ask.applyOptions({ price: a })
          }
        } catch {
          /* series may be detached */
        }
      },
      onError: () => {
        /* keep last lines; no fake data */
      },
    })

    return () => {
      sub.unsubscribe()
      clearBA()
    }
  }, [series, exchange, symbol, enabled])

  return null
}
