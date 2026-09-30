/**
 * Error telemetry – optional Sentry envelope when VITE_SENTRY_DSN is set.
 * No SDK dependency: keeps bundle lean; enable via env in production.
 */

type Severity = 'fatal' | 'error' | 'warning' | 'info'

interface CaptureContext {
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  level?: Severity
}

const QUEUE: Array<{ message: string; stack?: string; ctx?: CaptureContext }> = []
let dsnParsed: { publicKey: string; host: string; projectId: string } | null | undefined

function parseDsn(dsn: string) {
  try {
    const u = new URL(dsn)
    const publicKey = u.username
    const projectId = u.pathname.replace(/^\//, '').split('/')[0]
    if (!publicKey || !projectId) return null
    return { publicKey, host: u.host, projectId }
  } catch {
    return null
  }
}

function getDsn() {
  if (dsnParsed !== undefined) return dsnParsed
  const raw =
    typeof import.meta !== 'undefined'
      ? (import.meta.env?.VITE_SENTRY_DSN as string | undefined)
      : undefined
  dsnParsed = raw && raw.trim() ? parseDsn(raw.trim()) : null
  return dsnParsed
}

async function sendToSentry(
  message: string,
  stack?: string,
  ctx?: CaptureContext
): Promise<void> {
  const dsn = getDsn()
  if (!dsn) return
  const event = {
    event_id: crypto.randomUUID?.().replace(/-/g, '') ?? String(Date.now()),
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: ctx?.level ?? 'error',
    message,
    exception: stack
      ? {
          values: [
            {
              type: 'Error',
              value: message,
              stacktrace: { frames: [{ filename: 'app', function: 'capture', lineno: 0 }] },
            },
          ],
        }
      : undefined,
    tags: { app: 'trading-terminal', ...ctx?.tags },
    extra: ctx?.extra,
    environment:
      (typeof import.meta !== 'undefined' && import.meta.env?.MODE) || 'production',
  }
  const url = `https://${dsn.host}/api/${dsn.projectId}/store/`
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.publicKey}`,
      },
      body: JSON.stringify(event),
      keepalive: true,
    })
  } catch {
    /* offline / blocked */
  }
}

export function initTelemetry(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (ev) => {
    void captureException(ev.error ?? ev.message)
  })
  window.addEventListener('unhandledrejection', (ev) => {
    void captureException(ev.reason)
  })
  for (const item of QUEUE.splice(0)) {
    void sendToSentry(item.message, item.stack, item.ctx)
  }
}

export function captureException(err: unknown, ctx?: CaptureContext): void {
  let message = 'Unknown error'
  let stack: string | undefined
  if (err instanceof Error) {
    message = err.message
    stack = err.stack
  } else if (typeof err === 'string') {
    message = err
  } else {
    try {
      message = JSON.stringify(err)
    } catch {
      message = String(err)
    }
  }
  if (typeof console !== 'undefined') {
    console.error('[telemetry]', message, ctx?.extra ?? '')
  }
  const dsn = getDsn()
  if (!dsn) {
    QUEUE.push({ message, stack, ctx })
    return
  }
  void sendToSentry(message, stack, ctx)
}

export function captureMessage(message: string, ctx?: CaptureContext): void {
  if (typeof console !== 'undefined') console.info('[telemetry]', message)
  void sendToSentry(message, undefined, { ...ctx, level: ctx?.level ?? 'info' })
}

export function isTelemetryEnabled(): boolean {
  return !!getDsn()
}
