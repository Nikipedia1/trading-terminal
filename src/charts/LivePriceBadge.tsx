/**
 * TradingView-style live price badge on the right scale.
 * Follows last candle close via priceToCoordinate (anti-pellicola).
 * Adaptive decimals for any instrument.
 */

import { useEffect, useState } from 'react'
import type { CoordinateBridge } from './coordinate-bridge'
import type { Candle } from '@/types'

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const a = Math.abs(n)
  if (a >= 1000)
    return n.toLocaleString(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })
  if (a >= 100) return n.toFixed(2)
  if (a >= 10) return n.toFixed(3)
  if (a >= 1) return n.toFixed(4)
  if (a >= 0.01) return n.toFixed(6)
  if (a >= 0.0001) return n.toFixed(8)
  return n.toFixed(10)
}

export function LivePriceBadge({
  bridge,
  containerRef,
  candles,
}: {
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
  candles: Candle[]
}) {
  const [y, setY] = useState<number | null>(null)
  const [price, setPrice] = useState<number | null>(null)
  const [bull, setBull] = useState(true)
  const [flash, setFlash] = useState(false)

  const last = candles.length > 0 ? candles[candles.length - 1] : null

  useEffect(() => {
    if (!last) {
      setY(null)
      setPrice(null)
      return
    }
    setPrice(last.close)
    setBull(last.close >= last.open)
    setFlash(true)
    const t = window.setTimeout(() => setFlash(false), 180)
    return () => window.clearTimeout(t)
  }, [last?.time, last?.close, last?.open])

  useEffect(() => {
    if (!bridge || price == null) {
      setY(null)
      return
    }
    const sync = () => {
      const py = bridge.priceToCoordinate(price)
      setY(py)
    }
    sync()
    const unsub = bridge.onVisibleRangeChange(sync)
    const el = containerRef.current
    let ro: ResizeObserver | null = null
    if (el) {
      ro = new ResizeObserver(sync)
      ro.observe(el)
    }
    return () => {
      unsub()
      ro?.disconnect()
    }
  }, [bridge, price, containerRef])

  if (y == null || price == null) return null

  const bg = bull ? '#0ecb81' : '#f6465d'
  const text = '#0b0e11'

  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{
        right: 0,
        top: y,
        transform: 'translateY(-50%)',
      }}
      aria-hidden
    >
      <div
        className="flex items-center"
        style={{
          filter: flash ? 'brightness(1.25)' : undefined,
          transition: 'filter 120ms ease-out',
        }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: '7px solid transparent',
            borderBottom: '7px solid transparent',
            borderRight: `8px solid ${bg}`,
          }}
        />
        <div
          className="font-mono text-[11px] font-bold tabular-nums px-1.5 py-[3px] shadow-md"
          style={{
            backgroundColor: bg,
            color: text,
            minWidth: 56,
            textAlign: 'center',
            borderRadius: '0 2px 2px 0',
          }}
        >
          {formatPrice(price)}
        </div>
      </div>
    </div>
  )
}
