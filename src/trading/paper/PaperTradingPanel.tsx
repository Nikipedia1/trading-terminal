/**
 * Paper trading panel – KuCoin-inspired order ticket + positions.
 * Uses real last price from marketStore only (no mock ticks).
 */

import { useEffect, useMemo, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import {
  usePaperStore,
  positionUnrealizedPnl,
  MAX_LEVERAGE,
  MIN_LEVERAGE,
} from './paperStore'
import type { PaperOrderType, PaperSide } from './types'

function fmt(n: number, d = 2): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

function fmtQty(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1) return fmt(n, 4)
  return n.toPrecision(4)
}

export function PaperTradingPanel() {
  const symbol = useMarketStore((s) => s.symbol)
  const ticker = useMarketStore((s) => s.ticker)
  const lastPrice = ticker?.lastPrice ?? 0

  const account = usePaperStore((s) => s.account)
  const positions = usePaperStore((s) => s.positions)
  const orders = usePaperStore((s) => s.orders)
  const fills = usePaperStore((s) => s.fills)
  const lastError = usePaperStore((s) => s.lastError)
  const placeOrder = usePaperStore((s) => s.placeOrder)
  const cancelOrder = usePaperStore((s) => s.cancelOrder)
  const closePosition = usePaperStore((s) => s.closePosition)
  const markToMarket = usePaperStore((s) => s.markToMarket)
  const tryFillLimits = usePaperStore((s) => s.tryFillLimits)
  const resetAccount = usePaperStore((s) => s.resetAccount)
  const clearError = usePaperStore((s) => s.clearError)

  const [side, setSide] = useState<PaperSide>('long')
  const [orderType, setOrderType] = useState<PaperOrderType>('market')
  const [leverage, setLeverage] = useState(10)
  const [sizeUsdt, setSizeUsdt] = useState('100')
  const [limitPrice, setLimitPrice] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  // Mark + try limits whenever real ticker updates
  useEffect(() => {
    if (!symbol || !(lastPrice > 0)) return
    markToMarket(symbol, lastPrice)
    tryFillLimits(symbol, lastPrice)
  }, [symbol, lastPrice, markToMarket, tryFillLimits])

  useEffect(() => {
    if (lastPrice > 0 && !limitPrice) {
      setLimitPrice(String(lastPrice))
    }
  }, [lastPrice])

  const refPrice =
    orderType === 'limit' && Number(limitPrice) > 0 ? Number(limitPrice) : lastPrice

  const qtyBase = useMemo(() => {
    const usdt = Number(sizeUsdt)
    if (!Number.isFinite(usdt) || usdt <= 0 || !(refPrice > 0)) return 0
    return usdt / refPrice
  }, [sizeUsdt, refPrice])

  const marginNeeded = useMemo(() => {
    const notional = qtyBase * refPrice
    if (!(notional > 0) || leverage < 1) return 0
    return notional / leverage
  }, [qtyBase, refPrice, leverage])

  const equity = useMemo(() => {
    const upnl = positions.reduce((s, p) => s + positionUnrealizedPnl(p), 0)
    return account.balance + upnl + positions.reduce((s, p) => s + p.margin, 0)
  }, [account.balance, positions])

  const openOrders = orders.filter((o) => o.status === 'open')
  const recentFills = fills.slice(0, 20)

  const submit = () => {
    setMsg(null)
    clearError()
    if (!(lastPrice > 0)) {
      setMsg('No live price – Start Live first')
      return
    }
    const result = placeOrder({
      symbol,
      side,
      type: orderType,
      qty: qtyBase,
      leverage,
      price: orderType === 'limit' ? Number(limitPrice) : null,
      markPrice: lastPrice,
    })
    if (!result.ok) {
      setMsg(result.error)
      return
    }
    setMsg(orderType === 'market' ? 'Filled (paper)' : 'Limit placed (paper)')
  }

  return (
    <div className="flex flex-col h-full min-h-0 text-xs">
      {/* Account strip */}
      <div className="px-2 py-1.5 border-b border-terminal-border flex flex-wrap gap-x-3 gap-y-0.5 shrink-0 font-mono-nums">
        <span className="text-terminal-muted">Equity</span>
        <span className="text-[#f0b90b]">{fmt(equity)} USDT</span>
        <span className="text-terminal-muted">Avail</span>
        <span>{fmt(account.balance)}</span>
        <span className="text-terminal-muted">Mark</span>
        <span className={lastPrice > 0 ? 'text-terminal-text' : 'text-terminal-red'}>
          {lastPrice > 0 ? fmt(lastPrice, lastPrice < 1 ? 6 : 2) : '—'}
        </span>
      </div>

      {/* Side + type */}
      <div className="px-2 pt-2 shrink-0 space-y-2">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            className={`py-1.5 rounded text-sm font-semibold ${
              side === 'long'
                ? 'bg-[#0ecb81] text-[#0b0e11]'
                : 'bg-terminal-bg border border-terminal-border text-terminal-muted'
            }`}
            onClick={() => setSide('long')}
          >
            Buy / Long
          </button>
          <button
            type="button"
            className={`py-1.5 rounded text-sm font-semibold ${
              side === 'short'
                ? 'bg-[#f6465d] text-white'
                : 'bg-terminal-bg border border-terminal-border text-terminal-muted'
            }`}
            onClick={() => setSide('short')}
          >
            Sell / Short
          </button>
        </div>

        <div className="flex gap-1">
          {(['market', 'limit'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`flex-1 py-1 rounded capitalize ${
                orderType === t
                  ? 'bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/40'
                  : 'bg-terminal-bg border border-terminal-border text-terminal-muted'
              }`}
              onClick={() => setOrderType(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Leverage */}
        <div>
          <div className="flex justify-between text-terminal-muted mb-0.5">
            <span>Leverage</span>
            <span className="text-[#f0b90b] font-mono-nums">{leverage}x</span>
          </div>
          <input
            type="range"
            min={MIN_LEVERAGE}
            max={MAX_LEVERAGE}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="w-full accent-[#f0b90b]"
          />
          <div className="flex gap-1 mt-1">
            {[1, 5, 10, 25, 50, 100].map((v) => (
              <button
                key={v}
                type="button"
                className="flex-1 py-0.5 text-[10px] border border-terminal-border rounded hover:border-[#f0b90b]/50"
                onClick={() => setLeverage(v)}
              >
                {v}x
              </button>
            ))}
          </div>
        </div>

        {orderType === 'limit' && (
          <label className="block">
            <span className="text-terminal-muted">Limit price</span>
            <input
              className="mt-0.5 w-full bg-terminal-bg border border-terminal-border rounded px-2 py-1 font-mono-nums"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              inputMode="decimal"
            />
          </label>
        )}

        <label className="block">
          <span className="text-terminal-muted">Size (USDT notional)</span>
          <input
            className="mt-0.5 w-full bg-terminal-bg border border-terminal-border rounded px-2 py-1 font-mono-nums"
            value={sizeUsdt}
            onChange={(e) => setSizeUsdt(e.target.value)}
            inputMode="decimal"
          />
        </label>

        <div className="text-[10px] text-terminal-muted font-mono-nums space-y-0.5">
          <div className="flex justify-between">
            <span>Qty ({symbol.replace(/USDT$/, '') || 'base'})</span>
            <span>{fmtQty(qtyBase)}</span>
          </div>
          <div className="flex justify-between">
            <span>Margin</span>
            <span>{fmt(marginNeeded)} USDT</span>
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          className={`w-full py-2 rounded font-semibold text-sm ${
            side === 'long'
              ? 'bg-[#0ecb81] text-[#0b0e11] hover:brightness-110'
              : 'bg-[#f6465d] text-white hover:brightness-110'
          }`}
        >
          {side === 'long' ? 'Open Long' : 'Open Short'} · {leverage}x · Paper
        </button>

        {(msg || lastError) && (
          <div
            className={`text-[10px] px-1 ${
              lastError || msg?.includes('Insufficient') || msg?.includes('No live')
                ? 'text-terminal-red'
                : 'text-terminal-green'
            }`}
          >
            {lastError || msg}
          </div>
        )}
      </div>

      {/* Positions */}
      <div className="mt-2 border-t border-terminal-border flex-1 min-h-0 flex flex-col">
        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-terminal-muted shrink-0 flex justify-between">
          <span>Positions ({positions.length})</span>
          <button
            type="button"
            className="text-terminal-muted hover:text-terminal-red normal-case"
            title="Reset paper account to 10,000 USDT"
            onClick={() => {
              if (confirm('Reset paper account to 10,000 USDT?')) resetAccount()
            }}
          >
            Reset
          </button>
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          {positions.length === 0 ? (
            <div className="px-2 py-3 text-terminal-muted text-[11px]">No open positions</div>
          ) : (
            <table className="w-full text-[10px] font-mono-nums">
              <thead className="sticky top-0 bg-terminal-panel text-terminal-muted">
                <tr>
                  <th className="text-left px-1 py-0.5">Sym</th>
                  <th className="text-right px-1 py-0.5">Side</th>
                  <th className="text-right px-1 py-0.5">Entry</th>
                  <th className="text-right px-1 py-0.5">uPnL</th>
                  <th className="text-right px-1 py-0.5" />
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const upnl = positionUnrealizedPnl(p)
                  return (
                    <tr key={p.id} className="border-t border-terminal-border/40">
                      <td className="px-1 py-1">
                        {p.symbol}
                        <div className="text-terminal-muted">{p.leverage}x · {fmtQty(p.qty)}</div>
                      </td>
                      <td
                        className={
                          'text-right px-1 ' +
                          (p.side === 'long' ? 'text-[#0ecb81]' : 'text-[#f6465d]')
                        }
                      >
                        {p.side.toUpperCase()}
                      </td>
                      <td className="text-right px-1">{fmt(p.entryPrice, p.entryPrice < 1 ? 6 : 2)}</td>
                      <td
                        className={
                          'text-right px-1 ' +
                          (upnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]')
                        }
                      >
                        {upnl >= 0 ? '+' : ''}
                        {fmt(upnl)}
                      </td>
                      <td className="text-right px-1">
                        <button
                          type="button"
                          className="text-[#f0b90b] hover:underline"
                          onClick={() => {
                            if (!(lastPrice > 0)) {
                              setMsg('No live price to close')
                              return
                            }
                            const r = closePosition(p.id, lastPrice)
                            if (!r.ok) setMsg(r.error)
                            else setMsg('Position closed')
                          }}
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Open orders */}
      {openOrders.length > 0 && (
        <div className="border-t border-terminal-border shrink-0 max-h-24 overflow-auto">
          <div className="px-2 py-1 text-[10px] uppercase text-terminal-muted">Open orders</div>
          {openOrders.map((o) => (
            <div
              key={o.id}
              className="px-2 py-0.5 flex justify-between items-center text-[10px] font-mono-nums border-t border-terminal-border/30"
            >
              <span>
                {o.side} {o.qty.toPrecision(4)} @ {o.price}
              </span>
              <button
                type="button"
                className="text-terminal-red hover:underline"
                onClick={() => cancelOrder(o.id)}
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recent fills */}
      <div className="border-t border-terminal-border shrink-0 max-h-28 overflow-auto">
        <div className="px-2 py-1 text-[10px] uppercase text-terminal-muted sticky top-0 bg-terminal-panel">
          History
        </div>
        {recentFills.length === 0 ? (
          <div className="px-2 py-2 text-terminal-muted text-[10px]">No fills yet</div>
        ) : (
          recentFills.map((f) => (
            <div
              key={f.id}
              className="px-2 py-0.5 text-[10px] font-mono-nums flex justify-between border-t border-terminal-border/30"
            >
              <span>
                <span className={f.side === 'long' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                  {f.action}
                </span>{' '}
                {f.symbol} {fmtQty(f.qty)} @ {fmt(f.price, f.price < 1 ? 6 : 2)}
              </span>
              {f.action === 'close' && (
                <span className={f.realizedPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                  {f.realizedPnl >= 0 ? '+' : ''}
                  {fmt(f.realizedPnl)}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="px-2 py-1 text-[9px] text-[#5e6673] border-t border-terminal-border shrink-0">
        Paper only · fills at real last price · no exchange keys
      </div>
    </div>
  )
}
