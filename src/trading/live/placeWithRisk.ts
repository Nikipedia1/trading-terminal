/**
 * Live order placement gated by risk engine + OMS lifecycle.
 */

import { placeLiveOrder, type LiveOrderRequest } from './binanceSigned'
import { useRiskStore } from '@/trading/risk/riskStore'
import { useOmsStore } from '@/trading/oms/omsStore'
import type { OmsVenue } from '@/trading/oms/types'
import { estimateCommission, BINANCE_FUTURES_DEFAULT_FEES, BINANCE_SPOT_DEFAULT_FEES } from '@/trading/fees/feeModel'

export async function placeLiveOrderWithRisk(
  req: LiveOrderRequest,
  opts?: { openPositionCount?: number; markPrice?: number }
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const price = req.price ?? opts?.markPrice ?? 0
  const risk = useRiskStore.getState().evaluate({
    mode: 'live',
    symbol: req.symbol,
    leverage: 1, // live leverage is set on position; size still checked via notional
    qty: req.quantity,
    price: price > 0 ? price : 1,
    openPositionCount: opts?.openPositionCount ?? 0,
  })

  if (!risk.ok) {
    useRiskStore.getState().recordReject()
    return { ok: false, error: risk.message }
  }

  const venue: OmsVenue = req.venue
  const oms = useOmsStore.getState()
  const local = oms.createPending({
    venue,
    symbol: req.symbol.toUpperCase(),
    side: req.side,
    type: req.type,
    qty: req.quantity,
    price: req.price,
    reduceOnly: req.reduceOnly,
  })

  const result = await placeLiveOrder(req)
  if (!result.ok) {
    oms.markRejected(local.id, result.error)
    useRiskStore.getState().recordReject()
    return result
  }

  oms.markSubmitted(local.id, result.orderId)
  // Market orders often fill immediately – mark filled with fee estimate
  if (req.type === 'MARKET' && price > 0) {
    const schedule =
      req.venue === 'binance_futures'
        ? BINANCE_FUTURES_DEFAULT_FEES
        : BINANCE_SPOT_DEFAULT_FEES
    const fee = estimateCommission(req.quantity * price, false, schedule)
    oms.markFilled(local.id, req.quantity, price, fee)
  }
  useRiskStore.getState().recordAccept()
  return { ok: true, orderId: result.orderId }
}
