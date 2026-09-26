/**
 * Paper trading – KuCoin Futures Manual-style ticket.
 * Open/Close · Isolated/Cross · dual Long/Short · Limit/Market/Adv.Limit ·
 * TP&SL · Est. Liq · bottom tabs. Fills use real marketStore last only.
 */

import { useEffect, useMemo, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import {
  usePaperStore,
  positionUnrealizedPnl,
  estLiqPrice,
  MAX_LEVERAGE,
  MIN_LEVERAGE,
} from './paperStore'
import type { PaperMarginMode, PaperOrderType, PaperSide } from './types'

type TicketMode = 'open' | 'close'
type UiOrderType = 'limit' | 'market' | 'adv_limit'
type BottomTab = 'positions' | 'openOrders' | 'orderHistory' | 'positionHistory'

function fmt(n: number, d = 2): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

function fmtPx(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  return n < 1 ? n.toPrecision(6) : fmt(n, 2)
}

function fmtQty(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1) return fmt(n, 4)
  return n.toPrecision(4)
}

function baseAsset(symbol: string): string {
  return symbol.replace(/USDT$|USDC$|BUSD$/i, '') || 'BASE'
}

export function PaperTradingPanel() {
  const symbol = useMarketStore((s) => s.symbol)
  const ticker = useMarketStore((s) => s.ticker)
  const lastPrice = ticker?.lastPrice ?? 0
  const base = baseAsset(symbol)

  const account = usePaperStore((s) => s.account)
  const positions = usePaperStore((s) => s.positions)
  const orders = usePaperStore((s) => s.orders)
  const fills = usePaperStore((s) => s.fills)
  const lastError = usePaperStore((s) => s.lastError)
  const placeOrder = usePaperStore((s) => s.placeOrder)
  const cancelOrder = usePaperStore((s) => s.cancelOrder)
  const closePosition = usePaperStore((s) => s.closePosition)
  const closeSide = usePaperStore((s) => s.closeSide)
  const setTpsl = usePaperStore((s) => s.setTpsl)
  const markToMarket = usePaperStore((s) => s.markToMarket)
  const tryFillLimits = usePaperStore((s) => s.tryFillLimits)
  const checkExits = usePaperStore((s) => s.checkExits)
  const resetAccount = usePaperStore((s) => s.resetAccount)
  const clearError = usePaperStore((s) => s.clearError)

  const [mode, setMode] = useState<TicketMode>('open')
  const [marginMode, setMarginMode] = useState<PaperMarginMode>('isolated')
  const [uiType, setUiType] = useState<UiOrderType>('limit')
  const [leverage, setLeverage] = useState(10)
  const [showLev, setShowLev] = useState(false)
  const [longPrice, setLongPrice] = useState('')
  const [shortPrice, setShortPrice] = useState('')
  const [longAmt, setLongAmt] = useState('')
  const [shortAmt, setShortAmt] = useState('')
  const [tpslOn, setTpslOn] = useState(false)
  const [longTp, setLongTp] = useState('')
  const [longSl, setLongSl] = useState('')
  const [shortTp, setShortTp] = useState('')
  const [shortSl, setShortSl] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [tab, setTab] = useState<BottomTab>('positions')
  const [editTpslId, setEditTpslId] = useState<string | null>(null)
  const [editTp, setEditTp] = useState('')
  const [editSl, setEditSl] = useState('')

  useEffect(() => {
    if (!symbol || !(lastPrice > 0)) return
    markToMarket(symbol, lastPrice)
    tryFillLimits(symbol, lastPrice)
    checkExits(symbol, lastPrice)
  }, [symbol, lastPrice, markToMarket, tryFillLimits, checkExits])

  useEffect(() => {
    if (lastPrice > 0) {
      const s = String(lastPrice)
      setLongPrice((p) => p || s)
      setShortPrice((p) => p || s)
    }
  }, [lastPrice])

  const equity = useMemo(() => {
    const upnl = positions.reduce((s, p) => s + positionUnrealizedPnl(p), 0)
    return account.balance + upnl + positions.reduce((s, p) => s + p.margin, 0)
  }, [account.balance, positions])

  const totalUpnl = useMemo(
    () => positions.reduce((s, p) => s + positionUnrealizedPnl(p), 0),
    [positions]
  )

  const symPositions = positions.filter((p) => p.symbol === symbol.toUpperCase())
  const longPosQty = symPositions.filter((p) => p.side === 'long').reduce((s, p) => s + p.qty, 0)
  const shortPosQty = symPositions.filter((p) => p.side === 'short').reduce((s, p) => s + p.qty, 0)

  const maxBase = useMemo(() => {
    if (!(lastPrice > 0) || leverage < 1) return 0
    return (account.balance * leverage) / lastPrice
  }, [account.balance, leverage, lastPrice])

  const orderType: PaperOrderType = uiType === 'market' ? 'market' : 'limit'
  const postOnly = uiType === 'adv_limit'

  const submit = (side: PaperSide) => {
    setMsg(null)
    clearError()
    if (!(lastPrice > 0)) {
      setMsg('No live price – Start Live first')
      return
    }
    if (mode === 'close') {
      const r = closeSide(symbol, side, lastPrice)
      if (!r.ok) setMsg(r.error)
      else setMsg(`Closed ${r.closed} ${side} position(s)`)
      return
    }
    const amtStr = side === 'long' ? longAmt : shortAmt
    const priceStr = side === 'long' ? longPrice : shortPrice
    const qty = Number(amtStr)
    const limitPx = Number(priceStr)
    const tpStr = side === 'long' ? longTp : shortTp
    const slStr = side === 'long' ? longSl : shortSl
    const result = placeOrder({
      symbol,
      side,
      type: orderType,
      qty,
      leverage,
      price: orderType === 'limit' ? limitPx : null,
      markPrice: lastPrice,
      marginMode,
      takeProfit: tpslOn && tpStr ? Number(tpStr) : null,
      stopLoss: tpslOn && slStr ? Number(slStr) : null,
      postOnly,
    })
    if (!result.ok) setMsg(result.error)
    else setMsg(orderType === 'market' ? 'Market filled (paper)' : 'Order placed (paper)')
  }

  const marginPreview = (side: PaperSide) => {
    const qty = Number(side === 'long' ? longAmt : shortAmt)
    const px =
      orderType === 'limit'
        ? Number(side === 'long' ? longPrice : shortPrice) || lastPrice
        : lastPrice
    if (!(qty > 0) || !(px > 0) || leverage < 1) return 0
    return (qty * px) / leverage
  }

  const liqPreview = (side: PaperSide) => {
    if (marginMode !== 'isolated') return null
    const px =
      orderType === 'limit'
        ? Number(side === 'long' ? longPrice : shortPrice) || lastPrice
        : lastPrice
    if (!(px > 0)) return null
    return estLiqPrice({ side, entryPrice: px, leverage, marginMode })
  }

  const openOrders = orders.filter((o) => o.status === 'open')
  const histOrders = orders.filter((o) => o.status !== 'open').slice(0, 40)
  const closedFills = fills.filter((f) => f.action !== 'open').slice(0, 40)

  const bottomTabs: { id: BottomTab; label: string; count?: number }[] = [
    { id: 'positions', label: 'Positions', count: positions.length },
    { id: 'openOrders', label: 'Open Orders', count: openOrders.length },
    { id: 'orderHistory', label: 'Order History' },
    { id: 'positionHistory', label: 'Position History' },
  ]

  return (
    <div className="flex flex-col h-full min-h-0 text-[11px] bg-[#0b0e11]">
      <div className="px-2 py-1.5 border-b border-[#1e2329] flex flex-wrap gap-x-3 gap-y-0.5 shrink-0 font-mono-nums">
        <span className="text-[#848e9c]">{symbol}</span>
        <span className="text-[#f0b90b]">{marginMode === 'isolated' ? 'Isolated' : 'Cross'}</span>
        <span className="text-[#848e9c]">Equity</span>
        <span className="text-[#eaecef]">{fmt(equity)}</span>
        <span className="text-[#848e9c]">Avail</span>
        <span>{fmt(account.balance)}</span>
        <span className="text-[#848e9c]">uPnL</span>
        <span className={totalUpnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
          {totalUpnl >= 0 ? '+' : ''}{fmt(totalUpnl)}
        </span>
        <span className="text-[#848e9c]">Mark</span>
        <span className={lastPrice > 0 ? 'text-[#eaecef]' : 'text-[#f6465d]'}>{fmtPx(lastPrice)}</span>
      </div>

      <div className="flex px-2 pt-2 gap-1 shrink-0">
        <button type="button" className={`flex-1 py-1.5 rounded-full text-sm font-semibold ${
          mode === 'open' ? 'bg-[#0ecb81] text-[#0b0e11]' : 'bg-[#1e2329] text-[#848e9c]'
        }`} onClick={() => setMode('open')}>Open</button>
        <button type="button" className={`flex-1 py-1.5 rounded-full text-sm font-semibold ${
          mode === 'close' ? 'bg-[#f6465d] text-white' : 'bg-[#1e2329] text-[#848e9c]'
        }`} onClick={() => setMode('close')}>Close</button>
      </div>

      <div className="flex items-center gap-2 px-2 pt-2 shrink-0">
        <select className="bg-[#12161c] border border-[#1e2329] rounded px-2 py-1 text-[#eaecef]"
          value={marginMode} onChange={(e) => setMarginMode(e.target.value as PaperMarginMode)}>
          <option value="isolated">Isolated</option>
          <option value="cross">Cross</option>
        </select>
        <button type="button"
          className="ml-auto px-2 py-1 rounded border border-[#1e2329] text-[#f0b90b] font-mono-nums hover:border-[#f0b90b]/50"
          onClick={() => setShowLev((v) => !v)}>{leverage.toFixed(2)}x</button>
      </div>

      {showLev && (
        <div className="mx-2 mt-2 p-2 rounded border border-[#1e2329] bg-[#12161c] shrink-0">
          <div className="flex justify-between text-[#848e9c] mb-1">
            <span>Adjust Leverage</span>
            <span className="text-[#f0b90b] font-mono-nums">{leverage}x</span>
          </div>
          <input type="range" min={MIN_LEVERAGE} max={MAX_LEVERAGE} value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))} className="w-full accent-[#f0b90b]" />
          <div className="flex gap-1 mt-1">
            {[1, 5, 10, 20, 50, 75, 100, 125].map((v) => (
              <button key={v} type="button"
                className="flex-1 py-0.5 text-[10px] border border-[#1e2329] rounded hover:border-[#f0b90b]/40"
                onClick={() => setLeverage(v)}>{v}x</button>
            ))}
          </div>
          {leverage >= 50 && (
            <div className="mt-1.5 text-[10px] text-[#f0b90b]/90 bg-[#f0b90b]/10 px-1.5 py-1 rounded">
              High leverage: ~{(100 / leverage).toFixed(2)}% adverse move ≈ 100% margin loss (isolated).
            </div>
          )}
          <div className="mt-1 text-[10px] text-[#848e9c] font-mono-nums">
            Max notional @ {leverage}x: {fmt(account.balance * leverage)} USDT
          </div>
          <button type="button" className="mt-2 w-full py-1 rounded bg-[#f0b90b]/20 text-[#f0b90b]"
            onClick={() => setShowLev(false)}>Confirm</button>
        </div>
      )}

      <div className="flex gap-0.5 px-2 pt-2 shrink-0 overflow-x-auto">
        {([['limit', 'Limit'], ['market', 'Market'], ['adv_limit', 'Adv. Limit']] as const).map(([id, label]) => (
          <button key={id} type="button"
            className={`px-2 py-1 whitespace-nowrap ${
              uiType === id ? 'text-[#f0b90b] border-b-2 border-[#f0b90b]' : 'text-[#848e9c]'
            }`} onClick={() => setUiType(id)}>{label}</button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pt-2 pb-1">
        {mode === 'open' ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              {uiType !== 'market' && (
                <label className="block">
                  <span className="text-[#848e9c]">Price</span>
                  <div className="flex gap-1 mt-0.5">
                    <input className="flex-1 bg-[#12161c] border border-[#1e2329] rounded px-1.5 py-1 font-mono-nums"
                      value={longPrice} onChange={(e) => setLongPrice(e.target.value)} inputMode="decimal" />
                    <button type="button" className="px-1.5 text-[#0ecb81] border border-[#1e2329] rounded text-[10px]"
                      onClick={() => setLongPrice(String(lastPrice))}>Last</button>
                  </div>
                </label>
              )}
              <label className="block">
                <span className="text-[#848e9c]">Amount ({base})</span>
                <input className="mt-0.5 w-full bg-[#12161c] border border-[#1e2329] rounded px-1.5 py-1 font-mono-nums"
                  value={longAmt} onChange={(e) => setLongAmt(e.target.value)} inputMode="decimal" />
              </label>
              <div className="flex justify-between text-[10px] text-[#848e9c] font-mono-nums">
                <span>Available {fmt(account.balance)} USDT</span>
                <button type="button" className="text-[#0ecb81] hover:underline"
                  onClick={() => setLongAmt(maxBase > 0 ? String(Number(maxBase.toPrecision(6))) : '')}>
                  Max {fmtQty(maxBase)}
                </button>
              </div>
              <label className="flex items-center gap-1.5 text-[#848e9c]">
                <input type="checkbox" checked={tpslOn} onChange={(e) => setTpslOn(e.target.checked)} />
                Take Profit & Stop Loss
              </label>
              {tpslOn && (
                <div className="grid grid-cols-2 gap-1">
                  <input className="bg-[#12161c] border border-[#1e2329] rounded px-1 py-0.5 font-mono-nums"
                    placeholder="TP" value={longTp} onChange={(e) => setLongTp(e.target.value)} inputMode="decimal" />
                  <input className="bg-[#12161c] border border-[#1e2329] rounded px-1 py-0.5 font-mono-nums"
                    placeholder="SL" value={longSl} onChange={(e) => setLongSl(e.target.value)} inputMode="decimal" />
                </div>
              )}
              <button type="button"
                className="w-full py-2 rounded font-semibold text-sm bg-[#0ecb81] text-[#0b0e11] hover:brightness-110"
                onClick={() => submit('long')}>Open Long</button>
              <div className="text-[10px] text-[#848e9c] font-mono-nums space-y-0.5">
                <div className="flex justify-between"><span>Margin</span><span>{fmt(marginPreview('long'))} USDT</span></div>
                <div className="flex justify-between"><span>Est. Liq. Price</span><span>{fmtPx(liqPreview('long') ?? 0)}</span></div>
              </div>
            </div>

            <div className="space-y-1.5">
              {uiType !== 'market' && (
                <label className="block">
                  <span className="text-[#848e9c]">Price</span>
                  <div className="flex gap-1 mt-0.5">
                    <input className="flex-1 bg-[#12161c] border border-[#1e2329] rounded px-1.5 py-1 font-mono-nums"
                      value={shortPrice} onChange={(e) => setShortPrice(e.target.value)} inputMode="decimal" />
                    <button type="button" className="px-1.5 text-[#f6465d] border border-[#1e2329] rounded text-[10px]"
                      onClick={() => setShortPrice(String(lastPrice))}>Last</button>
                  </div>
                </label>
              )}
              <label className="block">
                <span className="text-[#848e9c]">Amount ({base})</span>
                <input className="mt-0.5 w-full bg-[#12161c] border border-[#1e2329] rounded px-1.5 py-1 font-mono-nums"
                  value={shortAmt} onChange={(e) => setShortAmt(e.target.value)} inputMode="decimal" />
              </label>
              <div className="flex justify-between text-[10px] text-[#848e9c] font-mono-nums">
                <span>Available {fmt(account.balance)} USDT</span>
                <button type="button" className="text-[#f6465d] hover:underline"
                  onClick={() => setShortAmt(maxBase > 0 ? String(Number(maxBase.toPrecision(6))) : '')}>
                  Max {fmtQty(maxBase)}
                </button>
              </div>
              <label className="flex items-center gap-1.5 text-[#848e9c]">
                <input type="checkbox" checked={tpslOn} onChange={(e) => setTpslOn(e.target.checked)} />
                Take Profit & Stop Loss
              </label>
              {tpslOn && (
                <div className="grid grid-cols-2 gap-1">
                  <input className="bg-[#12161c] border border-[#1e2329] rounded px-1 py-0.5 font-mono-nums"
                    placeholder="TP" value={shortTp} onChange={(e) => setShortTp(e.target.value)} inputMode="decimal" />
                  <input className="bg-[#12161c] border border-[#1e2329] rounded px-1 py-0.5 font-mono-nums"
                    placeholder="SL" value={shortSl} onChange={(e) => setShortSl(e.target.value)} inputMode="decimal" />
                </div>
              )}
              <button type="button"
                className="w-full py-2 rounded font-semibold text-sm bg-[#f6465d] text-white hover:brightness-110"
                onClick={() => submit('short')}>Open Short</button>
              <div className="text-[10px] text-[#848e9c] font-mono-nums space-y-0.5">
                <div className="flex justify-between"><span>Margin</span><span>{fmt(marginPreview('short'))} USDT</span></div>
                <div className="flex justify-between"><span>Est. Liq. Price</span><span>{fmtPx(liqPreview('short') ?? 0)}</span></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <div className="text-[#848e9c] text-[10px]">Short Position {fmtQty(shortPosQty)} {base}</div>
              <button type="button" className="w-full py-2 rounded font-semibold text-sm bg-[#0ecb81] text-[#0b0e11] disabled:opacity-40"
                disabled={shortPosQty <= 0} onClick={() => submit('short')}>Close Short</button>
            </div>
            <div className="space-y-2">
              <div className="text-[#848e9c] text-[10px]">Long Position {fmtQty(longPosQty)} {base}</div>
              <button type="button" className="w-full py-2 rounded font-semibold text-sm bg-[#f6465d] text-white disabled:opacity-40"
                disabled={longPosQty <= 0} onClick={() => submit('long')}>Close Long</button>
            </div>
          </div>
        )}

        {(msg || lastError) && (
          <div className={`mt-2 text-[10px] ${
            lastError || msg?.toLowerCase().includes('insufficient') || msg?.includes('must')
              ? 'text-[#f6465d]' : 'text-[#0ecb81]'
          }`}>{lastError || msg}</div>
        )}
      </div>

      <div className="border-t border-[#1e2329] shrink-0 flex flex-col max-h-[42%] min-h-[120px]">
        <div className="flex overflow-x-auto border-b border-[#1e2329] shrink-0">
          {bottomTabs.map((t) => (
            <button key={t.id} type="button"
              className={`px-2 py-1.5 whitespace-nowrap text-[10px] uppercase tracking-wide ${
                tab === t.id ? 'text-[#f0b90b] border-b-2 border-[#f0b90b]' : 'text-[#848e9c]'
              }`} onClick={() => setTab(t.id)}>
              {t.label}{t.count != null ? ` (${t.count})` : ''}
            </button>
          ))}
          <button type="button" className="ml-auto px-2 text-[10px] text-[#848e9c] hover:text-[#f6465d]"
            onClick={() => { if (confirm('Reset paper account to 10,000 USDT?')) resetAccount() }}>
            Reset
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto font-mono-nums text-[10px]">
          {tab === 'positions' && (positions.length === 0 ? (
            <div className="p-3 text-[#848e9c]">No open positions</div>
          ) : positions.map((p) => {
            const upnl = positionUnrealizedPnl(p)
            const liq = estLiqPrice(p)
            return (
              <div key={p.id} className="px-2 py-1.5 border-b border-[#1e2329]/60 space-y-0.5">
                <div className="flex justify-between">
                  <span>
                    <span className={p.side === 'long' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{p.side.toUpperCase()}</span>{' '}
                    {p.symbol} {p.leverage}x · {p.marginMode}
                  </span>
                  <span className={upnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                    {upnl >= 0 ? '+' : ''}{fmt(upnl)}
                  </span>
                </div>
                <div className="text-[#848e9c] flex flex-wrap gap-x-2">
                  <span>Entry {fmtPx(p.entryPrice)}</span>
                  <span>Mark {fmtPx(p.markPrice)}</span>
                  <span>Qty {fmtQty(p.qty)}</span>
                  <span>Margin {fmt(p.margin)}</span>
                  {liq != null && <span>Liq {fmtPx(liq)}</span>}
                  <span>TP {p.takeProfit != null ? fmtPx(p.takeProfit) : '—'} · SL {p.stopLoss != null ? fmtPx(p.stopLoss) : '—'}</span>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="text-[#f0b90b] hover:underline"
                    onClick={() => {
                      setEditTpslId(editTpslId === p.id ? null : p.id)
                      setEditTp(p.takeProfit != null ? String(p.takeProfit) : '')
                      setEditSl(p.stopLoss != null ? String(p.stopLoss) : '')
                    }}>TP/SL</button>
                  <button type="button" className="text-[#f6465d] hover:underline"
                    onClick={() => {
                      if (!(lastPrice > 0)) { setMsg('No live price'); return }
                      const r = closePosition(p.id, lastPrice)
                      setMsg(r.ok ? 'Closed' : r.error)
                    }}>Close</button>
                </div>
                {editTpslId === p.id && (
                  <div className="flex gap-1 items-end pt-0.5">
                    <input className="flex-1 bg-[#12161c] border border-[#1e2329] rounded px-1 py-0.5"
                      placeholder="TP" value={editTp} onChange={(e) => setEditTp(e.target.value)} />
                    <input className="flex-1 bg-[#12161c] border border-[#1e2329] rounded px-1 py-0.5"
                      placeholder="SL" value={editSl} onChange={(e) => setEditSl(e.target.value)} />
                    <button type="button" className="px-2 py-0.5 bg-[#f0b90b]/20 text-[#f0b90b] rounded"
                      onClick={() => {
                        const r = setTpsl(p.id, editTp ? Number(editTp) : null, editSl ? Number(editSl) : null)
                        if (!r.ok) setMsg(r.error)
                        else { setMsg('TP/SL saved'); setEditTpslId(null) }
                      }}>Save</button>
                  </div>
                )}
              </div>
            )
          }))}

          {tab === 'openOrders' && (openOrders.length === 0 ? (
            <div className="p-3 text-[#848e9c]">No open orders</div>
          ) : openOrders.map((o) => (
            <div key={o.id} className="px-2 py-1 border-b border-[#1e2329]/60 flex justify-between gap-2">
              <span>
                <span className={o.side === 'long' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{o.side}</span>{' '}
                {o.type}{o.postOnly ? ' post' : ''} {o.symbol} {fmtQty(o.qty)} @ {fmtPx(o.price ?? 0)}
              </span>
              <button type="button" className="text-[#f6465d] hover:underline shrink-0"
                onClick={() => cancelOrder(o.id)}>Cancel</button>
            </div>
          )))}

          {tab === 'orderHistory' && (histOrders.length === 0 ? (
            <div className="p-3 text-[#848e9c]">No order history</div>
          ) : histOrders.map((o) => (
            <div key={o.id} className="px-2 py-1 border-b border-[#1e2329]/60 text-[#848e9c]">
              <span className={o.side === 'long' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{o.side}</span>{' '}
              {o.type} {o.symbol} {fmtQty(o.qty)} · {o.status}
              {o.fillPrice != null ? ` @ ${fmtPx(o.fillPrice)}` : ''}
              <span className="ml-1">{new Date(o.filledAt ?? o.createdAt).toLocaleString()}</span>
            </div>
          )))}

          {tab === 'positionHistory' && (closedFills.length === 0 ? (
            <div className="p-3 text-[#848e9c]">No closed positions</div>
          ) : closedFills.map((f) => (
            <div key={f.id} className="px-2 py-1 border-b border-[#1e2329]/60 flex justify-between">
              <span>
                <span className={
                  f.action === 'liquidate' || f.action === 'sl' ? 'text-[#a855f7]'
                    : f.action === 'tp' ? 'text-[#f0b90b]'
                      : f.side === 'long' ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                }>
                  {f.action === 'liquidate' ? 'Liquidated' : f.action === 'close' ? 'Fully Closed' : f.action.toUpperCase()}
                </span>{' '}{f.side} {f.symbol} {fmtQty(f.qty)} @ {fmtPx(f.price)}
              </span>
              <span className={f.realizedPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                {f.realizedPnl >= 0 ? '+' : ''}{fmt(f.realizedPnl)}
              </span>
            </div>
          )))}
        </div>
      </div>

      <div className="px-2 py-1 text-[9px] text-[#5e6673] border-t border-[#1e2329] shrink-0">
        Paper · KuCoin-style Manual · real mark only · no API keys
      </div>
    </div>
  )
}
