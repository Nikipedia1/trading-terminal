/**
 * Compact execution bar: mode, hotkeys, default size, vault/live arm.
 */

import { useState } from 'react'
import { useExecutionStore } from '@/trading/execution/executionStore'
import {
  vaultStore,
  vaultUnlock,
  vaultDelete,
  listVaultMeta,
  setSessionCredentials,
  type LiveVenue,
} from '@/trading/credentials/vault'
import { LIVE_NOTES } from '@/trading/live/binanceSigned'
import { auditList, auditExportJson, auditClear } from '@/trading/audit/auditLog'

export function ExecutionBar() {
  const mode = useExecutionStore((s) => s.mode)
  const liveRiskAccepted = useExecutionStore((s) => s.liveRiskAccepted)
  const hotkeysEnabled = useExecutionStore((s) => s.hotkeysEnabled)
  const defaultQty = useExecutionStore((s) => s.defaultQty)
  const armLive = useExecutionStore((s) => s.armLive)
  const disarmLive = useExecutionStore((s) => s.disarmLive)
  const acceptLiveRisk = useExecutionStore((s) => s.acceptLiveRisk)
  const setHotkeysEnabled = useExecutionStore((s) => s.setHotkeysEnabled)
  const setDefaultQty = useExecutionStore((s) => s.setDefaultQty)

  const [showVault, setShowVault] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const [venue, setVenue] = useState<LiveVenue>('binance_futures')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [pass, setPass] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const meta = listVaultMeta()

  const saveVault = async () => {
    const r = await vaultStore(venue, apiKey, apiSecret, pass)
    setMsg(r.ok ? 'Vault saved (encrypted)' : r.error)
    if (r.ok) {
      setApiKey('')
      setApiSecret('')
    }
  }

  const unlock = async () => {
    const r = await vaultUnlock(venue, pass)
    if (!r.ok) {
      setMsg(r.error)
      return
    }
    setSessionCredentials(venue, r.apiKey, r.apiSecret)
    setMsg('Session unlocked – arm live to trade')
    setApiKey('')
    setApiSecret('')
  }

  return (
    <div className="border-b border-[#1e2329] bg-[#0b0e11] text-[10px]">
      <div className="flex flex-wrap items-center gap-2 px-2 py-1">
        <span
          className={`px-1.5 py-0.5 rounded font-semibold ${
            mode === 'paper'
              ? 'bg-[#1e2329] text-[#f0b90b]'
              : 'bg-[#f6465d]/20 text-[#f6465d]'
          }`}
        >
          {mode === 'paper' ? 'PAPER' : 'LIVE ARMED'}
        </span>

        <label className="flex items-center gap-1 text-[#848e9c]">
          <input
            type="checkbox"
            className="accent-[#f0b90b]"
            checked={hotkeysEnabled}
            onChange={(e) => setHotkeysEnabled(e.target.checked)}
          />
          Hotkeys B/S · Shift+B/S · Esc
        </label>

        <label className="flex items-center gap-1 text-[#848e9c]">
          qty
          <input
            type="number"
            step="any"
            className="w-16 bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[#eaecef]"
            value={defaultQty}
            onChange={(e) => setDefaultQty(Number(e.target.value) || 0.001)}
          />
        </label>

        <button
          type="button"
          className="px-1.5 py-0.5 rounded border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]"
          onClick={() => setShowVault((v) => !v)}
        >
          Keys
        </button>
        <button
          type="button"
          className="px-1.5 py-0.5 rounded border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]"
          onClick={() => setShowAudit((v) => !v)}
        >
          Audit
        </button>

        {mode === 'paper' ? (
          <button
            type="button"
            className="px-1.5 py-0.5 rounded border border-[#f6465d]/40 text-[#f6465d] ml-auto"
            onClick={() => {
              if (!liveRiskAccepted) {
                const ok = window.confirm(
                  'LIVE TRADING RISK\n\n' +
                    'Real orders may lose money. Use withdraw-disabled keys.\n' +
                    'Paper and live are separate. Continue?'
                )
                if (!ok) return
                acceptLiveRisk()
              }
              armLive()
            }}
          >
            Arm Live
          </button>
        ) : (
          <button
            type="button"
            className="px-1.5 py-0.5 rounded bg-[#f6465d]/20 text-[#f6465d] ml-auto"
            onClick={() => disarmLive()}
          >
            Disarm Live
          </button>
        )}
      </div>

      {showVault && (
        <div className="px-2 pb-2 border-t border-[#1e2329] space-y-1.5">
          <div className="text-[#5e6673]">{LIVE_NOTES.join(' · ')}</div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5"
              value={venue}
              onChange={(e) => setVenue(e.target.value as LiveVenue)}
            >
              <option value="binance_futures">Binance Futures</option>
              <option value="binance_spot">Binance Spot</option>
            </select>
            <input
              className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 w-36"
              placeholder="API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            <input
              className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 w-36"
              placeholder="API Secret"
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              autoComplete="off"
            />
            <input
              className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 w-28"
              placeholder="Passphrase"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              className="px-2 py-0.5 rounded bg-[#1e2329] text-[#eaecef]"
              onClick={() => void saveVault()}
            >
              Encrypt & save
            </button>
            <button
              type="button"
              className="px-2 py-0.5 rounded bg-[#0ecb81]/20 text-[#0ecb81]"
              onClick={() => void unlock()}
            >
              Unlock session
            </button>
            <button
              type="button"
              className="px-2 py-0.5 rounded text-[#f6465d]"
              onClick={() => {
                vaultDelete(venue)
                setMsg('Deleted vault entry')
              }}
            >
              Delete
            </button>
          </div>
          {meta.length > 0 && (
            <div className="text-[#848e9c]">
              Stored:{' '}
              {meta.map((m) => `${m.venue} (${m.keyHint})`).join(' · ')}
            </div>
          )}
          {msg && <div className="text-[#f0b90b]">{msg}</div>}
        </div>
      )}

      {showAudit && (
        <div className="px-2 pb-2 border-t border-[#1e2329] max-h-40 overflow-auto">
          <div className="flex gap-2 mb-1">
            <button
              type="button"
              className="text-[#0ecb81]"
              onClick={() => {
                const blob = new Blob([auditExportJson()], { type: 'application/json' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `tt-audit-${Date.now()}.json`
                a.click()
              }}
            >
              Export JSON
            </button>
            <button type="button" className="text-[#f6465d]" onClick={() => auditClear()}>
              Clear
            </button>
          </div>
          <ul className="font-mono space-y-0.5 text-[#848e9c]">
            {auditList(40).map((e) => (
              <li key={e.id}>
                {new Date(e.ts).toLocaleTimeString()} [{e.mode}] {e.action}{' '}
                {e.symbol ?? ''} — {e.detail}
                {!e.ok && <span className="text-[#f6465d]"> FAIL</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
