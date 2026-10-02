/**
 * Deep Print – Bid/Ask footprint + optional live volume bars beside the print.
 * VP bars update with the selected candle trades (real data only).
 * forcePinTime: pin from LWC chart.subscribeClick.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { Candle, ExchangeId, Interval } from '@/types'
import { retainTradeBuffer, queryTradesInRange } from './tradeBuffer'
import { aggregatePrint } from './aggregate'
import { intervalToSeconds } from './interval'
import { buyRatio, levelImbalance, stackedImbalancePrices } from './imbalance'
import type { DeepPrintModel, PrintLevel } from './types'
import { buildCandleProfile } from './candleProfile'

interface DeepPrintOverlayProps {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  exchange: ExchangeId
  symbol: string
  interval: Interval
  candles: Candle[]
  /** Chart click (LWC subscribeClick) → pin this candle time */
  forcePinTime?: number | null
}

const IMB_THRESHOLD = 0.7
const STACK_MIN = 3
const BUY = '#0ecb81'
const SELL = '#a855f7'
const VP_COL_W = 72

export function DeepPrintOverlay({
  enabled,
  bridge,
  containerRef,
  exchange,
  symbol,
  interval,
  candles,
  forcePinTime = null,
}: DeepPrintOverlayProps) {
  const [model, setModel] = useState<DeepPrintModel | null>(null)
  const [pinned, setPinned] = useState(false)
  const [pinnedTime, setPinnedTime] = useState<number | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [showVp, setShowVp] = useState(true)
  const [vpVaPct, setVpVaPct] = useState(70)
  const [deltaFilterOn, setDeltaFilterOn] = useState(false)
  const [deltaFilterPct, setDeltaFilterPct] = useState(10)
  const modelRef = useRef<DeepPrintModel | null>(null)
  const userPickedRef = useRef(false)
  modelRef.current = model

  useEffect(() => {
    if (!enabled) return
    return retainTradeBuffer(exchange, symbol)
  }, [enabled, exchange, symbol])

  const rebuildModel = useCallback(
    (candleTime: number) => {
      const sec = intervalToSeconds(interval)
      const from = candleTime
      const to = candleTime + sec
      const trades = queryTradesInRange(exchange, symbol, from, to)
      const m = aggregatePrint(trades, candleTime, sec)
      setModel(m)
      if (bridge) {
        const x = bridge.timeToCoordinate(candleTime)
        const mid = (m.high + m.low) / 2 || m.levels[0]?.price
        const y = mid != null ? bridge.priceToCoordinate(mid) : null
        if (x != null && y != null) setPos({ x, y })
      }
    },
    [bridge, exchange, symbol, interval]
  )

  const pinCandle = useCallback(
    (candleTime: number) => {
      userPickedRef.current = true
      setPinned(true)
      setPinnedTime(candleTime)
      rebuildModel(candleTime)
    },
    [rebuildModel]
  )

  const pinLastClosed = useCallback(() => {
    if (candles.length < 2) return
    const closed = candles[candles.length - 2]
    if (closed) pinCandle(closed.time)
  }, [candles, pinCandle])

  useEffect(() => {
    if (!enabled || forcePinTime == null) return
    pinCandle(forcePinTime)
  }, [enabled, forcePinTime, pinCandle])

  const selectCandle = useCallback(
    (candleTime: number) => {
      pinCandle(candleTime)
    },
    [pinCandle]
  )

  const shiftPin = useCallback(
    (dir: -1 | 1) => {
      if (candles.length === 0) return
      const t = pinnedTime ?? modelRef.current?.candleTime
      if (t == null) {
        pinLastClosed()
        return
      }
      const idx = candles.findIndex((c) => c.time === t)
      if (idx < 0) {
        pinLastClosed()
        return
      }
      const next = candles[idx + dir]
      if (next) selectCandle(next.time)
    },
    [candles, pinnedTime, pinLastClosed, selectCandle]
  )

  useEffect(() => {
    if (!enabled || !bridge || candles.length === 0) return
    // hover path handled by parent click + optional internal UI
  }, [enabled, bridge, candles])

  useEffect(() => {
    if (!enabled || !pinned || pinnedTime == null) return
    const id = window.setInterval(() => rebuildModel(pinnedTime), 1000)
    return () => window.clearInterval(id)
  }, [enabled, pinned, pinnedTime, rebuildModel])

  useEffect(() => {
    if (!enabled || pinned || !model) return
    const id = window.setInterval(() => {
      if (modelRef.current?.candleTime != null) rebuildModel(modelRef.current.candleTime)
    }, 1000)
    return () => window.clearInterval(id)
  }, [enabled, pinned, model?.candleTime, rebuildModel])

  useEffect(() => {
    if (!enabled || !bridge || !model) return
    const sync = () => {
      const x = bridge.timeToCoordinate(model.candleTime)
      const mid = (model.high + model.low) / 2 || model.levels[0]?.price
      const y = mid != null ? bridge.priceToCoordinate(mid) : null
      if (x != null && y != null) setPos({ x, y })
    }
    sync()
    return bridge.onVisibleRangeChange(sync)
  }, [enabled, bridge, model])

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        shiftPin(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        shiftPin(1)
      } else if (e.key === 'p' || e.key === 'P') {
        pinLastClosed()
      } else if (e.key === 'Escape' && pinned) {
        setPinned(false)
        setPinnedTime(null)
        userPickedRef.current = false
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, pinned, pinLastClosed, shiftPin])

  useEffect(() => {
    if (!enabled) {
      setModel(null)
      setPinned(false)
      setPinnedTime(null)
      setPos(null)
      userPickedRef.current = false
      return
    }
    userPickedRef.current = false
    pinLastClosed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, symbol, exchange, interval])

  if (!enabled) return null
  if (!model || !pos) {
    return (
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="px-2 py-1 rounded bg-[#0b0e11]/90 border border-[#f0b90b]/40 text-[11px] text-[#f0b90b]">
          Deep Print on · click chart candle to pin · ← → · P = last closed
        </div>
      </div>
    )
  }

  const maxAbsDelta = Math.max(...model.levels.map((l) => Math.abs(l.delta)), 0.0001)
  const levels = deltaFilterOn
    ? model.levels.filter((l) => Math.abs(l.delta) >= maxAbsDelta * (deltaFilterPct / 100))
    : model.levels

  return (
    <div
      className="absolute z-20 pointer-events-auto"
      style={{
        left: Math.max(8, pos.x + 12),
        top: Math.max(8, pos.y - 40),
      }}
      data-no-pan
    >
      <div className="bg-[#0b0e11]/95 border border-[#2b3139] rounded shadow-lg text-[10px] text-[#eaecef] min-w-[200px]">
        <div className="flex items-center gap-2 px-2 py-1 border-b border-[#2b3139]">
          <span className="text-[#f0b90b] font-semibold">Print</span>
          <span className="text-[#5e6673]">
            {pinned ? '📌 pin' : 'hover'} · {model.tradeCount} trades
          </span>
          <button
            type="button"
            className="ml-auto text-[#848e9c] hover:text-[#eaecef]"
            onClick={() => pinLastClosed()}
          >
            last
          </button>
          {pinned && (
            <button
              type="button"
              className="text-[#848e9c] hover:text-[#f6465d]"
              onClick={() => {
                setPinned(false)
                setPinnedTime(null)
                userPickedRef.current = false
              }}
            >
              Unpin
            </button>
          )}
        </div>
        <div className="max-h-48 overflow-y-auto px-1 py-1 font-mono">
          {levels.slice(0, 40).map((l) => {
            const imb = levelImbalance(l)
            const strong = imb >= IMB_THRESHOLD || imb <= 1 - IMB_THRESHOLD
            return (
              <div
                key={l.price}
                className={`flex gap-1 tabular-nums px-1 py-0.5 ${
                  strong ? 'bg-[#1e2329]' : ''
                }`}
              >
                <span className="text-[#a855f7] w-12 text-right">{l.sellVol.toFixed(3)}</span>
                <span className="text-[#848e9c] w-16 text-center">{l.price}</span>
                <span className="text-[#0ecb81] w-12">{l.buyVol.toFixed(3)}</span>
                <span
                  className={`w-10 text-right ${
                    l.delta >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                  }`}
                >
                  {l.delta >= 0 ? '+' : ''}
                  {l.delta.toFixed(2)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
