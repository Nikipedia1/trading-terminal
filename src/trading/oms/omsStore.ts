/**
 * OMS-lite store: tracks order lifecycle, partials, rejects, unknown-after-reconnect.
 */

import { create } from 'zustand'
import type { OmsOrder, OmsOrderStatus, OmsVenue } from './types'

const MAX_ORDERS = 300

function uid() {
  return `oms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

interface OmsState {
  orders: OmsOrder[]
  createPending: (partial: Omit<OmsOrder, 'id' | 'clientOrderId' | 'status' | 'filledQty' | 'createdAt' | 'updatedAt'>) => OmsOrder
  markSubmitted: (id: string, exchangeOrderId?: string) => void
  markPartial: (id: string, filledQty: number, avgFillPrice?: number) => void
  markFilled: (id: string, filledQty: number, avgFillPrice?: number, fee?: number) => void
  markRejected: (id: string, error: string) => void
  markCancelled: (id: string) => void
  markUnknown: (id: string) => void
  /** On WS reconnect: any submitted/partial without terminal state → unknown */
  onReconnect: (venue: OmsVenue) => void
  getOpen: (venue?: OmsVenue) => OmsOrder[]
}

function patch(
  orders: OmsOrder[],
  id: string,
  fn: (o: OmsOrder) => OmsOrder
): OmsOrder[] {
  return orders.map((o) => (o.id === id ? fn(o) : o))
}

export const useOmsStore = create<OmsState>((set, get) => ({
  orders: [],

  createPending: (partial) => {
    const now = Date.now()
    const order: OmsOrder = {
      ...partial,
      id: uid(),
      clientOrderId: uid(),
      status: 'pending',
      filledQty: 0,
      createdAt: now,
      updatedAt: now,
    }
    set((s) => ({ orders: [order, ...s.orders].slice(0, MAX_ORDERS) }))
    return order
  },

  markSubmitted: (id, exchangeOrderId) => {
    set((s) => ({
      orders: patch(s.orders, id, (o) => ({
        ...o,
        status: 'submitted' as OmsOrderStatus,
        exchangeOrderId: exchangeOrderId ?? o.exchangeOrderId,
        updatedAt: Date.now(),
      })),
    }))
  },

  markPartial: (id, filledQty, avgFillPrice) => {
    set((s) => ({
      orders: patch(s.orders, id, (o) => ({
        ...o,
        status: 'partial',
        filledQty,
        avgFillPrice: avgFillPrice ?? o.avgFillPrice,
        updatedAt: Date.now(),
      })),
    }))
  },

  markFilled: (id, filledQty, avgFillPrice, fee) => {
    set((s) => ({
      orders: patch(s.orders, id, (o) => ({
        ...o,
        status: 'filled',
        filledQty,
        avgFillPrice: avgFillPrice ?? o.avgFillPrice,
        fee: fee ?? o.fee,
        updatedAt: Date.now(),
      })),
    }))
  },

  markRejected: (id, error) => {
    set((s) => ({
      orders: patch(s.orders, id, (o) => ({
        ...o,
        status: 'rejected',
        lastError: error.slice(0, 300),
        updatedAt: Date.now(),
      })),
    }))
  },

  markCancelled: (id) => {
    set((s) => ({
      orders: patch(s.orders, id, (o) => ({
        ...o,
        status: 'cancelled',
        updatedAt: Date.now(),
      })),
    }))
  },

  markUnknown: (id) => {
    set((s) => ({
      orders: patch(s.orders, id, (o) => ({
        ...o,
        status: 'unknown',
        updatedAt: Date.now(),
      })),
    }))
  },

  onReconnect: (venue) => {
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.venue !== venue) return o
        if (o.status === 'submitted' || o.status === 'partial' || o.status === 'pending') {
          return { ...o, status: 'unknown' as OmsOrderStatus, updatedAt: Date.now() }
        }
        return o
      }),
    }))
  },

  getOpen: (venue) => {
    const open: OmsOrderStatus[] = ['pending', 'submitted', 'partial', 'unknown']
    return get().orders.filter(
      (o) => open.includes(o.status) && (!venue || o.venue === venue)
    )
  },
}))
