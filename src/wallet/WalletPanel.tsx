/**
 * Wallet panel – multi-account, spot holdings + paper equity.
 * Logos: CoinIcon. Prices: live Binance 24h.
 */

import { useEffect, useMemo, useState } from 'react'
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
  const accounts = useWalletStore((s) => s.accounts)
  const activeId = useWalletStore((s) => s.activeId)
  const holdings = useWalletStore((s) => s.holdings)
  const cashUsdt = useWalletStore((s) => s.cashUsdt)
  const setActive = useWalletStore((s) => s.setActive)
  const createAccount = useWalletStore((s) => s.createAccount)
  const renameAccount = useWalletStore((s) => s.renameAccount)
  const deleteAccount = useWalletStore((s) => s.deleteAccount)
  const addOrUpdate = useWalletStore((s) => s.addOrUpdate)
  const remove = useWalletStore((s) => s.remove)
  const setCashUsdt = useWalletStore((s) => s.setCashUsdt)
  const resetActive = useWalletStore((s) => s.resetActive)
  const resetAll = useWalletStore((s) => s.resetAll)

  const paperBal = usePaperStore((s) => s.account.balance)
  const positions = usePaperStore((s) => s.positions)

  const active = accounts.find((a) => a.id === activeId) ?? accounts[0]

  const [assetIn, setAssetIn] = useState('')
  const [qtyIn, setQtyIn] = useState('')
  const [cashIn, setCashIn] = useState(String(cashUsdt))
  const [newName, setNewName] = useState('')
  const [renameIn, setRenameIn] = useState(active?.name ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState<'active' | 'all' | null>(null)

  useEffect(() => {
    setCashIn(String(cashUsdt))
  }, [cashUsdt, activeId])

  useEffect(() => {
    setRenameIn(active?.name ?? '')
  }, [active?.name, activeId])

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

  const presets = useMemo(() => {
    const set = new Set<string>()
    for (const p of SYMBOL_PRESETS) {
      const base = p.symbol.replace(/USDT$/, '').replace(/BUSD$/, '')
      if (base) set.add(base)
    }
    return [...set].sort()
  }, [])

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
    setErr(null)
    const n = Number(cashIn)
    if (!Number.isFinite(n) || n < 0) {
      setErr('Invalid cash')
      return
    }
    setCashUsdt(n)
  }

  const onCreate = () => {
    setErr(null)
    const id = createAccount(newName)
    if (!id) {
      setErr('Max 12 accounts')
      return
    }
    setNewName('')
  }

  const onRename = () => {
    if (!active) return
    renameAccount(active.id, renameIn)
  }

  const onDelete = () => {
    if (!active) return
    if (accounts.length <= 1) {
      setErr('Cannot delete last account – use Reset')
      return
    }
    deleteAccount(active.id)
  }

  const doReset = () => {
    if (confirmReset === 'all') resetAll()
    else resetActive()
    setConfirmReset(null)
    setCashIn('0')
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[11px] text-[#eaecef]">
      <div className="shrink-0 px-2 pt-2 pb-1.5 border-b border-[#1e2329] space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-[#848e9c] uppercase tracking-wider shrink-0">
            Account
          </span>
          <select
            value={activeId}
            onChange={(e) => setActive(e.target.value)}
            className="flex-1 min-w-0 bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1 text-[11px] text-[#eaecef] outline-none focus:border-[#f0b90b]/50"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            title="Reset this account"
            onClick={() => setConfirmReset('active')}
            className="px-1.5 py-1 rounded text-[10px] bg-[#f6465d]/15 text-[#f6465d] border border-[#f6465d]/30 hover:bg-[#f6465d]/25"
          >
            Reset
          </button>
        </div>
        <div className="flex gap-1 flex-wrap">
          <input
            className="flex-1 min-w-[5rem] bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-0.5 text-[10px] text-[#eaecef]"
            placeholder="New account name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onCreate()}
          />
          <button
            type="button"
            onClick={onCreate}
            className="px-1.5 py-0.5 rounded bg-[#0ecb81]/15 text-[#0ecb81] border border-[#0ecb81]/30 text-[10px]"
          >
            + New
          </button>
          <input
            className="w-[6rem] bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-0.5 text-[10px] text-[#eaecef]"
            placeholder="Rename"
            value={renameIn}
            onChange={(e) => setRenameIn(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onRename()}
          />
          <button
            type="button"
            onClick={onRename}
            className="px-1.5 py-0.5 rounded bg-[#1e2329] text-[#b7bdc6] border border-[#2b3139] text-[10px]"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="px-1.5 py-0.5 rounded text-[10px] text-[#848e9c] border border-[#2b3139] hover:text-[#f6465d] hover:border-[#f6465d]/40"
          >
            Delete
          </button>
        </div>
        {confirmReset && (
          <div className="flex flex-wrap items-center gap-1.5 px-1 py-1 rounded bg-[#f6465d]/10 border border-[#f6465d]/30">
            <span className="text-[10px] text-[#f6465d]">
              {confirmReset === 'all'
                ? 'Reset ALL accounts to empty Main?'
                : `Clear “${active?.name}” holdings + cash?`}
            </span>
            <button
              type="button"
              onClick={doReset}
              className="px-1.5 py-0.5 rounded bg-[#f6465d]/25 text-[#f6465d] text-[10px] font-semibold"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(null)}
              className="px-1.5 py-0.5 rounded text-[10px] text-[#848e9c]"
            >
              Cancel
            </button>
            {confirmReset === 'active' && (
              <button
                type="button"
                onClick={() => setConfirmReset('all')}
                className="px-1.5 py-0.5 rounded text-[10px] text-[#f0b90b] border border-[#f0b90b]/30"
              >
                Reset all…
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-3 py-2 border-b border-[#1e2329] space-y-1">
          <div className="flex justify-between items-baseline">
            <span className="text-[9px] text-[#848e9c] uppercase tracking-wider">
              {active?.name ?? 'Wallet'} total
            </span>
            <span className="text-[15px] font-semibold font-mono-nums text-[#f0b90b]">
              ${fmtUsd(spotTotal)}
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-[#5e6673]">
            <span>
              Spot ${fmtUsd(spotTotal - cashUsdt)} · Cash ${fmtUsd(cashUsdt)}
            </span>
            <span>
              Paper ${fmtUsd(paperEquity)} · Σ ${fmtUsd(grandTotal)}
            </span>
          </div>
        </div>

        <div className="px-2 py-1.5 border-b border-[#1e2329]">
          <div className="text-[9px] text-[#848e9c] uppercase tracking-wider px-1 mb-1">
            Holdings
          </div>
          {spotRows.length === 0 ? (
            <p className="text-[10px] text-[#5e6673] px-1 py-2">Empty — add assets below</p>
          ) : (
            <div className="space-y-0.5">
              {spotRows.map((r) => (
                <div
                  key={r.asset}
                  className="flex items-center gap-2 px-1 py-1 rounded hover:bg-[#12161c] group"
                >
                  <CoinIcon symbol={r.asset} size={18} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{r.asset}</span>
                      {r.change != null && (
                        <span
                          className={`text-[9px] font-mono-nums ${
                            r.change >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                          }`}
                        >
                          {fmtPct(r.change)}
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-[#5e6673] font-mono-nums">
                      {fmtQty(r.qty)}
                      {r.price != null ? ` · $${fmtUsd(r.price)}` : ' · no price'}
                    </div>
                  </div>
                  <span
                    className={`font-mono-nums tabular-nums ${
                      r.missingPrice ? 'text-[#5e6673]' : 'text-[#eaecef]'
                    }`}
                  >
                    {r.value != null ? `$${fmtUsd(r.value)}` : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(r.asset)}
                    className="opacity-0 group-hover:opacity-100 text-[#f6465d] text-[10px] px-1"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-2 py-1.5 border-b border-[#1e2329]">
          <div className="text-[9px] text-[#848e9c] uppercase tracking-wider px-1 mb-1">
            Paper (shared)
          </div>
          {positions.length === 0 ? (
            <p className="text-[10px] text-[#5e6673] px-1">No open positions</p>
          ) : (
            positions.map((p) => {
              const pnl = positionUnrealizedPnl(p)
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-1 py-0.5"
                >
                  <div>
                    <span
                      className={
                        p.side === 'long' ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                      }
                    >
                      {p.side.toUpperCase()}
                    </span>{' '}
                    <span className="text-[#848e9c]">{p.symbol}</span>
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

        <div className="px-3 py-2 space-y-2">
          <div className="text-[10px] text-[#5e6673] uppercase tracking-wider">
            Add / update asset
          </div>
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
            Multi-account · prices Binance 24h · paper from Trade panel
          </p>
        </div>
      </div>
    </div>
  )
}
