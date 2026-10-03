/**
 * In-process ops metrics – API latency, error rates, WS events.
 * Exportable for support; optional Sentry tags via captureMessage.
 */

export interface MetricSample {
  name: string
  value: number
  ts: number
  tags?: Record<string, string>
}

interface Counter {
  count: number
  errors: number
  totalMs: number
  lastMs: number
  lastError?: string
  lastAt?: number
}

const counters = new Map<string, Counter>()
const samples: MetricSample[] = []
const MAX_SAMPLES = 500

function ensure(name: string): Counter {
  let c = counters.get(name)
  if (!c) {
    c = { count: 0, errors: 0, totalMs: 0, lastMs: 0 }
    counters.set(name, c)
  }
  return c
}

export function recordApiCall(
  route: string,
  durationMs: number,
  ok: boolean,
  error?: string
) {
  const c = ensure(`api:${route}`)
  c.count++
  c.totalMs += durationMs
  c.lastMs = durationMs
  c.lastAt = Date.now()
  if (!ok) {
    c.errors++
    c.lastError = (error || 'error').slice(0, 120)
  }
  samples.push({
    name: `api:${route}`,
    value: durationMs,
    ts: Date.now(),
    tags: { ok: String(ok) },
  })
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES)
}

export function recordWsEvent(channel: string, kind: 'message' | 'reconnect' | 'error') {
  const c = ensure(`ws:${channel}:${kind}`)
  c.count++
  c.lastAt = Date.now()
  if (kind === 'error') c.errors++
}

export async function timedFetch(
  routeLabel: string,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const t0 = performance.now()
  try {
    const res = await fetch(input, init)
    recordApiCall(routeLabel, performance.now() - t0, res.ok, res.ok ? undefined : `HTTP ${res.status}`)
    return res
  } catch (e: any) {
    recordApiCall(routeLabel, performance.now() - t0, false, e?.message)
    throw e
  }
}

export function getMetricsSnapshot() {
  const rows: Array<{
    name: string
    count: number
    errors: number
    errorRate: number
    avgMs: number
    lastMs: number
    lastError?: string
    lastAt?: number
  }> = []
  for (const [name, c] of counters) {
    rows.push({
      name,
      count: c.count,
      errors: c.errors,
      errorRate: c.count ? c.errors / c.count : 0,
      avgMs: c.count ? c.totalMs / c.count : 0,
      lastMs: c.lastMs,
      lastError: c.lastError,
      lastAt: c.lastAt,
    })
  }
  rows.sort((a, b) => a.name.localeCompare(b.name))
  return { rows, sampleCount: samples.length, generatedAt: Date.now() }
}

export function resetMetrics() {
  counters.clear()
  samples.length = 0
}
