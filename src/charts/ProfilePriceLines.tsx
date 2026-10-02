/**
 * Native LWC lines for POC / VAH / VAL when volume profile model is available.
 */

import { useEffect, useRef } from 'react'
import type { IPriceLine, ISeriesApi } from 'lightweight-charts'
import { LineStyle } from 'lightweight-charts'

export function ProfilePriceLines({
  series,
  poc,
  vah,
  val,
  enabled,
}: {
  series: ISeriesApi<'Candlestick'> | null
  poc: number | null
  vah: number | null
  val: number | null
  enabled: boolean
}) {
  const linesRef = useRef<IPriceLine[]>([])

  useEffect(() => {
    if (!series || !enabled) {
      for (const l of linesRef.current) {
        try {
          series?.removePriceLine(l)
        } catch {
          /* */
        }
      }
      linesRef.current = []
      return
    }

    for (const l of linesRef.current) {
      try {
        series.removePriceLine(l)
      } catch {
        /* */
      }
    }
    linesRef.current = []

    const add = (
      price: number | null,
      title: string,
      color: string,
      width: 1 | 2
    ) => {
      if (price == null || !(price > 0)) return
      linesRef.current.push(
        series.createPriceLine({
          price,
          color,
          lineWidth: width,
          lineStyle: title === 'POC' ? LineStyle.Solid : LineStyle.Dashed,
          axisLabelVisible: true,
          title,
        })
      )
    }

    add(poc, 'POC', '#f0b90b', 2)
    add(vah, 'VAH', '#60a5fa', 1)
    add(val, 'VAL', '#60a5fa', 1)

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
  }, [series, poc, vah, val, enabled])

  return null
}
