/**
 * Historical orderflow replay scrubber – uses IndexedDB trade archive.
 * Does not invent ticks; only navigates time window over stored trades.
 */

import { useEffect, useState } from 'react'
import type { ExchangeId } from '@/types'
import { archiveStats } from '@/data/tradeArchive'
import { useChartFocusStore } from '@/stores/chartFocusStore'

interface ReplayBarProps {
  enabled: boolean
  exchange: ExchangeId
  symbol: string
}

export function ReplayBar({ enabled, exchange, symbol }: ReplayBarProps) {
  const [count, setCount] = useState(0)
  const [oldest, setOldest] = useState<number | null>(null)
  const [newest, setNewest] = useState<number | null>(null)
  const [cursor, setCursor] = useState(100) // % toward newest
  const requestFocus = useChartFocusStore((s) => s.requestFocus)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    const tick = async () => {
      const s = await archiveStats(exchange, symbol)
      if (!alive) return
      setCount(s.count)
      setOldest(s.oldestMs)
      setNewest(s.newestMs)
    }
    void tick()
    const id = window.setInterval(tick, 3000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [enabled, exchange, symbol])

  if (!enabled) return null

  const onSeek = (pct: number) => {
    setCursor(pct)
    if (oldest == null || newest == null || newest <= oldest) return
    const t = oldest + ((newest - oldest) * pct) / 100
    requestFocus(Math.floor(t / 1000), { padSec: 600 })
  }

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[12] w-[min(420px,90%)] pointer-events-auto">
      <div className="bg-[#0b0e11]/95 border border-[#2b3139] rounded-md px-3 py-2 shadow-lg">
        <div className="flex items-center justify-between text-[10px] text-[#848e9c] mb-1">
          <span className="font-semibold text-[#eaecef]">Replay</span>
          <span>
            {count.toLocaleString()} archived ticks
            {oldest != null && newest != null
              ? ` · ${new Date(oldest).toLocaleTimeString()}–${new Date(newest).toLocaleTimeString()}`
              : ' · waiting…'}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={cursor}
          disabled={count === 0}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full h-1 accent-[#f0b90b]"
        />
        <p className="text-[9px] text-[#5e6673] mt-1 leading-snug">
          IndexedDB beyond ring buffer. Seek centers primary chart — no synthetic fills.
        </p>
      </div>
    </div>
  )
}
