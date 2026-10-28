/** Smart candle data application that preserves chart pan/zoom. */
import type { Candle } from '@/types'
import type { SeriesManager } from './series-manager'
import type { CoordinateBridge } from './coordinate-bridge'
import type { IChartApi } from 'lightweight-charts'

export type CandlesSig = { len: number; first: number | null; last: number | null }

export function applyCandlesPreservingViewport(opts: {
  mgr: SeriesManager
  chart: IChartApi | null
  bridge: CoordinateBridge | null | undefined
  candles: Candle[] | null | undefined
  prev: CandlesSig
}): CandlesSig {
  const list = opts.candles ?? []
  const len = list.length
  const first = len ? list[0]!.time : null
  const last = len ? list[len - 1]!.time : null
  const prev = opts.prev
  const mgr = opts.mgr
  const chart = opts.chart
  const ts = chart?.timeScale()
  const savedLr = ts?.getVisibleLogicalRange() ?? null

  const prepended =
    prev.len > 0 &&
    len > prev.len &&
    first != null &&
    prev.first != null &&
    first < prev.first &&
    last === prev.last

  const appendedOne =
    prev.len > 0 &&
    len === prev.len + 1 &&
    first === prev.first &&
    last != null &&
    prev.last != null &&
    last > prev.last

  const sameBars =
    prev.len > 0 &&
    len === prev.len &&
    first === prev.first &&
    last === prev.last

  if (len === 0) {
    mgr.setCandles([])
  } else if (prepended) {
    mgr.setCandles(list)
    if (ts && savedLr) {
      const added = len - prev.len
      try {
        ts.setVisibleLogicalRange({ from: savedLr.from + added, to: savedLr.to + added })
      } catch {
        /* */
      }
    }
  } else if (appendedOne || sameBars) {
    mgr.updateCandle(list[len - 1]!)
  } else if (prev.len === 0 && len > 0) {
    mgr.setCandles(list)
    try {
      mgr.resetViewForSymbolChange()
    } catch {
      /* */
    }
  } else {
    mgr.setCandles(list)
    if (ts && savedLr) {
      try {
        ts.setVisibleLogicalRange(savedLr)
      } catch {
        /* */
      }
    }
  }

  opts.bridge?.setDataTimes(list.map((c) => c.time))
  return { len, first, last }
}
