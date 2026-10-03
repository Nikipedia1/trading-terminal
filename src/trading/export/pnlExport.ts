/**
 * Fiscal-friendly order / fill / PnL export (CSV).
 * Filters by period and symbol.
 */

import { toCsv, downloadText } from '@/trading/paper/paperEconomics'
import type { PaperFill } from '@/trading/paper/types'
import type { OmsOrder } from '@/trading/oms/types'
import { auditList } from '@/trading/audit/auditLog'

export interface ExportFilter {
  symbol?: string
  fromTs?: number
  toTs?: number
}

function inRange(ts: number, f: ExportFilter): boolean {
  if (f.fromTs != null && ts < f.fromTs) return false
  if (f.toTs != null && ts > f.toTs) return false
  return true
}

export function exportPaperFillsCsv(fills: PaperFill[], filter: ExportFilter = {}) {
  const rows = fills
    .filter((x) => inRange(x.time, filter))
    .filter((x) => !filter.symbol || x.symbol === filter.symbol.toUpperCase())
    .map((f) => ({
      time_iso: new Date(f.time).toISOString(),
      symbol: f.symbol,
      side: f.side,
      action: f.action,
      qty: f.qty,
      price: f.price,
      leverage: f.leverage,
      realized_pnl: f.realizedPnl,
      fee: f.fee ?? 0,
      is_maker: f.isMaker ? 1 : 0,
      order_id: f.orderId,
      fill_id: f.id,
    }))
  const cols = [
    'time_iso',
    'symbol',
    'side',
    'action',
    'qty',
    'price',
    'leverage',
    'realized_pnl',
    'fee',
    'is_maker',
    'order_id',
    'fill_id',
  ]
  const csv = toCsv(rows, cols)
  downloadText(`nacs-paper-fills-${Date.now()}.csv`, csv)
  return rows.length
}

export function exportOmsOrdersCsv(orders: OmsOrder[], filter: ExportFilter = {}) {
  const rows = orders
    .filter((x) => inRange(x.createdAt, filter))
    .filter((x) => !filter.symbol || x.symbol === filter.symbol.toUpperCase())
    .map((o) => ({
      created_iso: new Date(o.createdAt).toISOString(),
      updated_iso: new Date(o.updatedAt).toISOString(),
      venue: o.venue,
      symbol: o.symbol,
      side: o.side,
      type: o.type,
      status: o.status,
      qty: o.qty,
      filled_qty: o.filledQty,
      price: o.price ?? '',
      avg_fill: o.avgFillPrice ?? '',
      fee: o.fee ?? '',
      exchange_order_id: o.exchangeOrderId ?? '',
      client_order_id: o.clientOrderId,
      error: o.lastError ?? '',
    }))
  const cols = [
    'created_iso',
    'updated_iso',
    'venue',
    'symbol',
    'side',
    'type',
    'status',
    'qty',
    'filled_qty',
    'price',
    'avg_fill',
    'fee',
    'exchange_order_id',
    'client_order_id',
    'error',
  ]
  const csv = toCsv(rows, cols)
  downloadText(`nacs-oms-orders-${Date.now()}.csv`, csv)
  return rows.length
}

export function exportAuditCsv(filter: ExportFilter = {}) {
  const entries = auditList(500).filter((e) => inRange(e.ts, filter))
  const rows = entries.map((e) => ({
    time_iso: new Date(e.ts).toISOString(),
    mode: e.mode,
    action: e.action,
    symbol: e.symbol ?? '',
    ok: e.ok ? 1 : 0,
    detail: e.detail,
    id: e.id,
  }))
  const csv = toCsv(rows, ['time_iso', 'mode', 'action', 'symbol', 'ok', 'detail', 'id'])
  downloadText(`nacs-audit-${Date.now()}.csv`, csv)
  return rows.length
}

/** Simple PnL summary for a fill set (paper). */
export function summarizePnl(fills: PaperFill[], filter: ExportFilter = {}) {
  const list = fills
    .filter((x) => inRange(x.time, filter))
    .filter((x) => !filter.symbol || x.symbol === filter.symbol.toUpperCase())
  let realized = 0
  let fees = 0
  for (const f of list) {
    realized += f.realizedPnl || 0
    fees += f.fee || 0
  }
  return {
    fills: list.length,
    realizedPnl: realized,
    fees,
    net: realized - fees,
  }
}
