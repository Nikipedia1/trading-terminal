/**
 * GET /api/calendar – real macro economic calendar (no synthetic events).
 * Upstream: biquote.io free JSON calendar (MQL5-sourced schedule + prints).
 * Query: from, to (YYYY-MM-DD), countries (default US,EU,GB,JP), importance.
 * Cache-Control: 120s.
 */

import { cors, type Env } from './auth/_shared'

export interface CalendarEventDto {
  id: string
  time: string
  country: string
  currency: string
  name: string
  impact: 'low' | 'medium' | 'high'
  previous: string | null
  forecast: string | null
  actual: string | null
  unit?: string | null
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function mapImportance(raw: string | undefined): 'low' | 'medium' | 'high' {
  const v = (raw || '').toLowerCase()
  if (v === 'high') return 'high'
  if (v === 'medium' || v === 'moderate') return 'medium'
  return 'low'
}

function fmtValue(v: unknown, digits?: number): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = typeof digits === 'number' ? digits : 2
    return String(Number(v.toFixed(d)))
  }
  const s = String(v).trim()
  return s || null
}

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url)
  const now = new Date()
  const from =
    url.searchParams.get('from') ||
    isoDate(new Date(now.getTime() - 2 * 86400000))
  const to =
    url.searchParams.get('to') ||
    isoDate(new Date(now.getTime() + 14 * 86400000))
  const countries =
    url.searchParams.get('countries') || 'US,EU,GB,JP,CA,AU'
  const importance = url.searchParams.get('importance') || ''

  const upstream = new URL('https://biquote.io/api/calendar')
  upstream.searchParams.set('from', from)
  upstream.searchParams.set('to', to)
  upstream.searchParams.set('countries', countries)
  if (importance) upstream.searchParams.set('importance', importance)

  try {
    const res = await fetch(upstream.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'TradingTerminalCalendar/1.0 (+https://github.com/Nikipedia1/trading-terminal)',
      },
      cf: { cacheTtl: 120, cacheEverything: true },
    } as RequestInit)

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: `upstream HTTP ${res.status}`,
          events: [],
          fetchedAt: new Date().toISOString(),
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...cors(ctx.request),
          },
        }
      )
    }

    const data = (await res.json()) as unknown
    const list = Array.isArray(data) ? data : []
    const events: CalendarEventDto[] = []

    for (const row of list) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const time = String(r.time ?? '')
      const name = String(r.name ?? '').trim()
      if (!time || !name) continue
      const id = String(r.id ?? r.eventId ?? `${time}:${name}`)
      events.push({
        id,
        time,
        country: String(r.countryCode ?? r.country ?? ''),
        currency: String(r.currency ?? ''),
        name,
        impact: mapImportance(String(r.importance ?? r.impact ?? '')),
        previous: fmtValue(r.previous, r.digits as number | undefined),
        forecast: fmtValue(r.forecast, r.digits as number | undefined),
        actual: fmtValue(r.actual, r.digits as number | undefined),
        unit: r.unit != null ? String(r.unit) : null,
      })
    }

    events.sort((a, b) => Date.parse(a.time) - Date.parse(b.time))

    return new Response(
      JSON.stringify({
        events,
        fetchedAt: new Date().toISOString(),
        from,
        to,
        source: 'biquote',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=120, s-maxage=120',
          ...cors(ctx.request),
        },
      }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'calendar fetch failed',
        events: [],
        fetchedAt: new Date().toISOString(),
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          ...cors(ctx.request),
        },
      }
    )
  }
}
