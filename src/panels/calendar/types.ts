export type MacroImpact = 'low' | 'medium' | 'high'

export interface MacroCalendarEvent {
  id: string
  /** ISO-8601 UTC */
  time: string
  country: string
  currency: string
  name: string
  impact: MacroImpact
  previous: string | null
  forecast: string | null
  actual: string | null
  unit?: string | null
}

export interface CalendarApiResponse {
  events: MacroCalendarEvent[]
  fetchedAt?: string
  from?: string
  to?: string
  source?: string
  error?: string
}
