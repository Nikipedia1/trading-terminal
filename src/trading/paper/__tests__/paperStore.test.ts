import { describe, it, expect, beforeEach } from 'vitest'

const mem = new Map<string, string>()

const localStorageMock = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => {
    mem.set(k, v)
  },
  removeItem: (k: string) => {
    mem.delete(k)
  },
  clear: () => mem.clear(),
}

// @ts-expect-error test polyfill
globalThis.localStorage = localStorageMock

describe('paperStore', () => {
  beforeEach(() => {
    mem.clear()
  })

  it('rejects market order without price', async () => {
    const { usePaperStore } = await import('../paperStore')
    usePaperStore.getState().resetAccount(10_000)
    const r = usePaperStore.getState().placeOrder({
      symbol: 'BTCUSDT',
      side: 'long',
      type: 'market',
      qty: 0.01,
      leverage: 5,
      markPrice: 0,
    })
    expect(r.ok).toBe(false)
  })

  it('opens market long and reduces balance by margin', async () => {
    const { usePaperStore } = await import('../paperStore')
    usePaperStore.getState().resetAccount(10_000)
    const r = usePaperStore.getState().placeOrder({
      symbol: 'BTCUSDT',
      side: 'long',
      type: 'market',
      qty: 0.1,
      leverage: 10,
      markPrice: 1000,
    })
    expect(r.ok).toBe(true)
    const s = usePaperStore.getState()
    expect(s.positions.length).toBe(1)
    expect(s.account.balance).toBeLessThan(10_000)
    expect(s.fills.length).toBeGreaterThanOrEqual(1)
  })

  it('bindWalletAccount isolates books', async () => {
    const { usePaperStore } = await import('../paperStore')
    usePaperStore.getState().resetAccount(5_000)
    usePaperStore.getState().placeOrder({
      symbol: 'ETHUSDT',
      side: 'long',
      type: 'market',
      qty: 1,
      leverage: 5,
      markPrice: 100,
    })
    usePaperStore.getState().bindWalletAccount('acc-b')
    expect(usePaperStore.getState().positions.length).toBe(0)
    usePaperStore.getState().bindWalletAccount('main')
    expect(usePaperStore.getState().walletAccountId).toBeTruthy()
  })
})
