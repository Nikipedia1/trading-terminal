/**
 * Paper trading store – simulated futures-style account.
 * Fills and marks use real market prices passed in by the UI (from marketStore ticker).
 * Never invents prices. Persists to localStorage.
 */

import { create } from 'zustand'
import type {
  PaperAccount,
  PaperFill,
  PaperOrder,
  PaperOrderType,
  PaperPosition,
  PaperSide,
} from './types'

const STORAGE_KEY = 'tt-paper:v1'
const DEFAULT_BALANCE = 10_000
const MAX_LEVERAGE = 125
const MIN_LEVERAGE = 1

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

interface Persisted {
  account: PaperAccount
  positions: PaperPosition[]
  orders: PaperOrder[]
  fills: PaperFill[]
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) throw new Error('empty')
    const parsed = JSON.parse(raw) as Persisted
    if (!parsed?.account || typeof parsed.account.balance !== 'number') throw new Error('bad')
    return {
      account: parsed.account,
      positions: Array.isArray(parsed.positions) ? parsed.positions : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      fills: Array.isArray(parsed.fills) ? parsed.fills : [],
    }
  } catch {
    return {
      account: { balance: DEFAULT_BALANCE, initialBalance: DEFAULT_BALANCE },
      positions: [],
      orders: [],
      fills: [],
    }
  }
}

function persist(state: Pick<PaperState, 'account' | 'positions' | 'orders' | 'fills'>) {
  try {
    const data: Persisted = {
      account: state.account,
      positions: state.positions,
      orders: state.orders,
      fills: state.fills.slice(0, 200),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* quota / private mode */
  }
}

export interface PlaceOrderInput {
  symbol: string
  side: PaperSide
  type: PaperOrderType
  /** Base qty */
  qty: number
  leverage: number
  /** Required for limit */
  price?: number | null
  /** Current real market last price – required for market fill */
  markPrice: number
}

interface PaperState {
  account: PaperAccount
  positions: PaperPosition[]
  orders: PaperOrder[]
  fills: PaperFill[]
  lastError: string | null

  placeOrder: (input: PlaceOrderInput) => { ok: true } | { ok: false; error: string }
  cancelOrder: (orderId: string) => void
  closePosition: (positionId: string, markPrice: number) => { ok: true } | { ok: false; error: string }
  /** Update mark prices on open positions from real ticker */
  markToMarket: (symbol: string, markPrice: number) => void
  /** Try fill open limit orders against real last price */
  tryFillLimits: (symbol: string, lastPrice: number) => void
  resetAccount: (balance?: number) => void
  clearError: () => void
}

function clampLeverage(lev: number): number {
  if (!Number.isFinite(lev)) return MIN_LEVERAGE
  return Math.min(MAX_LEVERAGE, Math.max(MIN_LEVERAGE, Math.round(lev)))
}

function unrealizedPnl(pos: PaperPosition, mark: number): number {
  const diff = pos.side === 'long' ? mark - pos.entryPrice : pos.entryPrice - mark
  return diff * pos.qty
}

const initial = load()

export const usePaperStore = create<PaperState>((set, get) => ({
  account: initial.account,
  positions: initial.positions,
  orders: initial.orders,
  fills: initial.fills,
  lastError: null,

  clearError: () => set({ lastError: null }),

  resetAccount: (balance = DEFAULT_BALANCE) => {
    const next = {
      account: { balance, initialBalance: balance },
      positions: [] as PaperPosition[],
      orders: [] as PaperOrder[],
      fills: [] as PaperFill[],
      lastError: null,
    }
    set(next)
    persist(next)
  },

  placeOrder: (input) => {
    const { symbol, side, type } = input
    const qty = Number(input.qty)
    const leverage = clampLeverage(input.leverage)
    const markPrice = Number(input.markPrice)

    if (!symbol || !Number.isFinite(qty) || qty <= 0) {
      return { ok: false, error: 'Invalid size' }
    }
    if (!Number.isFinite(markPrice) || markPrice <= 0) {
      return { ok: false, error: 'No real market price – start live data first' }
    }

    const notional = qty * (type === 'limit' && input.price ? Number(input.price) : markPrice)
    const margin = notional / leverage
    const { account } = get()
    if (margin > account.balance + 1e-9) {
      return {
        ok: false,
        error: `Insufficient margin (need ${margin.toFixed(2)} USDT, have ${account.balance.toFixed(2)})`,
      }
    }

    if (type === 'limit') {
      const limitPx = Number(input.price)
      if (!Number.isFinite(limitPx) || limitPx <= 0) {
        return { ok: false, error: 'Limit price required' }
      }
      const order: PaperOrder = {
        id: uid('ord'),
        symbol: symbol.toUpperCase(),
        side,
        type: 'limit',
        price: limitPx,
        qty,
        leverage,
        status: 'open',
        createdAt: Date.now(),
      }
      set((s) => {
        const next = { ...s, orders: [order, ...s.orders] }
        persist(next)
        return { orders: next.orders, lastError: null }
      })
      // Immediate fill if already through
      get().tryFillLimits(symbol.toUpperCase(), markPrice)
      return { ok: true }
    }

    // Market – fill at mark
    const order: PaperOrder = {
      id: uid('ord'),
      symbol: symbol.toUpperCase(),
      side,
      type: 'market',
      price: null,
      qty,
      leverage,
      status: 'filled',
      createdAt: Date.now(),
      filledAt: Date.now(),
      fillPrice: markPrice,
    }

    const pos: PaperPosition = {
      id: uid('pos'),
      symbol: order.symbol,
      side,
      qty,
      entryPrice: markPrice,
      leverage,
      margin,
      openedAt: Date.now(),
      markPrice,
    }

    const fill: PaperFill = {
      id: uid('fill'),
      orderId: order.id,
      symbol: order.symbol,
      side,
      qty,
      price: markPrice,
      leverage,
      realizedPnl: 0,
      time: Date.now(),
      action: 'open',
    }

    set((s) => {
      const next = {
        account: { ...s.account, balance: s.account.balance - margin },
        positions: [pos, ...s.positions],
        orders: [order, ...s.orders],
        fills: [fill, ...s.fills].slice(0, 200),
      }
      persist(next)
      return { ...next, lastError: null }
    })
    return { ok: true }
  },

  cancelOrder: (orderId) => {
    set((s) => {
      const next = {
        ...s,
        orders: s.orders.map((o) =>
          o.id === orderId && o.status === 'open' ? { ...o, status: 'cancelled' as const } : o
        ),
      }
      persist(next)
      return { orders: next.orders }
    })
  },

  closePosition: (positionId, markPrice) => {
    const px = Number(markPrice)
    if (!Number.isFinite(px) || px <= 0) {
      return { ok: false, error: 'No real market price to close' }
    }
    const pos = get().positions.find((p) => p.id === positionId)
    if (!pos) return { ok: false, error: 'Position not found' }

    const pnl = unrealizedPnl(pos, px)
    const returned = pos.margin + pnl

    const fill: PaperFill = {
      id: uid('fill'),
      orderId: `close-${pos.id}`,
      symbol: pos.symbol,
      side: pos.side,
      qty: pos.qty,
      price: px,
      leverage: pos.leverage,
      realizedPnl: pnl,
      time: Date.now(),
      action: 'close',
    }

    set((s) => {
      const next = {
        account: {
          ...s.account,
          balance: s.account.balance + returned,
        },
        positions: s.positions.filter((p) => p.id !== positionId),
        fills: [fill, ...s.fills].slice(0, 200),
      }
      persist(next)
      return { ...next, lastError: null }
    })
    return { ok: true }
  },

  markToMarket: (symbol, markPrice) => {
    const px = Number(markPrice)
    if (!Number.isFinite(px) || px <= 0) return
    const sym = symbol.toUpperCase()
    set((s) => {
      let changed = false
      const positions = s.positions.map((p) => {
        if (p.symbol !== sym) return p
        if (p.markPrice === px) return p
        changed = true
        return { ...p, markPrice: px }
      })
      if (!changed) return s
      const next = { ...s, positions }
      persist(next)
      return { positions }
    })
  },

  tryFillLimits: (symbol, lastPrice) => {
    const px = Number(lastPrice)
    if (!Number.isFinite(px) || px <= 0) return
    const sym = symbol.toUpperCase()
    const openLimits = get().orders.filter(
      (o) => o.status === 'open' && o.type === 'limit' && o.symbol === sym && o.price != null
    )
    if (openLimits.length === 0) return

    for (const order of openLimits) {
      const limitPx = order.price!
      const shouldFill =
        order.side === 'long' ? px <= limitPx : px >= limitPx
      if (!shouldFill) continue

      const notional = order.qty * limitPx
      const margin = notional / order.leverage
      const { account } = get()
      if (margin > account.balance + 1e-9) {
        // Cancel – cannot afford
        set((s) => {
          const next = {
            ...s,
            orders: s.orders.map((o) =>
              o.id === order.id ? { ...o, status: 'cancelled' as const } : o
            ),
            lastError: `Limit ${order.id} cancelled – insufficient margin`,
          }
          persist(next)
          return { orders: next.orders, lastError: next.lastError }
        })
        continue
      }

      const pos: PaperPosition = {
        id: uid('pos'),
        symbol: order.symbol,
        side: order.side,
        qty: order.qty,
        entryPrice: limitPx,
        leverage: order.leverage,
        margin,
        openedAt: Date.now(),
        markPrice: px,
      }
      const fill: PaperFill = {
        id: uid('fill'),
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        qty: order.qty,
        price: limitPx,
        leverage: order.leverage,
        realizedPnl: 0,
        time: Date.now(),
        action: 'open',
      }

      set((s) => {
        const next = {
          account: { ...s.account, balance: s.account.balance - margin },
          positions: [pos, ...s.positions],
          orders: s.orders.map((o) =>
            o.id === order.id
              ? {
                  ...o,
                  status: 'filled' as const,
                  filledAt: Date.now(),
                  fillPrice: limitPx,
                }
              : o
          ),
          fills: [fill, ...s.fills].slice(0, 200),
        }
        persist(next)
        return { ...next, lastError: null }
      })
    }
  },
}))

export function positionUnrealizedPnl(pos: PaperPosition): number {
  return unrealizedPnl(pos, pos.markPrice)
}

export { MAX_LEVERAGE, MIN_LEVERAGE, DEFAULT_BALANCE }
