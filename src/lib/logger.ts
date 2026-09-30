/**
 * Structured client logger – ring buffer + console in DEV.
 * No external telemetry dependency; exportable for support.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  ts: number
  level: LogLevel
  scope: string
  message: string
  data?: unknown
}

const MAX = 200
const buffer: LogEntry[] = []
const listeners = new Set<(e: LogEntry) => void>()

function push(entry: LogEntry) {
  buffer.push(entry)
  if (buffer.length > MAX) buffer.shift()
  for (const fn of listeners) {
    try {
      fn(entry)
    } catch {
      /* */
    }
  }
  const isDev =
    typeof import.meta !== 'undefined' &&
    Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV)
  if (isDev || entry.level === 'error' || entry.level === 'warn') {
    const line = `[${entry.scope}] ${entry.message}`
    if (entry.level === 'error') console.error(line, entry.data ?? '')
    else if (entry.level === 'warn') console.warn(line, entry.data ?? '')
    else if (isDev) console.debug(line, entry.data ?? '')
  }
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, data?: unknown) =>
      push({ ts: Date.now(), level: 'debug', scope, message, data }),
    info: (message: string, data?: unknown) =>
      push({ ts: Date.now(), level: 'info', scope, message, data }),
    warn: (message: string, data?: unknown) =>
      push({ ts: Date.now(), level: 'warn', scope, message, data }),
    error: (message: string, data?: unknown) =>
      push({ ts: Date.now(), level: 'error', scope, message, data }),
  }
}

export function getLogBuffer(): readonly LogEntry[] {
  return buffer
}

export function clearLogBuffer() {
  buffer.length = 0
}

export function subscribeLogs(fn: (e: LogEntry) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}
