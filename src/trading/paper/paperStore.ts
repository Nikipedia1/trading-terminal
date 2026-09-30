/** Paper store – trailing stop; real prices only; multi-account via wallet activeId */
import { create } from 'zustand'
import type { PaperAccount, PaperFill, PaperMarginMode, PaperOrder, PaperOrderType, PaperPosition, PaperSide } from './types'

const STORAGE_PREFIX = 'tt-paper:v3:'
const LEGACY_KEYS = ['tt-paper:v2', 'tt-paper:v1']
let activeWalletId = 'main'
function storageKey(walletId?: string) {
  return STORAGE_PREFIX + (walletId || activeWalletId)
}
const DEFAULT_BALANCE = 10_000
const MAX_LEVERAGE = 125
const MIN_LEVERAGE = 1
function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
interface Persisted { account: PaperAccount; positions: PaperPosition[]; orders: PaperOrder[]; fills: PaperFill[] }
function normalizePosition(p: Partial<PaperPosition> & Pick<PaperPosition, 'id' | 'symbol' | 'side' | 'qty' | 'entryPrice' | 'leverage' | 'margin' | 'openedAt' | 'markPrice'>): PaperPosition {
  return {
    ...p,
    marginMode: p.marginMode === 'isolated' ? 'isolated' : 'cross',
    takeProfit: typeof p.takeProfit === 'number' && p.takeProfit > 0 ? p.takeProfit : null,
    stopLoss: typeof p.stopLoss === 'number' && p.stopLoss > 0 ? p.stopLoss : null,
    trailingPct: typeof p.trailingPct === 'number' && p.trailingPct > 0 ? p.trailingPct : null,
    trailExtreme: typeof p.trailExtreme === 'number' && p.trailExtreme > 0 ? p.trailExtreme : null,
  }
}
function load(walletId?: string): Persisted {
  const wid = walletId || activeWalletId
  try {
    let raw = localStorage.getItem(storageKey(wid))
    if (!raw && wid === 'main') {
      for (const k of LEGACY_KEYS) {
        raw = localStorage.getItem(k)
        if (raw) break
      }
    }
    if (!raw) throw new Error('empty')
    const parsed = JSON.parse(raw) as Persisted
    if (!parsed?.account || typeof parsed.account.balance !== 'number') throw new Error('bad')
    return {
      account: parsed.account,
      positions: Array.isArray(parsed.positions) ? parsed.positions.map((p) => normalizePosition(p as PaperPosition)) : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      fills: Array.isArray(parsed.fills) ? parsed.fills : [],
    }
  } catch {
    return { account: { balance: DEFAULT_BALANCE, initialBalance: DEFAULT_BALANCE }, positions: [], orders: [], fills: [] }
  }
}
function persist(state: Pick<PaperState, 'account' | 'positions' | 'orders' | 'fills'>) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify({ account: state.account, positions: state.positions, orders: state.orders, fills: state.fills.slice(0, 200) }))
  } catch { /* quota */ }
}
export interface PlaceOrderInput {
  symbol: string; side: PaperSide; type: PaperOrderType; qty: number; leverage: number
  price?: number | null; markPrice: number; marginMode?: PaperMarginMode
  takeProfit?: number | null; stopLoss?: number | null; trailingPct?: number | null
  postOnly?: boolean; reduceOnly?: boolean
}
interface PaperState {
  walletAccountId: string
  account: PaperAccount; positions: PaperPosition[]; orders: PaperOrder[]; fills: PaperFill[]; lastError: string | null
  placeOrder: (input: PlaceOrderInput) => { ok: true } | { ok: false; error: string }
  cancelOrder: (orderId: string) => void
  closePosition: (positionId: string, markPrice: number, reason?: PaperFill['action']) => { ok: true } | { ok: false; error: string }
  closeSide: (symbol: string, side: PaperSide, markPrice: number) => { ok: true; closed: number } | { ok: false; error: string }
  setTpsl: (positionId: string, takeProfit: number | null, stopLoss: number | null) => { ok: true } | { ok: false; error: string }
  setTrailing: (positionId: string, trailingPct: number | null) => { ok: true } | { ok: false; error: string }
  markToMarket: (symbol: string, markPrice: number) => void
  tryFillLimits: (symbol: string, lastPrice: number) => void
  checkExits: (symbol: string, markPrice: number) => void
  resetAccount: (balance?: number) => void
  clearError: () => void
  bindWalletAccount: (walletAccountId: string) => void
}
function clampLeverage(lev: number): number {
  if (!Number.isFinite(lev)) return MIN_LEVERAGE
  return Math.min(MAX_LEVERAGE, Math.max(MIN_LEVERAGE, Math.round(lev)))
}
function unrealizedPnl(pos: PaperPosition, mark: number): number {
  const diff = pos.side === 'long' ? mark - pos.entryPrice : pos.entryPrice - mark
  return diff * pos.qty
}
function validateTpsl(side: PaperSide, entry: number, tp: number | null, sl: number | null): string | null {
  if (tp != null && tp > 0) {
    if (side === 'long' && tp <= entry) return 'TP must be above entry for long'
    if (side === 'short' && tp >= entry) return 'TP must be below entry for short'
  }
  if (sl != null && sl > 0) {
    if (side === 'long' && sl >= entry) return 'SL must be below entry for long'
    if (side === 'short' && sl <= entry) return 'SL must be above entry for short'
  }
  return null
}
export function estLiqPrice(pos: { side: PaperSide; entryPrice: number; leverage: number; marginMode: PaperMarginMode }): number | null {
  if (pos.marginMode !== 'isolated' || pos.leverage < 1) return null
  const delta = pos.entryPrice / pos.leverage
  return pos.side === 'long' ? Math.max(0, pos.entryPrice - delta) : pos.entryPrice + delta
}
const initial = load()
export const usePaperStore = create<PaperState>((set, get) => ({
  walletAccountId: activeWalletId,
  account: initial.account, positions: initial.positions, orders: initial.orders, fills: initial.fills, lastError: null,
  bindWalletAccount: (walletAccountId) => {
    const id = (walletAccountId || 'main').trim() || 'main'
    if (id === activeWalletId && get().walletAccountId === id) return
    const cur = get()
    persist({ account: cur.account, positions: cur.positions, orders: cur.orders, fills: cur.fills })
    activeWalletId = id
    const next = load(id)
    set({ walletAccountId: id, ...next, lastError: null })
  },
  clearError: () => set({ lastError: null }),
  resetAccount: (balance = DEFAULT_BALANCE) => {
    const next = { account: { balance, initialBalance: balance }, positions: [] as PaperPosition[], orders: [] as PaperOrder[], fills: [] as PaperFill[], lastError: null }
    set(next); persist(next)
  },
  placeOrder: (input) => {
    const { symbol, side, type } = input
    const qty = Number(input.qty)
    const leverage = clampLeverage(input.leverage)
    const markPrice = Number(input.markPrice)
    const marginMode: PaperMarginMode = input.marginMode === 'isolated' ? 'isolated' : 'cross'
    const takeProfit = typeof input.takeProfit === 'number' && input.takeProfit > 0 ? input.takeProfit : null
    const stopLoss = typeof input.stopLoss === 'number' && input.stopLoss > 0 ? input.stopLoss : null
    const trailingPct = typeof input.trailingPct === 'number' && input.trailingPct > 0 ? input.trailingPct : null
    const postOnly = !!input.postOnly
    if (!symbol || !Number.isFinite(qty) || qty <= 0) return { ok: false, error: 'Invalid size' }
    if (!Number.isFinite(markPrice) || markPrice <= 0) return { ok: false, error: 'No real market price – start live data first' }
    const entryRef = type === 'limit' && input.price ? Number(input.price) : markPrice
    const tpslErr = validateTpsl(side, entryRef, takeProfit, stopLoss)
    if (tpslErr) return { ok: false, error: tpslErr }
    if (type === 'limit' && postOnly) {
      const limitPx = Number(input.price)
      if (side === 'long' && limitPx >= markPrice) return { ok: false, error: 'Post-only: limit would take (set below last)' }
      if (side === 'short' && limitPx <= markPrice) return { ok: false, error: 'Post-only: limit would take (set above last)' }
    }
    const margin = (qty * entryRef) / leverage
    if (margin > get().account.balance + 1e-9) return { ok: false, error: `Insufficient margin (need ${margin.toFixed(2)} USDT, have ${get().account.balance.toFixed(2)})` }
    if (type === 'limit') {
      const limitPx = Number(input.price)
      if (!Number.isFinite(limitPx) || limitPx <= 0) return { ok: false, error: 'Limit price required' }
      const order: PaperOrder = { id: uid('ord'), symbol: symbol.toUpperCase(), side, type: 'limit', price: limitPx, qty, leverage, marginMode, status: 'open', createdAt: Date.now(), takeProfit, stopLoss, trailingPct, postOnly }
      set((s) => { const next = { ...s, orders: [order, ...s.orders] }; persist(next); return { orders: next.orders, lastError: null } })
      get().tryFillLimits(symbol.toUpperCase(), markPrice)
      return { ok: true }
    }
    const order: PaperOrder = { id: uid('ord'), symbol: symbol.toUpperCase(), side, type: 'market', price: null, qty, leverage, marginMode, status: 'filled', createdAt: Date.now(), filledAt: Date.now(), fillPrice: markPrice, takeProfit, stopLoss, trailingPct }
    const pos: PaperPosition = { id: uid('pos'), symbol: order.symbol, side, qty, entryPrice: markPrice, leverage, margin, marginMode, openedAt: Date.now(), markPrice, takeProfit, stopLoss, trailingPct, trailExtreme: trailingPct != null ? markPrice : null }
    const fill: PaperFill = { id: uid('fill'), orderId: order.id, symbol: order.symbol, side, qty, price: markPrice, leverage, realizedPnl: 0, time: Date.now(), action: 'open' }
    set((s) => { const next = { account: { ...s.account, balance: s.account.balance - margin }, positions: [pos, ...s.positions], orders: [order, ...s.orders], fills: [fill, ...s.fills].slice(0, 200) }; persist(next); return { ...next, lastError: null } })
    return { ok: true }
  },
  cancelOrder: (orderId) => {
    set((s) => { const next = { ...s, orders: s.orders.map((o) => o.id === orderId && o.status === 'open' ? { ...o, status: 'cancelled' as const } : o) }; persist(next); return { orders: next.orders } })
  },
  closePosition: (positionId, markPrice, reason = 'close') => {
    const px = Number(markPrice)
    if (!Number.isFinite(px) || px <= 0) return { ok: false, error: 'No real market price to close' }
    const pos = get().positions.find((p) => p.id === positionId)
    if (!pos) return { ok: false, error: 'Position not found' }
    const pnl = unrealizedPnl(pos, px)
    const returned = pos.marginMode === 'isolated' ? Math.max(0, pos.margin + pnl) : pos.margin + pnl
    const fill: PaperFill = { id: uid('fill'), orderId: `${reason}-${pos.id}`, symbol: pos.symbol, side: pos.side, qty: pos.qty, price: px, leverage: pos.leverage, realizedPnl: pos.marginMode === 'isolated' ? Math.max(-pos.margin, pnl) : pnl, time: Date.now(), action: reason }
    set((s) => { const next = { account: { ...s.account, balance: s.account.balance + returned }, positions: s.positions.filter((p) => p.id !== positionId), fills: [fill, ...s.fills].slice(0, 200) }; persist(next); return { ...next, lastError: null } })
    return { ok: true }
  },
  closeSide: (symbol, side, markPrice) => {
    const px = Number(markPrice)
    if (!Number.isFinite(px) || px <= 0) return { ok: false, error: 'No real market price to close' }
    const ids = get().positions.filter((p) => p.symbol === symbol.toUpperCase() && p.side === side).map((p) => p.id)
    if (ids.length === 0) return { ok: false, error: `No ${side} position on ${symbol}` }
    for (const id of ids) get().closePosition(id, px, 'close')
    return { ok: true, closed: ids.length }
  },
  setTpsl: (positionId, takeProfit, stopLoss) => {
    const pos = get().positions.find((p) => p.id === positionId)
    if (!pos) return { ok: false, error: 'Position not found' }
    const tp = takeProfit != null && takeProfit > 0 ? takeProfit : null
    const sl = stopLoss != null && stopLoss > 0 ? stopLoss : null
    const err = validateTpsl(pos.side, pos.entryPrice, tp, sl)
    if (err) return { ok: false, error: err }
    set((s) => { const positions = s.positions.map((p) => p.id === positionId ? { ...p, takeProfit: tp, stopLoss: sl } : p); persist({ ...s, positions }); return { positions, lastError: null } })
    return { ok: true }
  },
  setTrailing: (positionId, trailingPct) => {
    const pos = get().positions.find((p) => p.id === positionId)
    if (!pos) return { ok: false, error: 'Position not found' }
    const pct = trailingPct != null && trailingPct > 0 ? trailingPct : null
    set((s) => { const positions = s.positions.map((p) => p.id === positionId ? { ...p, trailingPct: pct, trailExtreme: pct != null ? p.markPrice : null } : p); persist({ ...s, positions }); return { positions, lastError: null } })
    return { ok: true }
  },
  markToMarket: (symbol, markPrice) => {
    const px = Number(markPrice)
    if (!Number.isFinite(px) || px <= 0) return
    const sym = symbol.toUpperCase()
    set((s) => {
      let changed = false
      const positions = s.positions.map((p) => { if (p.symbol !== sym || p.markPrice === px) return p; changed = true; return { ...p, markPrice: px } })
      if (!changed) return s
      persist({ ...s, positions }); return { positions }
    })
  },
  checkExits: (symbol, markPrice) => {
    const px = Number(markPrice)
    if (!Number.isFinite(px) || px <= 0) return
    const sym = symbol.toUpperCase()
    for (const pos of get().positions.filter((p) => p.symbol === sym)) {
      if (pos.takeProfit != null && pos.takeProfit > 0) {
        if (pos.side === 'long' ? px >= pos.takeProfit : px <= pos.takeProfit) { get().closePosition(pos.id, px, 'tp'); continue }
      }
      if (pos.stopLoss != null && pos.stopLoss > 0) {
        if (pos.side === 'long' ? px <= pos.stopLoss : px >= pos.stopLoss) { get().closePosition(pos.id, px, 'sl'); continue }
      }
      if (pos.trailingPct != null && pos.trailingPct > 0) {
        let extreme = pos.trailExtreme ?? pos.entryPrice
        if (pos.side === 'long') {
          if (px > extreme) extreme = px
          if (px <= extreme * (1 - pos.trailingPct / 100)) { get().closePosition(pos.id, px, 'trail'); continue }
        } else {
          if (px < extreme) extreme = px
          if (px >= extreme * (1 + pos.trailingPct / 100)) { get().closePosition(pos.id, px, 'trail'); continue }
        }
        if (extreme !== pos.trailExtreme) {
          set((s) => { const positions = s.positions.map((p) => p.id === pos.id ? { ...p, trailExtreme: extreme } : p); persist({ ...s, positions }); return { positions } })
        }
      }
      if (pos.marginMode === 'isolated' && pos.margin + unrealizedPnl(pos, px) <= 0) get().closePosition(pos.id, px, 'liquidate')
    }
  },
  tryFillLimits: (symbol, lastPrice) => {
    const px = Number(lastPrice)
    if (!Number.isFinite(px) || px <= 0) return
    const sym = symbol.toUpperCase()
    for (const order of get().orders.filter((o) => o.status === 'open' && o.type === 'limit' && o.symbol === sym && o.price != null)) {
      const limitPx = order.price!
      if (order.postOnly) {
        if (order.side === 'long' && limitPx >= px) continue
        if (order.side === 'short' && limitPx <= px) continue
      }
      if (!(order.side === 'long' ? px <= limitPx : px >= limitPx)) continue
      const margin = (order.qty * limitPx) / order.leverage
      if (margin > get().account.balance + 1e-9) {
        set((s) => { const next = { ...s, orders: s.orders.map((o) => o.id === order.id ? { ...o, status: 'cancelled' as const } : o), lastError: `Limit cancelled – insufficient margin` }; persist(next); return { orders: next.orders, lastError: next.lastError } })
        continue
      }
      const trail = order.trailingPct ?? null
      const pos: PaperPosition = { id: uid('pos'), symbol: order.symbol, side: order.side, qty: order.qty, entryPrice: limitPx, leverage: order.leverage, margin, marginMode: order.marginMode === 'isolated' ? 'isolated' : 'cross', openedAt: Date.now(), markPrice: px, takeProfit: order.takeProfit ?? null, stopLoss: order.stopLoss ?? null, trailingPct: trail, trailExtreme: trail != null ? px : null }
      const fill: PaperFill = { id: uid('fill'), orderId: order.id, symbol: order.symbol, side: order.side, qty: order.qty, price: limitPx, leverage: order.leverage, realizedPnl: 0, time: Date.now(), action: 'open' }
      set((s) => { const next = { account: { ...s.account, balance: s.account.balance - margin }, positions: [pos, ...s.positions], orders: s.orders.map((o) => o.id === order.id ? { ...o, status: 'filled' as const, filledAt: Date.now(), fillPrice: limitPx } : o), fills: [fill, ...s.fills].slice(0, 200) }; persist(next); return { ...next, lastError: null } })
    }
  },
}))
export function positionUnrealizedPnl(pos: PaperPosition): number { return unrealizedPnl(pos, pos.markPrice) }
export { MAX_LEVERAGE, MIN_LEVERAGE, DEFAULT_BALANCE }
