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
  bridge?: CoordinateBridge | null
  containerRef?: React.RefObject<HTMLDivElement | null>
  candles: Candle[]
}) {
  const [y, setY] = useState<number | null>(null)
  const last = candles.length ? candles[candles.length - 1] : null
  const price = last?.close ?? null

  useEffect(() => {
    if (!bridge || price == null) {
      setY(null)
      return
    }
    const tick = () => {
      const py = bridge.priceToCoordinate(price)
      setY(py)
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [bridge, price, candles.length])

  if (y == null || price == null) return null
  if (containerRef?.current) {
    const h = containerRef.current.clientHeight
    if (y < 0 || y > h) return null
  }

  return (
    <div
      className="pointer-events-none absolute right-0 z-[8] translate-x-0"
      style={{ top: y, transform: 'translateY(-50%)' }}
    >
      <div className="px-1.5 py-0.5 rounded-l text-[10px] font-mono font-semibold bg-[#f0b90b] text-[#0b0e11] shadow">
        {formatPrice(price)}
      </div>
    </div>
  )
}
