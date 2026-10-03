/**
 * Calendario – real macro events from GET /api/calendar (biquote upstream).
 * previous / forecast / actual · impact low|medium|high.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CalendarApiResponse, MacroCalendarEvent, MacroImpact } from './types'
import { useCalendarStore } from '@/stores/calendarStore'

const IMPACT_FILTERS: { id: MacroImpact | 'all'; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'high', label: 'Alto' },
  { id: 'medium', label: 'Medio' },
  { id: 'low', label: 'Basso' },
]

const IMPACT_STYLE: Record<MacroImpact, string> = {
  high: 'bg-terminal-red/20 text-terminal-red border-terminal-red/40',
  medium: 'bg-[#f0b90b]/15 text-[#f0b90b] border-[#f0b90b]/40',
  low: 'bg-[#1e2329] text-[#848e9c] border-[#2b3139]',
}

function formatWhen(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return '—'
  try {
    return new Date(ms).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function dayKey(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return iso
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function val(v: string | null | undefined): string {
  if (v == null || v === '') return '—'
  return v
}

export function CalendarPanel() {
  const events = useCalendarStore((s) => s.events)
  const loading = useCalendarStore((s) => s.loading)
  const error = useCalendarStore((s) => s.error)
  const fetchedAt = useCalendarStore((s) => s.fetchedAt)
  const impactFilter = useCalendarStore((s) => s.impactFilter)
  const showLines = useCalendarStore((s) => s.showHighImpactLines)
  const setEvents = useCalendarStore((s) => s.setEvents)
  const setLoading = useCalendarStore((s) => s.setLoading)
  const setError = useCalendarStore((s) => s.setError)
  const setImpactFilter = useCalendarStore((s) => s.setImpactFilter)
  const setShowLines = useCalendarStore((s) => s.setShowHighImpactLines)

  const [localMsg, setLocalMsg] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setLocalMsg(null)
    try {
      const res = await fetch('/api/calendar', {
        signal,
        headers: { Accept: 'application/json' },
      })
      const data = (await res.json()) as CalendarApiResponse
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      if (!Array.isArray(data.events)) {
        throw new Error('Invalid calendar payload')
      }
      setEvents(data.events, data.fetchedAt ?? null)
      if (data.error) setLocalMsg(data.error)
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return
      const msg = e instanceof Error ? e.message : 'Calendar fetch failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [setEvents, setError, setLoading])

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    const id = window.setInterval(() => void load(), 120_000)
    return () => {
      ac.abort()
      window.clearInterval(id)
    }
  }, [load])

  const filtered = useMemo(() => {
    if (impactFilter === 'all') return events
    return events.filter((e) => e.impact === impactFilter)
  }, [events, impactFilter])

  const byDay = useMemo(() => {
    const map = new Map<string, MacroCalendarEvent[]>()
    for (const e of filtered) {
      const k = dayKey(e.time)
      const list = map.get(k) ?? []
      list.push(e)
      map.set(k, list)
    }
    return [...map.entries()]
  }, [filtered])

  const highCount = events.filter((e) => e.impact === 'high').length

  return (
    <div className="flex flex-col h-full min-h-0 text-[11px] bg-terminal-panel text-terminal-text">
      <div className="px-2 py-1.5 border-b border-terminal-border shrink-0 flex flex-wrap items-center gap-1">
        <span className="font-semibold text-[#eaecef] mr-1">Calendario</span>
        {IMPACT_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`text-xxs px-1.5 py-0.5 rounded border transition-colors ${
              impactFilter === f.id
                ? 'bg-[#1e2329] text-[#f0b90b] border-[#f0b90b]/50'
                : 'text-terminal-muted border-terminal-border hover:text-terminal-text'
            }`}
            onClick={() => setImpactFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          className="text-xxs px-1.5 py-0.5 rounded border border-terminal-border text-terminal-muted hover:text-[#f0b90b] disabled:opacity-40"
          onClick={() => void load()}
          disabled={loading}
          title="Aggiorna"
        >
          {loading ? '…' : '↻'}
        </button>
        <label
          className="ml-1 flex items-center gap-1 text-[9px] text-[#848e9c] cursor-pointer"
          title="Linee verticali sul grafico per eventi ad alto impatto"
        >
          <input
            type="checkbox"
            className="accent-[#f0b90b]"
            checked={showLines}
            onChange={(e) => setShowLines(e.target.checked)}
          />
          linee chart
        </label>
        <span className="ml-auto text-terminal-muted text-[10px]">
          {filtered.length}/{events.length}
          {highCount ? ` · ${highCount} high` : ''}
        </span>
      </div>

      {(error || localMsg) && (
        <div className="px-2 py-1 text-[10px] text-terminal-red border-b border-terminal-red/30 shrink-0">
          {error || localMsg}
          {!error && localMsg ? '' : ' — verifica Pages Function /api/calendar'}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-terminal-muted">
            {loading
              ? 'Caricamento eventi macro…'
              : error
                ? 'Nessun evento (API non raggiungibile).'
                : 'Nessun evento in questo intervallo / filtro.'}
          </div>
        ) : (
          byDay.map(([day, list]) => (
            <div key={day}>
              <div className="sticky top-0 z-[1] px-2 py-1 text-[9px] uppercase tracking-wide text-[#848e9c] bg-[#0d1117]/95 border-b border-terminal-border/40">
                {day}
              </div>
              <ul className="divide-y divide-terminal-border/50">
                {list.map((e) => (
                  <li key={e.id} className="px-2 py-2 hover:bg-[#12161c]/80">
                    <div className="flex items-start gap-2">
                      <span
                        className={`shrink-0 mt-0.5 text-[9px] px-1 py-px rounded border ${IMPACT_STYLE[e.impact]}`}
                      >
                        {e.impact === 'high'
                          ? 'ALTO'
                          : e.impact === 'medium'
                            ? 'MEDIO'
                            : 'BASSO'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[#eaecef] font-medium leading-snug">{e.name}</div>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-terminal-muted">
                          <span>{formatWhen(e.time)}</span>
                          {e.currency && <span className="text-[#f0b90b]/80">{e.currency}</span>}
                          {e.country && <span>{e.country}</span>}
                        </div>
                        <div className="mt-1 grid grid-cols-3 gap-1 text-[10px]">
                          <div className="rounded bg-[#0b0e11] border border-[#2b3139] px-1.5 py-1">
                            <div className="text-[9px] text-[#5e6673]">Prec.</div>
                            <div className="font-mono-nums text-[#c8cdd3]">{val(e.previous)}</div>
                          </div>
                          <div className="rounded bg-[#0b0e11] border border-[#2b3139] px-1.5 py-1">
                            <div className="text-[9px] text-[#5e6673]">Previsto</div>
                            <div className="font-mono-nums text-[#c8cdd3]">{val(e.forecast)}</div>
                          </div>
                          <div className="rounded bg-[#0b0e11] border border-[#2b3139] px-1.5 py-1">
                            <div className="text-[9px] text-[#5e6673]">Effettivo</div>
                            <div
                              className={`font-mono-nums ${
                                e.actual != null ? 'text-[#f0b90b]' : 'text-[#5e6673]'
                              }`}
                            >
                              {val(e.actual)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {fetchedAt && (
        <div className="px-2 py-0.5 text-[9px] text-[#5e6673] border-t border-terminal-border shrink-0">
          Aggiornato {formatWhen(fetchedAt)} · dati reali (biquote)
        </div>
      )}
    </div>
  )
}
