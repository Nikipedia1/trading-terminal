/**
 * Deep Print – Bid/Ask footprint + volume profile on pinned candle.
 * Real trades only from shared trade buffer.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { Candle, ExchangeId, Interval } from '@/types'
import { retainTradeBuffer, queryTradesInRange, tradeBufferSize } from './tradeBuffer'
import { aggregatePrint } from './aggregate'
import { intervalToSeconds } from './interval'
import { levelImbalance } from './imbalance'
import type { DeepPrintModel } from './types'
import { LAYER_Z } from '@/charts/layerStack'

interface DeepPrintOverlayProps {
  enabled: boolean
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  exchange: ExchangeId
  symbol: string
  interval: Interval
  candles: Candle[]
  forcePinTime?: number | null
}

const IMB_THRESHOLD = 0.7

function candleAt(candles: Candle[], t: number): Candle | undefined {
  return candles.find((c) => c.time === t)
}

function fmtPrice(p: number): string {
  if (!Number.isFinite(p)) return '—'
  if (p >= 1000) return p.toFixed(1)
  if (p >= 1) return p.toFixed(2)
  return p.toFixed(4)
}

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
  const [deltaFilterOn, setDeltaFilterOn] = useState(false)
  const [deltaFilterPct, setDeltaFilterPct] = useState(10)
  const [bufSize, setBufSize] = useState(0)
  const modelRef = useRef<DeepPrintModel | null>(null)
  modelRef.current = model
  const pinnedTimeRef = useRef<number | null>(null)
  pinnedTimeRef.current = pinnedTime

  const sym = (symbol ?? '').toUpperCase()

  useEffect(() => {
    if (!enabled) return
    return retainTradeBuffer(exchange, sym)
  }, [enabled, exchange, sym])

  const placeAt = useCallback(
    (candleTime: number, m: DeepPrintModel) => {
      const c = candleAt(candles, candleTime)
      const midPrice =
        c != null
          ? (c.high + c.low) / 2
          : m.anchorPrice || m.levels[0]?.price || 0
      if (!bridge) {
        setPos({ x: 16, y: 48 })
        return
      }
      const x = bridge.timeToCoordinate(candleTime)
      const y = midPrice > 0 ? bridge.priceToCoordinate(midPrice) : null
      if (x != null && y != null && Number.isFinite(x) && Number.isFinite(y)) {
        setPos({ x, y })
      } else {
        setPos({ x: 16, y: 48 })
      }
    },
    [bridge, candles]
  )

  const rebuildModel = useCallback(
    (candleTime: number) => {
      const sec = intervalToSeconds(interval)
      const from = candleTime
      const to = candleTime + sec
      const trades = queryTradesInRange(exchange, sym, from, to)
      const c = candleAt(candles, candleTime)
      const anchor = c != null ? (c.high + c.low) / 2 : trades[0]?.price ?? 0
      const m = aggregatePrint(trades, candleTime, to, anchor)
      setModel(m)
      placeAt(candleTime, m)
      setBufSize(tradeBufferSize(exchange, sym))
    },
    [bridge, exchange, sym, interval, candles, placeAt]
  )

  const pinCandle = useCallback(
    (candleTime: number) => {
      setPinned(true)
      setPinnedTime(candleTime)
      rebuildModel(candleTime)
    },
    [rebuildModel]
  )

  const pinBestDefault = useCallback(() => {
    if (candles.length === 0) return
    const sec = intervalToSeconds(interval)
    for (let i = candles.length - 1; i >= Math.max(0, candles.length - 12); i--) {
      const t = candles[i].time
      const n = queryTradesInRange(exchange, sym, t, t + sec).length
      if (n > 0) {
        pinCandle(t)
        return
      }
    }
    pinCandle(candles[candles.length - 1].time)
  }, [candles, exchange, sym, interval, pinCandle])

  useEffect(() => {
    if (!enabled || forcePinTime == null) return
    pinCandle(forcePinTime)
  }, [enabled, forcePinTime, pinCandle])

  const shiftPin = useCallback(
    (dir: -1 | 1) => {
      if (candles.length === 0) return
      const t = pinnedTime ?? modelRef.current?.candleTime
      if (t == null) {
        pinBestDefault()
        return
      }
      const idx = candles.findIndex((c) => c.time === t)
      if (idx < 0) {
        pinBestDefault()
        return
      }
      const next = candles[idx + dir]
      if (next) pinCandle(next.time)
    },
    [candles, pinnedTime, pinBestDefault, pinCandle]
  )

  useEffect(() => {
    if (!enabled) return
    const tick = () => {
      const size = tradeBufferSize(exchange, sym)
      setBufSize(size)
      const t = pinnedTimeRef.current
      if (t != null) {
        rebuildModel(t)
      } else if (size > 0 && candles.length > 0) {
        pinBestDefault()
      }
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [enabled, exchange, sym, rebuildModel, pinBestDefault, candles.length])

  useEffect(() => {
    if (!enabled || pinnedTime == null || !model) return
    placeAt(pinnedTime, model)
  }, [enabled, pinnedTime, model, placeAt, bridge])

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        shiftPin(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        shiftPin(1)
      } else if (e.key === 'p' || e.key === 'P') {
        pinBestDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, shiftPin, pinBestDefault])

  useEffect(() => {
    if (!enabled || !bridge) return
    const chart = bridge.getChart?.() ?? null
    if (!chart || typeof (chart as { subscribeClick?: unknown }).subscribeClick !== 'function') {
      return
    }
    const handler = (param: { time?: unknown; point?: { x: number; y: number } }) => {
      if (param.time != null && typeof param.time === 'number') {
        pinCandle(param.time)
        return
      }
      if (param.point && bridge) {
        const t = bridge.coordinateToTime(param.point.x)
        if (typeof t === 'number') pinCandle(t)
      }
    }
    try {
      ;(chart as { subscribeClick: (cb: typeof handler) => void }).subscribeClick(handler)
      return () => {
        try {
          ;(chart as { unsubscribeClick: (cb: typeof handler) => void }).unsubscribeClick(handler)
        } catch {
          /* */
        }
      }
    } catch {
      return
    }
  }, [enabled, bridge, pinCandle])

  useEffect(() => {
    if (!enabled) {
      setModel(null)
      setPinned(false)
      setPinnedTime(null)
      setPos(null)
      setBufSize(0)
      return
    }
    pinBestDefault()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sym, exchange, interval])

  if (!enabled) return null

  const panelPos = pos ?? { x: 16, y: 48 }
  const maxAbsDelta = model
    ? Math.max(...model.levels.map((l) => Math.abs(l.delta)), 0.0001)
    : 0.0001
  const maxVol = model
    ? Math.max(...model.levels.map((l) => l.totalVol), 0.0001)
    : 0.0001
  const levels = model
    ? deltaFilterOn
      ? model.levels.filter((l) => Math.abs(l.delta) >= maxAbsDelta * (deltaFilterPct / 100))
      : model.levels
    : []

  return (
    <div
      className={`absolute ${LAYER_Z.deepPrint ?? 'z-[7]'} pointer-events-auto`}
      style={{
        left: Math.max(8, Math.min(panelPos.x + 12, (containerRef.current?.clientWidth ?? 400) - 280)),
        top: Math.max(8, panelPos.y - 20),
      }}
      data-no-pan
    >
      <div className="bg-[#0b0e11]/95 border border-[#f0b90b]/50 rounded shadow-xl text-[10px] text-[#eaecef] min-w-[260px] max-w-[320px]">
        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#2b3139]">
          <span className="text-[#f0b90b] font-semibold">Deep Print</span>
          <span className="text-[#5e6673]">
            {pinned ? '📌' : ''} {model?.tradeCount ?? 0} · buf {bufSize}
          </span>
          <button type="button" className="ml-auto text-[#848e9c] hover:text-[#eaecef]" onClick={() => pinBestDefault()}>
            last
          </button>
          <button type="button" className="text-[#848e9c] hover:text-[#eaecef]" onClick={() => shiftPin(-1)}>←</button>
          <button type="button" className="text-[#848e9c] hover:text-[#eaecef]" onClick={() => shiftPin(1)}>→</button>
        </div>

        {(!model || model.tradeCount === 0) && (
          <div className="px-2 py-3 text-[11px] text-[#848e9c] leading-relaxed">
            In attesa di trade live su questa candela.
            <br />
            Clicca una candela recente (buf: {bufSize}).
          </div>
        )}

        {model && model.tradeCount > 0 && (
          <>
            {/* Candle totals + buy/sell % bar */}
            <div className="px-2 py-1.5 border-b border-[#1e2329] space-y-1">
              <div className="flex items-center gap-2 text-[9px] text-[#5e6673]">
                <span>
                  Δ {model.totalDelta >= 0 ? '+' : ''}
                  {model.totalDelta.toFixed(3)}
                </span>
                <span className="text-[#0ecb81]">B {model.totalBuy.toFixed(2)} ({model.buyPct.toFixed(0)}%)</span>
                <span className="text-[#f6465d]">S {model.totalSell.toFixed(2)} ({model.sellPct.toFixed(0)}%)</span>
                <span className="ml-auto">Vol {model.totalVolume.toFixed(2)}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden flex bg-[#1e2329]">
                <div className="h-full bg-[#0ecb81]" style={{ width: `${model.buyPct}%` }} />
                <div className="h-full bg-[#f6465d]" style={{ width: `${model.sellPct}%` }} />
              </div>
              {/* VP summary */}
              <div className="flex items-center gap-2 text-[9px] font-mono">
                {model.poc != null && (
                  <span className="text-[#f0b90b]">POC {fmtPrice(model.poc)}</span>
                )}
                {model.vah != null && (
                  <span className="text-[#848e9c]">VAH {fmtPrice(model.vah)}</span>
                )}
                {model.val != null && (
                  <span className="text-[#848e9c]">VAL {fmtPrice(model.val)}</span>
                )}
                <span className="text-[#5e6673] ml-auto">VA {(model.valueAreaPct * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-[#5e6673]">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deltaFilterOn}
                    onChange={(e) => setDeltaFilterOn(e.target.checked)}
                  />
                  filter Δ
                </label>
                {deltaFilterOn && (
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={deltaFilterPct}
                    onChange={(e) => setDeltaFilterPct(Number(e.target.value))}
                    className="w-14"
                  />
                )}
              </div>
            </div>

            {/* Level rows: price | sell% | vol bar | buy% | delta */}
            <div className="grid grid-cols-[52px_1fr_36px] gap-x-1 px-2 py-0.5 text-[8px] text-[#5e6673] border-b border-[#1e2329]">
              <span className="text-right">Price</span>
              <span className="text-center">S% · vol · B%</span>
              <span className="text-right">Δ</span>
            </div>
            <div className="max-h-64 overflow-y-auto px-1 py-1 font-mono">
              {levels.slice(0, 56).map((l) => {
                const imb = levelImbalance(l, IMB_THRESHOLD)
                const strong = imb != null
                const barW = Math.max(2, (l.totalVol / maxVol) * 100)
                return (
                  <div
                    key={l.price}
                    className={`grid grid-cols-[52px_1fr_36px] gap-x-1 items-center px-1 py-0.5 rounded ${
                      l.isPoc
                        ? 'bg-[#f0b90b]/15 ring-1 ring-[#f0b90b]/40'
                        : l.inValueArea
                          ? 'bg-[#1e2329]/60'
                          : strong
                            ? 'bg-[#1e2329]/40'
                            : ''
                    }`}
                  >
                    <span className={`text-right tabular-nums ${
                      l.isPoc ? 'text-[#f0b90b] font-semibold' : 'text-[#848e9c]'
                    }`}>
                      {fmtPrice(l.price)}
                      {l.isPoc ? ' ★' : ''}
                    </span>
                    <div className="flex items-center gap-0.5 min-w-0">
                      <span className="w-7 text-right text-[#a855f7] tabular-nums text-[9px]">
                        {l.sellPct.toFixed(0)}
                      </span>
                      <div className="flex-1 h-2.5 rounded-sm overflow-hidden flex bg-[#0b0e11] min-w-[40px]">
                        <div
                          className="h-full bg-[#a855f7]/80"
                          style={{ width: `${(l.sellPct / 100) * barW}%` }}
                          title={`Sell ${l.sellQty.toFixed(4)}`}
                        />
                        <div
                          className="h-full bg-[#0ecb81]/80"
                          style={{ width: `${(l.buyPct / 100) * barW}%` }}
                          title={`Buy ${l.buyQty.toFixed(4)}`}
                        />
                      </div>
                      <span className="w-7 text-left text-[#0ecb81] tabular-nums text-[9px]">
                        {l.buyPct.toFixed(0)}
                      </span>
                      <span className="w-8 text-right text-[#5e6673] tabular-nums text-[8px]">
                        {l.volPct.toFixed(0)}%
                      </span>
                    </div>
                    <span
                      className={`text-right tabular-nums text-[9px] ${
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
          </>
        )}
      </div>
    </div>
  )
}
