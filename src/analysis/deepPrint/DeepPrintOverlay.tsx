/**
 * Deep Print – Bid/Ask footprint + optional live volume bars beside the print.
 * VP bars update with the selected candle trades (real data only).
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
}

const IMB_THRESHOLD = 0.7
const STACK_MIN = 3
const BUY = '#0ecb81'
const SELL = '#a855f7'
const VP_COL_W = 72

function formatQty(q: number): string {
  if (Math.abs(q) >= 1000) return q.toFixed(2)
  if (Math.abs(q) >= 1) return q.toFixed(3)
  if (Math.abs(q) >= 0.01) return q.toFixed(4)
  return q.toFixed(5)
}

function formatPct(r: number): string {
  return `${(r * 100).toFixed(0)}%`
}

function findCandleCovering(
  candles: Candle[],
  timeSec: number,
  interval: Interval
): Candle | undefined {
  const sec = intervalToSeconds(interval)
  return candles.find((c) => timeSec >= c.time && timeSec < c.time + sec)
}

export function DeepPrintOverlay({
  enabled,
  bridge,
  containerRef,
  exchange,
  symbol,
  interval,
  candles,
}: DeepPrintOverlayProps) {
  const [model, setModel] = useState<DeepPrintModel | null>(null)
  const [pinned, setPinned] = useState(false)
  const [pinnedTime, setPinnedTime] = useState<number | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [deltaFilterOn, setDeltaFilterOn] = useState(false)
  const [deltaFilterPct, setDeltaFilterPct] = useState(15)
  const [showVp, setShowVp] = useState(true)
  const [vpVaPct, setVpVaPct] = useState<68 | 70 | 80>(70)

  const modelRef = useRef<DeepPrintModel | null>(null)
  modelRef.current = model
  const userPickedRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    return retainTradeBuffer(exchange, symbol)
  }, [enabled, exchange, symbol])

  const rebuildModel = useCallback(
    (candleTime: number) => {
      const candle = candles.find((c) => c.time === candleTime)
      if (!candle) {
        setModel(null)
        return
      }
      const sec = intervalToSeconds(interval)
      const end = candleTime + sec
      const trades = queryTradesInRange(exchange, symbol, candleTime, end)
      const anchor = (candle.high + candle.low) / 2
      setModel(aggregatePrint(trades, candleTime, end, anchor))
    },
    [candles, exchange, symbol, interval]
  )

  const pinCandle = useCallback(
    (candleTime: number) => {
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

  const selectCandle = useCallback(
    (candleTime: number) => {
      userPickedRef.current = true
      pinCandle(candleTime)
    },
    [pinCandle]
  )

  const shiftPin = useCallback(
    (dir: -1 | 1) => {
      if (!candles.length) return
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

  const updatePosition = useCallback(() => {
    const m = modelRef.current
    if (!m || !bridge) {
      setPos(null)
      return
    }
    const x = bridge.timeToCoordinate(m.candleTime as any)
    const y = bridge.priceToCoordinate(m.anchorPrice)
    if (x === null || y === null) {
      setPos(null)
      return
    }
    setPos({ x, y })
  }, [bridge])

  useEffect(() => {
    updatePosition()
  }, [model, updatePosition])

  useEffect(() => {
    if (!bridge || !enabled) return
    const unsub = bridge.onVisibleRangeChange(() => updatePosition())
    const parent = containerRef.current
    let ro: ResizeObserver | null = null
    if (parent) {
      ro = new ResizeObserver(() => updatePosition())
      ro.observe(parent)
    }
    return () => {
      unsub()
      ro?.disconnect()
    }
  }, [bridge, enabled, updatePosition, containerRef])

  useEffect(() => {
    if (!enabled || !pinned || pinnedTime == null) return
    const id = window.setInterval(() => rebuildModel(pinnedTime), 1000)
    return () => window.clearInterval(id)
  }, [enabled, pinned, pinnedTime, rebuildModel])

  useEffect(() => {
    if (!enabled || pinned || !model) return
    const id = window.setInterval(() => {
      if (modelRef.current) rebuildModel(modelRef.current.candleTime)
    }, 1000)
    return () => window.clearInterval(id)
  }, [enabled, pinned, model?.candleTime, rebuildModel])

  useEffect(() => {
    if (!enabled || !bridge) return
    const chart = bridge.getChart()
    if (!chart) return

    const onClick = (param: any) => {
      if (!param?.time) return
      const t = typeof param.time === 'number' ? param.time : null
      if (t === null) return
      const candle =
        candles.find((c) => c.time === t) || findCandleCovering(candles, t, interval)
      if (!candle) return
      selectCandle(candle.time)
    }

    const onMove = (param: any) => {
      if (pinned) return
      if (!param?.time) {
        setModel(null)
        return
      }
      const t = typeof param.time === 'number' ? param.time : null
      if (t === null) return
      const candle =
        candles.find((c) => c.time === t) || findCandleCovering(candles, t, interval)
      if (!candle) return
      rebuildModel(candle.time)
    }

    chart.subscribeClick(onClick)
    chart.subscribeCrosshairMove(onMove)
    return () => {
      chart.unsubscribeClick(onClick)
      chart.unsubscribeCrosshairMove(onMove)
    }
  }, [enabled, bridge, candles, interval, pinned, rebuildModel, selectCandle])

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        userPickedRef.current = true
        pinLastClosed()
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        shiftPin(-1)
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        shiftPin(1)
      }
      if (e.key === 'Escape' && pinned) {
        setPinned(false)
        setPinnedTime(null)
        setModel(null)
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

  const maxAbsDelta = useMemo(() => {
    if (!model?.levels.length) return 0.0001
    return Math.max(...model.levels.map((l) => Math.abs(l.delta)), 0.0001)
  }, [model])

  const visibleLevels: PrintLevel[] = useMemo(() => {
    if (!model) return []
    if (!deltaFilterOn) return model.levels
    const thresh = maxAbsDelta * (deltaFilterPct / 100)
    return model.levels.filter((l) => Math.abs(l.delta) >= thresh)
  }, [model, deltaFilterOn, deltaFilterPct, maxAbsDelta])

  const stacked = useMemo(
    () => stackedImbalancePrices(visibleLevels, STACK_MIN, IMB_THRESHOLD),
    [visibleLevels]
  )

  const candleProfile = useMemo(
    () => (showVp ? buildCandleProfile(visibleLevels, vpVaPct) : null),
    [showVp, visibleLevels, vpVaPct]
  )

  const vpByPrice = useMemo(() => {
    const m = new Map<
      number,
      { share: number; isPoc: boolean; inVa: boolean; volume: number }
    >()
    if (!candleProfile) return m
    for (const b of candleProfile.buckets) {
      m.set(b.price, {
        share: b.share,
        isPoc: b.isPoc,
        inVa: b.inVa,
        volume: b.volume,
      })
    }
    return m
  }, [candleProfile])

  if (!enabled) return null
  if (!model || !pos) {
    return (
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="px-2 py-1 rounded bg-[#0b0e11]/90 border border-[#f0b90b]/40 text-[11px] text-[#f0b90b]">
          Deep Print on · click a candle to pin · ← → move · P = last closed
        </div>
      </div>
    )
  }

  const parent = containerRef.current
  const cw = parent?.clientWidth ?? 0
  const ch = parent?.clientHeight ?? 0

  const panelW = Math.min(
    showVp ? 400 : 340,
    Math.max(showVp ? 300 : 260, 240 + Math.min(visibleLevels.length, 12) * 2 + (showVp ? VP_COL_W : 0))
  )
  const rowH = 22
  const panelH = Math.min(380, 88 + Math.max(1, visibleLevels.length) * rowH)

  let left = pos.x + 14
  let top = pos.y - panelH / 2
  if (left + panelW > cw - 8) left = Math.max(4, pos.x - panelW - 14)
  if (left < 4) left = 4
  if (top < 4) top = 4
  if (top + panelH > ch - 4) top = Math.max(4, ch - panelH - 4)

  const maxSide = Math.max(
    ...visibleLevels.map((l) => Math.max(l.buyQty, l.sellQty)),
    0.0001
  )
  const maxVpVol = Math.max(
    ...(candleProfile?.buckets.map((b) => b.volume) ?? [0]),
    0.0001
  )

  const totalVol = model.totalBuy + model.totalSell
  const buyPct = totalVol > 0 ? model.totalBuy / totalVol : 0.5
  const sellPct = totalVol > 0 ? model.totalSell / totalVol : 0.5
  const colCls = 'grid-cols-[1fr_64px_1fr_48px]'

  return (
    <div
      className="absolute z-20 pointer-events-auto select-none"
      style={{ left, top, width: panelW }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="bg-[#0b0e11]/97 border border-[#2b3139] rounded-md shadow-2xl overflow-hidden font-mono">
        <div className="px-2.5 py-2 border-b border-[#2b3139] bg-[#12161c]">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[12px] font-bold text-[#eaecef] tracking-wide">Deep Print</span>
            <span
              className={`text-[13px] font-bold tabular-nums ${
                model.totalDelta >= 0 ? 'text-[#0ecb81]' : 'text-[#a855f7]'
              }`}
            >
              Δ {formatQty(model.totalDelta)}
            </span>
            <div className="flex items-center gap-1.5 text-[12px] font-semibold tabular-nums">
              <span className="text-[#0ecb81]">buy {formatPct(buyPct)}</span>
              <span className="text-[#5e6673]">·</span>
              <span className="text-[#a855f7]">sell {formatPct(sellPct)}</span>
            </div>
            <button
              type="button"
              className="text-[#848e9c] hover:text-[#eaecef] text-sm px-1 leading-none"
              title="Close (Esc)"
              onClick={() => {
                setModel(null)
                setPinned(false)
                setPinnedTime(null)
                userPickedRef.current = false
              }}
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] text-[#848e9c]">
              {pinned ? '📌 pin' : 'hover'} · click candle · {model.tradeCount} trades
            </span>
            <button
              type="button"
              className="text-[10px] px-1.5 py-0.5 rounded border border-[#2b3139] text-[#eaecef] hover:bg-[#1e2329]"
              onClick={() => shiftPin(-1)}
            >
              ←
            </button>
            <button
              type="button"
              className="text-[10px] px-1.5 py-0.5 rounded border border-[#2b3139] text-[#eaecef] hover:bg-[#1e2329]"
              onClick={() => shiftPin(1)}
            >
              →
            </button>
            <button
              type="button"
              className="text-[10px] px-1.5 py-0.5 rounded border border-[#2b3139] text-[#eaecef] hover:bg-[#1e2329]"
              onClick={() => {
                userPickedRef.current = true
                pinLastClosed()
              }}
            >
              Last closed
            </button>
            {pinned && (
              <button
                type="button"
                className="text-[10px] px-1.5 py-0.5 rounded border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]"
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

          <div className="flex items-center gap-2 mt-1.5">
            <label className="flex items-center gap-1.5 text-[10px] text-[#848e9c] cursor-pointer">
              <input
                type="checkbox"
                className="accent-[#0ecb81]"
                checked={deltaFilterOn}
                onChange={(e) => setDeltaFilterOn(e.target.checked)}
              />
              Solo |Δ| ≥
            </label>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              disabled={!deltaFilterOn}
              value={deltaFilterPct}
              onChange={(e) => setDeltaFilterPct(Number(e.target.value))}
              className="flex-1 h-1 accent-[#0ecb81]"
            />
            <span className="text-[10px] text-[#eaecef] w-8 tabular-nums">{deltaFilterPct}%</span>
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <label className="flex items-center gap-1.5 text-[10px] text-[#848e9c] cursor-pointer">
              <input
                type="checkbox"
                className="accent-[#f0b90b]"
                checked={showVp}
                onChange={(e) => setShowVp(e.target.checked)}
              />
              Barre VP live
            </label>
            {showVp && (
              <>
                <span className="text-[10px] text-[#5e6673]">VA%</span>
                {([68, 70, 80] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      vpVaPct === v
                        ? 'border-[#f0b90b] text-[#f0b90b] bg-[#f0b90b]/10'
                        : 'border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]'
                    }`}
                    onClick={() => setVpVaPct(v)}
                  >
                    {v}
                  </button>
                ))}
                {candleProfile && (
                  <span className="text-[10px] text-[#848e9c] tabular-nums">
                    POC {candleProfile.poc} · VAH {candleProfile.vah} · VAL{' '}
                    {candleProfile.val}
                  </span>
                )}
              </>
            )}
          </div>

          {stacked.size >= STACK_MIN && (
            <div
              className="mt-1.5 px-2 py-1 rounded text-[11px] font-bold tracking-wide border"
              style={{
                background:
                  model.totalDelta >= 0
                    ? 'rgba(14, 203, 129, 0.15)'
                    : 'rgba(168, 85, 247, 0.15)',
                borderColor:
                  model.totalDelta >= 0
                    ? 'rgba(14, 203, 129, 0.5)'
                    : 'rgba(168, 85, 247, 0.5)',
                color: model.totalDelta >= 0 ? BUY : SELL,
              }}
            >
              ⚠ STACKED IMBALANCE · {stacked.size} levels
            </div>
          )}
        </div>

        <div className="flex items-stretch border-b border-[#2b3139]/80">
          {showVp && (
            <div
              className="shrink-0 flex items-center justify-center text-[10px] font-bold text-[#f0b90b] bg-[#0d1118] border-r border-[#f0b90b]/30"
              style={{ width: VP_COL_W }}
            >
              VP live
            </div>
          )}
          <div className={`grid gap-0 px-2 py-1.5 text-[11px] font-bold flex-1 ${colCls}`}>
            <span className="text-left text-[#a855f7]">SELL</span>
            <span className="text-center text-[#848e9c]">PX</span>
            <span className="text-right text-[#0ecb81]">BUY</span>
            <span className="text-right text-[#848e9c]">Δ</span>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {visibleLevels.length === 0 ? (
            <div className="px-3 py-5 text-[12px] text-[#848e9c] text-center">
              {model.levels.length === 0
                ? 'No trades in buffer for this candle.'
                : 'No levels pass the |Δ| filter.'}
            </div>
          ) : (
            visibleLevels.map((l) => {
              const sellPctBar = (l.sellQty / maxSide) * 100
              const buyPctLvl = (l.buyQty / maxSide) * 100
              const dPct = (Math.abs(l.delta) / maxAbsDelta) * 100
              const imb = levelImbalance(l, IMB_THRESHOLD)
              const isStack = stacked.has(l.price)
              const ratio = buyRatio(l)
              const sellAlpha = imb === 'sell' ? 0.72 : 0.42
              const buyAlpha = imb === 'buy' ? 0.72 : 0.42
              const vp = vpByPrice.get(l.price)
              const vol = vp?.volume ?? l.buyQty + l.sellQty
              const vpPct = Math.max(vol > 0 ? 10 : 0, (vol / maxVpVol) * 100)

              let rowBg = 'transparent'
              if (isStack && imb === 'buy') rowBg = 'rgba(14, 203, 129, 0.18)'
              else if (isStack && imb === 'sell') rowBg = 'rgba(168, 85, 247, 0.18)'
              else if (imb === 'buy') rowBg = 'rgba(14, 203, 129, 0.10)'
              else if (imb === 'sell') rowBg = 'rgba(168, 85, 247, 0.10)'

              return (
                <div
                  key={l.price}
                  className="flex items-stretch border-b border-[#1e2329]/50"
                  style={{ minHeight: rowH, background: rowBg }}
                >
                  {showVp && (
                    <div
                      className="relative shrink-0 flex items-center justify-end pr-1 bg-[#0d1118] border-r border-[#f0b90b]/30"
                      style={{ width: VP_COL_W }}
                      title={`VP live ${formatQty(vol)}${vp?.isPoc ? ' · POC' : ''}${vp?.inVa ? ' · VA' : ''}`}
                    >
                      <div
                        className="h-4 rounded-sm transition-[width] duration-150"
                        style={{
                          width: `${vpPct}%`,
                          minWidth: vol > 0 ? 4 : 0,
                          backgroundColor: vp?.isPoc
                            ? '#f0b90b'
                            : vp?.inVa
                              ? 'rgba(240, 185, 11, 0.75)'
                              : 'rgba(91, 141, 239, 0.7)',
                          boxShadow: vp?.isPoc ? '0 0 8px rgba(240,185,11,0.5)' : undefined,
                        }}
                      />
                    </div>
                  )}
                  <div
                    className={`grid gap-0 px-2 items-stretch flex-1 min-w-0 ${colCls}`}
                    style={{
                      minHeight: rowH,
                      boxShadow: isStack
                        ? imb === 'buy'
                          ? 'inset 3px 0 0 #0ecb81'
                          : 'inset 3px 0 0 #a855f7'
                        : undefined,
                    }}
                    title={
                      imb
                        ? `${imb} imbalance ${formatPct(imb === 'buy' ? ratio : 1 - ratio)}${
                            isStack ? ' · STACKED' : ''
                          }`
                        : undefined
                    }
                  >
                    <div className="relative flex items-center justify-end pr-1">
                      <div
                        className="absolute inset-y-1 right-0 rounded-sm"
                        style={{
                          width: `${Math.max(l.sellQty > 0 ? 10 : 0, sellPctBar)}%`,
                          backgroundColor: `rgba(168, 85, 247, ${sellAlpha})`,
                        }}
                      />
                      <span className="relative text-[12px] font-semibold text-[#a855f7] tabular-nums">
                        {l.sellQty > 0 ? formatQty(l.sellQty) : ''}
                      </span>
                    </div>
                    <div
                      className={`flex items-center justify-center text-[12px] font-bold tabular-nums ${
                        imb === 'buy'
                          ? 'text-[#0ecb81]'
                          : imb === 'sell'
                            ? 'text-[#a855f7]'
                            : 'text-[#eaecef]'
                      }`}
                    >
                      {l.price}
                    </div>
                    <div className="relative flex items-center justify-start pl-1">
                      <div
                        className="absolute inset-y-1 left-0 rounded-sm"
                        style={{
                          width: `${Math.max(l.buyQty > 0 ? 10 : 0, buyPctLvl)}%`,
                          backgroundColor: `rgba(14, 203, 129, ${buyAlpha})`,
                        }}
                      />
                      <span className="relative text-[12px] font-semibold text-[#0ecb81] tabular-nums">
                        {l.buyQty > 0 ? formatQty(l.buyQty) : ''}
                      </span>
                    </div>
                    <div className="relative flex items-center justify-end pl-0.5">
                      <div className="relative w-full h-3.5 flex items-center justify-end">
                        <div
                          className="h-3 rounded-sm"
                          style={{
                            width: `${Math.max(l.delta !== 0 ? 14 : 0, dPct)}%`,
                            backgroundColor: l.delta >= 0 ? BUY : SELL,
                            opacity: imb ? 0.95 : 0.8,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="flex justify-between items-center px-2.5 py-1.5 border-t border-[#2b3139] text-[11px]">
          <span className="text-[#a855f7] font-semibold tabular-nums">
            Σ {formatQty(model.totalSell)}{' '}
            <span className="opacity-80 font-normal">({formatPct(sellPct)})</span>
          </span>
          <span className="text-[#848e9c] text-[10px]">
            {stacked.size > 0 ? `stack ${stacked.size} lvl` : 'no stack'}
            {candleProfile ? ` · VP Σ ${formatQty(candleProfile.totalVolume)}` : ''}
          </span>
          <span className="text-[#0ecb81] font-semibold tabular-nums">
            Σ {formatQty(model.totalBuy)}{' '}
            <span className="opacity-80 font-normal">({formatPct(buyPct)})</span>
          </span>
        </div>
        {showVp && candleProfile && (
          <div className="px-2.5 py-1 border-t border-[#2b3139]/80 text-[10px] text-[#848e9c] flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="text-[#f0b90b] font-semibold">POC {candleProfile.poc}</span>
            <span>VAH {candleProfile.vah}</span>
            <span>VAL {candleProfile.val}</span>
            <span>VA {candleProfile.vaPct.toFixed(0)}% · barre live</span>
          </div>
        )}
      </div>
    </div>
  )
}
