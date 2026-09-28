/**
 * Complete wallet panel – spot holdings + paper equity.
 * Logos: CoinIcon (official pack). Prices: live Binance 24h. No mock values.
 */

import { useMemo, useState } from 'react'
import { CoinIcon } from '@/ui/CoinIcon'
import { useWalletStore } from './walletStore'
import { useWalletPrices } from './useWalletPrices'
import { usePaperStore, positionUnrealizedPnl } from '@/trading/paper'
import { SYMBOL_PRESETS } from '@/data/symbols'

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtQty(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1000) return n.toFixed(2)
  if (n >= 1) return n.toFixed(4)
  return n.toPrecision(6)
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const s = n.toFixed(2)
  return n >= 0 ? `+${s}%` : `${s}%`
}

export function WalletPanel() {
  const holdings = useWalletStore((s) => s.holdings)
  const cashUsdt = useWalletStore((s) => s.cashUsdt)
  const addOrUpdate = useWalletStore((s) => s.addOrUpdate)
  const remove = useWalletStore((s) => s.remove)
  const setCashUsdt = useWalletStore((s) => s.setCashUsdt)

  const paperBal = usePaperStore((s) => s.account.balance)
  const positions = usePaperStore((s) => s.positions)

  const [assetIn, setAssetIn] = useState('')
  const [qtyIn, setQtyIn] = useState('')
  const [cashIn, setCashIn] = useState(String(cashUsdt))
  const [err, setErr] = useState<string | null>(null)

  const assets = useMemo(() => holdings.map((h) => h.asset), [holdings])
  const prices = useWalletPrices(assets)

  const spotRows = useMemo(() => {
    return holdings.map((h) => {
      const t = prices[h.asset]
      const px = t?.lastPrice
      const value = px != null ? h.qty * px : null
      return {
        ...h,
        price: px ?? null,
        change: t?.priceChangePercent ?? null,
        value,
        missingPrice: px == null,
      }
    })
  }, [holdings, prices])

  const spotTotal = useMemo(
    () => spotRows.reduce((s, r) => s + (r.value ?? 0), 0) + cashUsdt,
    [spotRows, cashUsdt]
  )

  const paperUPnl = useMemo(
    () => positions.reduce((s, p) => s + positionUnrealizedPnl(p), 0),
    [positions]
  )
  const paperMargin = useMemo(
    () => positions.reduce((s, p) => s + p.margin, 0),
    [positions]
  )
  const paperEquity = paperBal + paperMargin + paperUPnl

  const grandTotal = spotTotal + paperEquity

  const onAdd = () => {
    setErr(null)
    const a = assetIn.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    const q = Number(qtyIn)
    if (!a) {
      setErr('Asset required (e.g. BTC)')
      return
    }
    if (!Number.isFinite(q) || q < 0) {
      setErr('Invalid quantity')
      return
    }
    addOrUpdate(a, q)
    setAssetIn('')
    setQtyIn('')
  }

  const onCash = () => {
    const n = Number(cashIn)
    if (!Number.isFinite(n) || n < 0) {
      setErr('Invalid cash USDT')
      return
    }
    setCashUsdt(n)
    setErr(null)
  }

  const presets = useMemo(
    () =>
      Array.from(
        new Set(SYMBOL_PRESETS.map((p) => p.label).filter((x) => x && x !== 'USDT'))
      ).slice(0, 80),
    []
  )

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[11px]">
      {/* Equity header */}
      <div className="shrink-0 px-3 py-2.5 border-b border-[#2b3139] space-y-1">
        <div className="text-[10px] text-[#848e9c] uppercase tracking-wider">Total equity</div>
        <div className="text-xl font-semibold text-[#eaecef] font-mono-nums tabular-nums">
          ${fmtUsd(grandTotal)}
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] text-[#848e9c]">
          <span>
            Spot <span className="text-[#eaecef] font-mono-nums">${fmtUsd(spotTotal)}</span>
          </span>
          <span>
            Paper <span className="text-[#eaecef] font-mono-nums">${fmtUsd(paperEquity)}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Spot holdings */}
        <div className="px-2 py-1.5 border-b border-[#2b3139]/50">
          <div className="text-[10px] text-[#5e6673] uppercase tracking-wider px-1 mb-1">
            Spot holdings
          </div>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 px-1 text-[9px] text-[#5e6673] mb-0.5">
            <span>Asset</span>
            <span className="text-right min-w-[4.5rem]">Price</span>
            <span className="text-right min-w-[4.5rem]">Value</span>
            <span className="w-5" />
          </div>

          {/* USDT cash row */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 items-center px-1 py-1.5 rounded hover:bg-[#12161c]">
            <div className="flex items-center gap-2 min-w-0">
              <CoinIcon symbol="USDT" size={22} />
              <div className="min-w-0">
                <div className="font-semibold text-[#eaecef]">USDT</div>
                <div className="text-[9px] text-[#5e6673] font-mono-nums">
                  {fmtQty(cashUsdt)} cash
                </div>
              </div>
            </div>
            <span className="text-right font-mono-nums text-[#848e9c] min-w-[4.5rem]">1.00</span>
            <span className="text-right font-mono-nums text-[#eaecef] min-w-[4.5rem]">
              ${fmtUsd(cashUsdt)}
            </span>
            <span className="w-5" />
          </div>

          {spotRows.length === 0 && (
            <p className="px-1 py-2 text-[#5e6673] text-[10px]">No spot assets – add below</p>
          )}

          {spotRows.map((r) => {
            const up = (r.change ?? 0) >= 0
            return (
              <div
                key={r.asset}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 items-center px-1 py-1.5 rounded hover:bg-[#12161c]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CoinIcon symbol={r.asset} size={22} />
                  <div className="min-w-0">
                    <div className="font-semibold text-[#eaecef] flex items-center gap-1.5">
                      {r.asset}
                      {r.change != null && (
                        <span
                          className={`text-[9px] font-mono-nums ${
                            up ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                          }`}
                        >
                          {fmtPct(r.change)}
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-[#5e6673] font-mono-nums">
                      {fmtQty(r.qty)}
                      {r.missingPrice && (
                        <span className="text-[#f0b90b] ml-1">no price</span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-right font-mono-nums text-[#848e9c] min-w-[4.5rem]">
                  {r.price != null ? fmtUsd(r.price) : '—'}
                </span>
                <span className="text-right font-mono-nums text-[#eaecef] min-w-[4.5rem]">
                  {r.value != null ? `$${fmtUsd(r.value)}` : '—'}
                </span>
                <button
                  type="button"
                  className="w-5 text-[#5e6673] hover:text-[#f6465d] text-xs"
                  title="Remove"
                  onClick={() => remove(r.asset)}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>

        {/* Paper positions */}
        <div className="px-2 py-1.5 border-b border-[#2b3139]/50">
          <div className="text-[10px] text-[#5e6673] uppercase tracking-wider px-1 mb-1">
            Paper · cash ${fmtUsd(paperBal)} · uPnL{' '}
            <span className={paperUPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
              {paperUPnl >= 0 ? '+' : ''}
              {fmtUsd(paperUPnl)}
            </span>
          </div>
          {positions.length === 0 ? (
            <p className="px-1 py-1 text-[#5e6673] text-[10px]">No open paper positions</p>
          ) : (
            positions.map((p) => {
              const pnl = positionUnrealizedPnl(p)
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-[#12161c]"
                >
                  <CoinIcon symbol={p.symbol} size={20} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[#eaecef]">
                      {p.symbol}{' '}
                      <span
                        className={
                          p.side === 'long' ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                        }
                      >
                        {p.side.toUpperCase()}
                      </span>{' '}
                      <span className="text-[#848e9c] font-normal">{p.leverage}x</span>
                    </div>
                    <div className="text-[9px] text-[#5e6673] font-mono-nums">
                      {fmtQty(p.qty)} @ {fmtUsd(p.entryPrice)}
                    </div>
                  </div>
                  <span
                    className={`font-mono-nums ${
                      pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                    }`}
                  >
                    {pnl >= 0 ? '+' : ''}
                    {fmtUsd(pnl)}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* Add form */}
        <div className="px-3 py-2 space-y-2">
          <div className="text-[10px] text-[#5e6673] uppercase tracking-wider">Add / update asset</div>
          <div className="flex gap-1.5">
            <input
              className="w-[5.5rem] bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1 text-[11px] text-[#eaecef] font-mono"
              placeholder="BTC"
              list="wallet-assets"
              value={assetIn}
              onChange={(e) => setAssetIn(e.target.value.toUpperCase())}
            />
            <datalist id="wallet-assets">
              {presets.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
            <input
              className="flex-1 bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1 text-[11px] text-[#eaecef] font-mono-nums"
              placeholder="Qty"
              value={qtyIn}
              onChange={(e) => setQtyIn(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAdd()}
            />
            <button
              type="button"
              onClick={onAdd}
              className="px-2 py-1 rounded bg-[#0ecb81]/20 text-[#0ecb81] border border-[#0ecb81]/40 text-[11px] font-semibold"
            >
              Save
            </button>
          </div>
          <div className="flex gap-1.5 items-center">
            <span className="text-[10px] text-[#848e9c] shrink-0">Cash USDT</span>
            <input
              className="flex-1 bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1 text-[11px] text-[#eaecef] font-mono-nums"
              value={cashIn}
              onChange={(e) => setCashIn(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onCash()}
            />
            <button
              type="button"
              onClick={onCash}
              className="px-2 py-1 rounded bg-[#1e2329] text-[#eaecef] border border-[#2b3139] text-[11px]"
            >
              Set
            </button>
          </div>
          {err && <p className="text-[10px] text-[#f6465d]">{err}</p>}
          <p className="text-[9px] text-[#5e6673] leading-snug">
            Prices: Binance public 24h · logos: official icon pack · paper from Trade panel
          </p>
        </div>
      </div>
    </div>
  )
}
