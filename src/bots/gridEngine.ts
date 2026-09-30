/**
 * True grid – discrete limit levels, inventory, re-center.
 * Works with paper placeOrder(type:limit) + tryFillLimits on marks.
 */

import type { BotInstance, GridParams } from './types'

export interface GridLevel {
  index: number
  price: number
  side: 'long' | 'short'
}

export interface GridPlan {
  center: number
  levels: GridLevel[]
  spacing: number
}

export function buildGridLevels(
  center: number,
  params: GridParams
): GridPlan {
  const n = Math.max(1, Math.min(20, Math.floor(params.levels || 5)))
  const rangePct = Math.max(0.1, params.rangePct || 4) / 100
  const low = center * (1 - rangePct)
  const high = center * (1 + rangePct)
  const totalSteps = n * 2
  const spacing = (high - low) / totalSteps
  const levels: GridLevel[] = []
  for (let i = 0; i < totalSteps; i++) {
    const price = low + spacing * (i + 0.5)
    const side: 'long' | 'short' = price < center ? 'long' : 'short'
    levels.push({ index: i, price, side })
  }
  return { center, levels, spacing }
}

export function qtyAtLevel(notionalUsdt: number, price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0
  if (!Number.isFinite(notionalUsdt) || notionalUsdt <= 0) return 0
  const q = notionalUsdt / price
  return q >= 1 ? Math.round(q * 1e4) / 1e4 : Math.round(q * 1e8) / 1e8
}

export function needsRecenter(
  mid: number,
  center: number,
  reCenterPct: number
): boolean {
  if (!Number.isFinite(mid) || !Number.isFinite(center) || center <= 0) return false
  const pct = (Math.abs(mid - center) / center) * 100
  return pct >= Math.max(0.5, reCenterPct || 3)
}

export function inventoryAllows(
  inventory: number,
  side: 'long' | 'short',
  qty: number,
  maxInventory: number
): boolean {
  if (!maxInventory || maxInventory <= 0) return true
  const next = side === 'long' ? inventory + qty : inventory - qty
  return Math.abs(next) <= maxInventory + 1e-12
}

export function defaultGridParams(): GridParams {
  return {
    levels: 5,
    rangePct: 4,
    orderNotionalUsdt: 50,
    reCenterPct: 3,
    maxInventory: 0,
  }
}

export function ensureGridParams(g: Partial<GridParams> | undefined): GridParams {
  const d = defaultGridParams()
  return {
    levels: g?.levels ?? d.levels,
    rangePct: g?.rangePct ?? d.rangePct,
    orderNotionalUsdt: g?.orderNotionalUsdt ?? d.orderNotionalUsdt,
    reCenterPct: g?.reCenterPct ?? d.reCenterPct,
    maxInventory: g?.maxInventory ?? d.maxInventory,
  }
}

export type PaperLimitLike = {
  id: string
  symbol: string
  side: 'long' | 'short'
  type: string
  status: string
  price: number | null
  qty: number
}

export interface GridSyncResult {
  runtime: NonNullable<BotInstance['runtime']>
  toPlace: Array<{
    levelIndex: number
    side: 'long' | 'short'
    price: number
    qty: number
  }>
  toCancel: string[]
  message: string
}

export function planGridSync(
  bot: BotInstance,
  mid: number,
  openLimits: PaperLimitLike[]
): GridSyncResult | null {
  if (bot.params.kind !== 'grid') return null
  const params = ensureGridParams(bot.params.grid)
  const sym = (bot.config.symbol || '').toUpperCase()
  let center = bot.runtime?.gridCenter ?? mid
  let inventory = bot.runtime?.gridInventory ?? 0
  const orderIds: Record<string, string> = {
    ...(bot.runtime?.gridOrderIds ?? {}),
  }
  const toCancel: string[] = []
  let message = 'grid ok'

  if (needsRecenter(mid, center, params.reCenterPct)) {
    for (const oid of Object.values(orderIds)) {
      if (oid) toCancel.push(oid)
    }
    for (const o of openLimits) {
      if (o.symbol.toUpperCase() === sym && o.status === 'open' && o.type === 'limit') {
        if (!toCancel.includes(o.id)) toCancel.push(o.id)
      }
    }
    center = mid
    for (const k of Object.keys(orderIds)) delete orderIds[k]
    message = `re-center @ ${mid.toFixed(4)}`
  }

  const plan = buildGridLevels(center, params)
  const toPlace: GridSyncResult['toPlace'] = []

  const openSet = new Set(
    openLimits.filter((o) => o.status === 'open').map((o) => o.id)
  )
  for (const [idx, oid] of Object.entries(orderIds)) {
    if (!openSet.has(oid)) delete orderIds[idx]
  }

  for (const lv of plan.levels) {
    const key = String(lv.index)
    if (orderIds[key]) continue
    const qty = qtyAtLevel(params.orderNotionalUsdt, lv.price)
    if (qty <= 0) continue
    if (!inventoryAllows(inventory, lv.side, qty, params.maxInventory)) continue
    toPlace.push({
      levelIndex: lv.index,
      side: lv.side,
      price: lv.price,
      qty,
    })
  }

  return {
    runtime: {
      ...bot.runtime,
      gridCenter: center,
      gridOrderIds: orderIds,
      gridInventory: inventory,
      gridRecenterAt:
        message.startsWith('re-center') ? Date.now() : bot.runtime?.gridRecenterAt,
    },
    toPlace,
    toCancel,
    message,
  }
}

export function applyGridFill(
  runtime: NonNullable<BotInstance['runtime']>,
  side: 'long' | 'short',
  qty: number,
  orderId: string
): NonNullable<BotInstance['runtime']> {
  const orderIds = { ...(runtime.gridOrderIds ?? {}) }
  for (const [k, id] of Object.entries(orderIds)) {
    if (id === orderId) delete orderIds[k]
  }
  let inv = runtime.gridInventory ?? 0
  inv = side === 'long' ? inv + qty : inv - qty
  return {
    ...runtime,
    gridOrderIds: orderIds,
    gridInventory: inv,
    lastOrderAt: Date.now(),
  }
}
