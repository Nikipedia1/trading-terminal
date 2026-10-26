/**
 * Historical orderflow replay scrubber – IndexedDB trade archive only.
 * No synthetic ticks; play/step seeks chart focus over stored aggressor trades.
 */

import { useEffect, useRef, useState } from 'react'
import type { ExchangeId } from '@/types'
import { archiveStats } from '@/data/tradeArchive'
import { useChartFocusStore } from '@/stores/chartFocusStore'
import { MetricHonestyBadge } from '@/ui/MetricHonesty'

interface ReplayBarProps {
  enabled: boolean
  exchange: ExchangeId
  symbol: string
}

export function ReplayBar({ enabled, exchange, symbol }: ReplayBarProps) {
  const [count, setCount] = useState(0)
  const [oldest, setOldest] = useState<number | null>(null)
  const [newest, setNewest] = useState<number | null>(null)
  const [cursor, setCursor] = useState(100)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const requestFocus = useChartFocusStore((s) => s.requestFocus)
  const playRef = useRef<number | null>(null)

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

  const seekPct = (pct: number) => {
    const p = Math.max(0, Math.min(100, pct))
    setCursor(p)
    if (oldest == null || newest == null || newest <= oldest) return
    const t = oldest + ((newest - oldest) * p) / 100
    requestFocus(Math.floor(t / 1000), { padSec: 600 })
  }

  useEffect(() => {
    if (!playing || !enabled || count === 0) {
      if (playRef.current != null) {
        window.clearInterval(playRef.current)
        playRef.current = null
      }
      return
    }
    playRef.current = window.setInterval(() => {
      setCursor((c) => {
        const next = c + 0.5 * speed
        if (next >= 100) {
          setPlaying(false)
          return 100
        }
        if (oldest != null && newest != null && newest > oldest) {
          const t = oldest + ((newest - oldest) * next) / 100
          requestFocus(Math.floor(t / 1000), { padSec: 600 })
        }
        return next
      })
    }, 200)
    return () => {
      if (playRef.current != null) window.clearInterval(playRef.current)
    }
  }, [playing, enabled, count, speed, oldest, newest, requestFocus])

  if (!enabled) return null

  const empty = count === 0

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[12] w-[min(480px,92%)] pointer-events-auto">
      <div className="bg-[#0b0e11]/95 border border-[#2b3139] rounded-md px-3 py-2 shadow-lg space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[10px] text-[#848e9c]">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#eaecef]">Replay</span>
            <MetricHonestyBadge kind="archive-only" />
            <MetricHonestyBadge kind="synthetic-none" />
          </div>
          <span className="font-mono tabular-nums">
            {count.toLocaleString()} ticks
            {oldest != null && newest != null
              ? ` · ${new Date(oldest).toLocaleTimeString()}–${new Date(newest).toLocaleTimeString()}`
              : ' · waiting…'}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={cursor}
          disabled={empty}
          onChange={(e) => {
            setPlaying(false)
            seekPct(Number(e.target.value))
          }}
          className="w-full h-1 accent-[#f0b90b]"
        />

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={empty}
            className="px-2 py-0.5 rounded border border-[#2b3139] text-[10px] text-[#eaecef] hover:border-[#f0b90b]/50 disabled:opacity-40"
            onClick={() => {
              setPlaying(false)
              seekPct(Math.max(0, cursor - 2))
            }}
          >
            ‹ Step
          </button>
          <button
            type="button"
            disabled={empty}
            className={`px-2.5 py-0.5 rounded border text-[10px] font-semibold disabled:opacity-40 ${
              playing
                ? 'border-[#f0b90b] text-[#0b0e11] bg-[#f0b90b]'
                : 'border-[#2b3139] text-[#eaecef] hover:border-[#f0b90b]/50'
            }`}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            disabled={empty}
            className="px-2 py-0.5 rounded border border-[#2b3139] text-[10px] text-[#eaecef] hover:border-[#f0b90b]/50 disabled:opacity-40"
            onClick={() => {
              setPlaying(false)
              seekPct(Math.min(100, cursor + 2))
            }}
          >
            Step ›
          </button>
          <select
            className="ml-auto bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px] text-[#c8cdd5]"
            value={speed}
            disabled={empty}
            onChange={(e) => setSpeed(Number(e.target.value))}
            title="Playback speed (cursor advance rate)"
          >
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
        </div>

        <p className="text-[9px] text-[#5e6673] leading-snug">
          {empty
            ? 'No archived trades for this symbol yet — Start Live to record ticks to IndexedDB.'
            : 'Seek centers primary chart on real archived aggressor trades only. Not a full L2 book replay.'}
        </p>
      </div>
    </div>
  )
}
