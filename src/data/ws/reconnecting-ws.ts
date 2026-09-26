/**
 * ReconnectingWebSocket – exponential backoff, intentional-close flag.
 * Real sockets only. No mock message injection.
 */

export type WsStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

export interface ReconnectingWsOptions {
  /** Initial backoff ms (default 1000) */
  minBackoffMs?: number
  /** Max backoff ms (default 30000) */
  maxBackoffMs?: number
  /** Called on every status transition */
  onStatus?: (status: WsStatus, detail?: string) => void
  /** Called with parsed JSON (or raw string if parse fails – caller decides) */
  onMessage: (data: unknown, raw: string) => void
  /** Called on hard errors (not on routine reconnect) */
  onError?: (message: string) => void
  /** Optional: build URL fresh on each connect (e.g. KuCoin bullet token) */
  urlFactory?: () => Promise<string>
}

export class ReconnectingWebSocket {
  private url: string
  private opts: ReconnectingWsOptions
  private ws: WebSocket | null = null
  private intentionalClose = false
  private attempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private status: WsStatus = 'disconnected'

  constructor(url: string, opts: ReconnectingWsOptions) {
    this.url = url
    this.opts = opts
  }

  getStatus(): WsStatus {
    return this.status
  }

  private setStatus(s: WsStatus, detail?: string) {
    this.status = s
    this.opts.onStatus?.(s, detail)
  }

  async connect() {
    this.intentionalClose = false
    await this.open()
  }

  private async open() {
    if (this.intentionalClose) return

    this.setStatus(this.attempt > 0 ? 'reconnecting' : 'connecting', `attempt ${this.attempt + 1}`)

    let url = this.url
    if (this.opts.urlFactory) {
      try {
        url = await this.opts.urlFactory()
        this.url = url
      } catch (e: any) {
        this.setStatus('error', e.message)
        this.opts.onError?.(e.message || 'Failed to resolve WS URL')
        this.scheduleReconnect()
        return
      }
    }

    try {
      const ws = new WebSocket(url)
      this.ws = ws

      ws.onopen = () => {
        this.attempt = 0
        this.setStatus('connected')
      }

      ws.onmessage = (ev) => {
        const raw = typeof ev.data === 'string' ? ev.data : String(ev.data)
        try {
          const data = JSON.parse(raw)
          this.opts.onMessage(data, raw)
        } catch {
          this.opts.onMessage(raw, raw)
        }
      }

      ws.onerror = () => {
        // browser WS error events are opaque; close will follow
        this.opts.onError?.('WebSocket error')
      }

      ws.onclose = () => {
        this.ws = null
        if (this.intentionalClose) {
          this.setStatus('disconnected')
          return
        }
        this.setStatus('reconnecting', 'socket closed')
        this.scheduleReconnect()
      }
    } catch (e: any) {
      this.setStatus('error', e.message)
      this.opts.onError?.(e.message || 'WebSocket construct failed')
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.intentionalClose) return
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)

    const min = this.opts.minBackoffMs ?? 1000
    const max = this.opts.maxBackoffMs ?? 30_000
    const delay = Math.min(max, min * Math.pow(2, this.attempt))
    // jitter ±20%
    const jitter = delay * (0.8 + Math.random() * 0.4)
    this.attempt += 1

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.open()
    }, jitter)
  }

  send(data: string | object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data))
    }
  }

  /** Stop reconnecting and close */
  close() {
    this.intentionalClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        /* ignore */
      }
      this.ws = null
    }
    this.setStatus('disconnected')
  }
}
