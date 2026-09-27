/** Session journal UI */

import { useState } from 'react'
import { useJournalStore } from './journalStore'
import { useMarketStore } from '@/stores/marketStore'
import { useChartFocusStore } from '@/stores/chartFocusStore'

export function JournalPanel() {
  const entries = useJournalStore((s) => s.entries)
  const add = useJournalStore((s) => s.add)
  const remove = useJournalStore((s) => s.remove)
  const clear = useJournalStore((s) => s.clear)
  const exportJson = useJournalStore((s) => s.exportJson)
  const symbol = useMarketStore((s) => s.symbol)
  const last = useMarketStore((s) => s.ticker?.lastPrice ?? 0)
  const requestFocus = useChartFocusStore((s) => s.requestFocus)

  const [note, setNote] = useState('')
  const [pnl, setPnl] = useState('')

  const onAdd = async () => {
    if (!note.trim()) return
    let shot: string | undefined
    try {
      // Best-effort: capture main chart area if html2canvas not available, skip
      const el = document.querySelector('[data-chart-root]') as HTMLElement | null
      if (el && 'toDataURL' in document.createElement('canvas')) {
        // minimal placeholder – full canvas capture needs external lib; store note only
        shot = undefined
      }
    } catch {
      /* */
    }
    add({
      chartTimeSec: Math.floor(Date.now() / 1000),
      symbol: symbol.toUpperCase(),
      note: note.trim(),
      pnlTag: pnl ? Number(pnl) : null,
      screenshot: shot,
    })
    setNote('')
    setPnl('')
  }

  return (
    <div className="flex flex-col h-full min-h-0 text-[11px]">
      <div className="px-2 py-1.5 border-b border-[#1e2329] shrink-0 space-y-1">
        <div className="font-semibold text-[#eaecef]">Session journal</div>
        <textarea
          className="w-full h-14 bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1 text-[11px] text-[#eaecef] resize-none"
          placeholder={`Note @ ${symbol} ${last > 0 ? last : ''}…`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-1 items-center">
          <input
            className="w-20 bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 font-mono-nums"
            placeholder="PnL"
            value={pnl}
            onChange={(e) => setPnl(e.target.value)}
          />
          <button
            type="button"
            className="px-2 py-0.5 rounded bg-[#f0b90b]/20 text-[#f0b90b]"
            onClick={() => void onAdd()}
          >
            Add
          </button>
          <button
            type="button"
            className="px-2 py-0.5 text-[#848e9c] ml-auto"
            onClick={() => {
              const blob = new Blob([exportJson()], { type: 'application/json' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = `journal-${Date.now()}.json`
              a.click()
            }}
          >
            Export
          </button>
          <button type="button" className="px-2 py-0.5 text-[#f6465d]" onClick={() => clear()}>
            Clear
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {entries.length === 0 && (
          <div className="p-3 text-[#848e9c]">No notes. Tag trades with PnL + chart time.</div>
        )}
        {entries.map((e) => (
          <div key={e.id} className="px-2 py-1.5 border-b border-[#1e2329]/50">
            <div className="flex justify-between text-[10px] text-[#848e9c]">
              <span>
                {new Date(e.ts).toLocaleString()} · {e.symbol}
                {e.pnlTag != null && (
                  <span className={e.pnlTag >= 0 ? ' text-[#0ecb81]' : ' text-[#f6465d]'}>
                    {' '}
                    {e.pnlTag >= 0 ? '+' : ''}
                    {e.pnlTag}
                  </span>
                )}
              </span>
              <span className="flex gap-2">
                {e.chartTimeSec != null && (
                  <button
                    type="button"
                    className="text-[#f0b90b] hover:underline"
                    onClick={() => requestFocus(e.chartTimeSec!, { padSec: 600 })}
                  >
                    Chart
                  </button>
                )}
                <button
                  type="button"
                  className="text-[#f6465d] hover:underline"
                  onClick={() => remove(e.id)}
                >
                  ×
                </button>
              </span>
            </div>
            <div className="text-[#eaecef] whitespace-pre-wrap">{e.note}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
