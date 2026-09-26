/**
 * Unit tests for orderBookFeed – mock fetch + WebSocket only.
 * Never hits real exchange endpoints.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock ReconnectingWebSocket so we control messages / status ──────────────
type StatusCb = (s: string, detail?: string) => void
type MessageCb = (data: unknown, raw: string) => void
type ErrorCb = (msg: string) => void

interface MockRwsInstance {
  connect: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  _onStatus?: StatusCb
  _onMessage?: MessageCb
  _onError?: ErrorCb
  _urlFactory?: () => Promise<string>
  /** test helpers */
  emitStatus: (s: string, detail?: string) => void
  emitMessage: (data: unknown) => void
  emitError: (msg: string) => void
}

const mockInstances: MockRwsInstance[] = []

vi.mock('@/data/ws/reconnecting-ws', () => {
  class ReconnectingWebSocket {
    connect = vi.fn(async () => {
      // default: go connected after microtask so callers can attach handlers
      queueMicrotask(() => this.emitStatus('connected'))
    })
    close = vi.fn()
    send = vi.fn()
    private _onStatus?: StatusCb
    private _onMessage?: MessageCb
    private _onError?: ErrorCb
    private _urlFactory?: () => Promise<string>

    constructor(
      _url: string,
      opts: {
        onStatus?: StatusCb
        onMessage: MessageCb
        onError?: ErrorCb
        urlFactory?: () => Promise<string>
      }
    ) {
      this._onStatus = opts.onStatus
      this._onMessage = opts.onMessage
      this._onError = opts.onError
      this._urlFactory = opts.urlFactory
      const inst: MockRwsInstance = {
        connect: this.connect,
        close: this.close,
        send: this.send,
        _onStatus: opts.onStatus,
        _onMessage: opts.onMessage,
        _onError: opts.onError,
        _urlFactory: opts.urlFactory,
        emitStatus: (s, d) => this.emitStatus(s, d),
        emitMessage: (data) => this.emitMessage(data),
        emitError: (m) => this.emitError(m),
      }
      mockInstances.push(inst)
    }

    emitStatus(s: string, detail?: string) {
      this._onStatus?.(s, detail)
    }
    emitMessage(data: unknown) {
      this._onMessage?.(data, JSON.stringify(data))
    }
    emitError(msg: string) {
      this._onError?.(msg)
    }
  }
  return { ReconnectingWebSocket }
})

import { subscribeOrderBookFeed, activeOrderBookFeedKeys } from '../orderBookFeed'

function lastRws(): MockRwsInstance {
  const inst = mockInstances[mockInstances.length - 1]
  if (!inst) throw new Error('no ReconnectingWebSocket instance')
  return inst
}

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

/** Wait past the 50ms delay inside Binance resync */
function waitResyncDelay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 80))
}

describe('orderBookFeed', () => {
  beforeEach(() => {
    mockInstances.length = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('fetch not mocked for this test')))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // ── Binance: snapshot REST + buffer application ───────────────────────────

  it('Binance: applies REST snapshot then buffered diffs when U/u bridge lastUpdateId', async () => {
    const books: any[] = []
    const statuses: any[] = []

    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (String(url).includes('/api/v3/depth')) {
        return {
          ok: true,
          json: async () => ({
            lastUpdateId: 100,
            bids: [
              ['50000.0', '1.5'],
              ['49999.0', '2.0'],
            ],
            asks: [
              ['50001.0', '1.0'],
              ['50002.0', '3.0'],
            ],
          }),
        }
      }
      throw new Error(`unexpected fetch ${url}`)
    })

    const sub = subscribeOrderBookFeed('binance', 'BTCUSDT', {
      onBook: (b) => books.push(b),
      onStatus: (s) => statuses.push(s),
    })

    await flush() // connect → status connected → resync starts
    const rws = lastRws()

    // Buffer a diff that arrives BEFORE snapshot completes (while !synced)
    rws.emitMessage({
      e: 'depthUpdate',
      U: 101,
      u: 102,
      b: [['50000.0', '2.0']], // qty update
      a: [],
    })

    await waitResyncDelay()
    await flush()

    expect(books.length).toBeGreaterThanOrEqual(1)
    const snap = books[books.length - 1]
    expect(snap.ready).toBe(true)
    expect(snap.lastUpdateId).toBe(102)
    expect(snap.bids[0].price).toBe(50000)
    expect(snap.bids[0].qty).toBe(2) // buffer applied over snapshot
    expect(
      statuses.some((s) => s.status === 'connected' && s.detail?.includes('synced'))
    ).toBe(true)

    sub.unsubscribe()
  })

  // ── Binance: gap detection (U > lastUpdateId+1 → resync) ──────────────────

  it('Binance: U > lastUpdateId+1 triggers resync', async () => {
    let depthCalls = 0
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (String(url).includes('/api/v3/depth')) {
        depthCalls += 1
        const id = depthCalls === 1 ? 100 : 200
        return {
          ok: true,
          json: async () => ({
            lastUpdateId: id,
            bids: [['50000.0', '1']],
            asks: [['50001.0', '1']],
          }),
        }
      }
      throw new Error(`unexpected fetch ${url}`)
    })

    const books: any[] = []
    const sub = subscribeOrderBookFeed('binance', 'ETHUSDT', {
      onBook: (b) => books.push(b),
    })

    await flush()
    await waitResyncDelay()
    await flush()
    expect(depthCalls).toBe(1)
    expect(books.at(-1)?.ready).toBe(true)
    expect(books.at(-1)?.lastUpdateId).toBe(100)

    const rws = lastRws()
    // Gap: U jumps past lastUpdateId+1
    rws.emitMessage({
      e: 'depthUpdate',
      U: 150, // 150 > 100+1
      u: 151,
      b: [['50000.0', '9']],
      a: [],
    })

    await waitResyncDelay()
    await flush()

    expect(depthCalls).toBe(2) // second snapshot
    expect(books.at(-1)?.lastUpdateId).toBe(200)
    expect(books.at(-1)?.ready).toBe(true)

    sub.unsubscribe()
  })

  // ── Binance: discard stale (u <= lastUpdateId) ────────────────────────────

  it('Binance: discards stale messages where u <= lastUpdateId', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (String(url).includes('/api/v3/depth')) {
        return {
          ok: true,
          json: async () => ({
            lastUpdateId: 100,
            bids: [['50000.0', '1']],
            asks: [['50001.0', '1']],
          }),
        }
      }
      throw new Error(`unexpected fetch ${url}`)
    })

    const books: any[] = []
    const sub = subscribeOrderBookFeed('binance', 'SOLUSDT', {
      onBook: (b) => books.push(b),
    })

    await flush()
    await waitResyncDelay()
    await flush()
    const countAfterSync = books.length
    expect(books.at(-1)?.lastUpdateId).toBe(100)

    const rws = lastRws()
    // Stale: u <= 100
    rws.emitMessage({
      e: 'depthUpdate',
      U: 90,
      u: 99,
      b: [['50000.0', '99']],
      a: [],
    })
    await flush()

    // No new publish (or same lastUpdateId)
    expect(books.length).toBe(countAfterSync)
    expect(books.at(-1)?.bids[0].qty).toBe(1) // unchanged

    // Valid next message
    rws.emitMessage({
      e: 'depthUpdate',
      U: 101,
      u: 101,
      b: [['50000.0', '5']],
      a: [],
    })
    await flush()

    expect(books.at(-1)?.lastUpdateId).toBe(101)
    expect(books.at(-1)?.bids[0].qty).toBe(5)

    sub.unsubscribe()
  })

  // ── KuCoin: sequenceStart misaligned → resync ─────────────────────────────

  it('KuCoin: sequenceStart > lastUpdateId+1 triggers resync', async () => {
    let snapshotCalls = 0
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string, init?: RequestInit) => {
        const u = String(url)
        if (u.includes('bullet-public') && init?.method === 'POST') {
          return {
            ok: true,
            json: async () => ({
              code: '200000',
              data: {
                token: 'fake-token',
                instanceServers: [{ endpoint: 'wss://fake.kucoin', pingInterval: 18000 }],
              },
            }),
          }
        }
        if (u.includes('level2_100')) {
          snapshotCalls += 1
          const seq = snapshotCalls === 1 ? 1000 : 2000
          return {
            ok: true,
            json: async () => ({
              code: '200000',
              data: {
                sequence: String(seq),
                bids: [['50000.0', '1']],
                asks: [['50001.0', '1']],
              },
            }),
          }
        }
        throw new Error(`unexpected fetch ${u}`)
      }
    )

    const books: any[] = []
    const sub = subscribeOrderBookFeed('kucoin', 'BTCUSDT', {
      onBook: (b) => books.push(b),
    })

    await flush()
    // urlFactory runs on connect; mock connects immediately
    await flush()
    // resync after connected
    await flush()

    expect(snapshotCalls).toBe(1)
    expect(books.at(-1)?.ready).toBe(true)
    expect(books.at(-1)?.lastUpdateId).toBe(1000)

    const rws = lastRws()
    // Misaligned sequenceStart
    rws.emitMessage({
      type: 'message',
      topic: '/market/level2:BTC-USDT',
      data: {
        sequenceStart: 1500, // > 1000+1
        sequenceEnd: 1501,
        changes: { bids: [['50000.0', '9']], asks: [] },
      },
    })

    await flush()
    await flush()

    expect(snapshotCalls).toBe(2)
    expect(books.at(-1)?.lastUpdateId).toBe(2000)
    expect(books.at(-1)?.ready).toBe(true)

    sub.unsubscribe()
  })

  // ── KuCoin: buffer applied after snapshot ─────────────────────────────────

  it('KuCoin: buffers messages until snapshot then applies those with sequenceEnd > seq', async () => {
    let resolveSnap!: (v: unknown) => void
    const snapPromise = new Promise((r) => {
      resolveSnap = r
    })

    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string, init?: RequestInit) => {
        const u = String(url)
        if (u.includes('bullet-public') && init?.method === 'POST') {
          return {
            ok: true,
            json: async () => ({
              code: '200000',
              data: {
                token: 'tok',
                instanceServers: [{ endpoint: 'wss://fake', pingInterval: 18000 }],
              },
            }),
          }
        }
        if (u.includes('level2_100')) {
          await snapPromise
          return {
            ok: true,
            json: async () => ({
              code: '200000',
              data: {
                sequence: '500',
                bids: [['100.0', '1']],
                asks: [['101.0', '1']],
              },
            }),
          }
        }
        throw new Error(`unexpected ${u}`)
      }
    )

    const books: any[] = []
    const sub = subscribeOrderBookFeed('kucoin', 'ETHUSDT', {
      onBook: (b) => books.push(b),
    })

    await flush()
    await flush()

    const rws = lastRws()
    // Arrive while !synced (snapshot still pending)
    rws.emitMessage({
      type: 'message',
      topic: '/market/level2:ETH-USDT',
      data: {
        sequenceStart: 501,
        sequenceEnd: 501,
        changes: { bids: [['100.0', '7']], asks: [] },
      },
    })

    resolveSnap(undefined)
    await flush()
    await flush()

    expect(books.at(-1)?.ready).toBe(true)
    expect(books.at(-1)?.lastUpdateId).toBe(501)
    expect(books.at(-1)?.bids[0].qty).toBe(7)

    sub.unsubscribe()
  })
})
