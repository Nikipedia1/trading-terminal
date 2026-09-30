import { useState } from 'react'
import {
  loadLiveKeys,
  saveLiveKeys,
  clearLiveKeys,
  LIVE_DISCLOSURE,
  type ExchangeKeyBlob,
} from './exchangeKeys'
import { useIsReadOnly } from '@/stores/sessionModeStore'

export function LiveKeysPanel() {
  const readOnly = useIsReadOnly()
  const existing = typeof window !== 'undefined' ? loadLiveKeys() : null
  const [accepted, setAccepted] = useState(!!existing?.disclosureAcceptedAt)
  const [exchange, setExchange] = useState(existing?.exchange ?? 'binance')
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '')
  const [apiSecret, setApiSecret] = useState(existing?.apiSecret ?? '')
  const [msg, setMsg] = useState('')

  const save = () => {
    if (!accepted) {
      setMsg('Accept the disclosure first')
      return
    }
    if (readOnly) {
      setMsg('Guest read-only')
      return
    }
    const blob: ExchangeKeyBlob = {
      exchange,
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      disclosureAcceptedAt: Date.now(),
    }
    saveLiveKeys(blob)
    setMsg('Saved in session only – not on our servers')
  }

  return (
    <div className="h-full flex flex-col text-[11px] bg-[#0b0e11] text-[#eaecef]">
      <div className="px-2 py-1.5 border-b border-[#1e2329] font-semibold text-[#f0b90b]">
        Live keys (client-side)
      </div>
      <div className="p-2 space-y-2 overflow-auto flex-1">
        <pre className="text-[9px] text-[#848e9c] whitespace-pre-wrap leading-relaxed border border-[#2b3139] rounded p-2 max-h-32 overflow-auto">
          {LIVE_DISCLOSURE}
        </pre>
        <label className="flex items-center gap-2 text-[10px]">
          <input
            type="checkbox"
            checked={accepted}
            disabled={readOnly}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          I understand and accept
        </label>
        <select
          className="w-full bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1"
          value={exchange}
          disabled={readOnly || !accepted}
          onChange={(e) => setExchange(e.target.value)}
        >
          <option value="binance">Binance</option>
          <option value="bybit">Bybit</option>
          <option value="okx">OKX</option>
        </select>
        <input
          type="password"
          autoComplete="off"
          placeholder="API Key"
          className="w-full bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1 font-mono"
          value={apiKey}
          disabled={readOnly || !accepted}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <input
          type="password"
          autoComplete="off"
          placeholder="API Secret"
          className="w-full bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1 font-mono"
          value={apiSecret}
          disabled={readOnly || !accepted}
          onChange={(e) => setApiSecret(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={readOnly}
            className="px-2 py-1 rounded bg-[#f0b90b] text-[#0b0e11] font-medium disabled:opacity-40"
          >
            Save in tab
          </button>
          <button
            type="button"
            onClick={() => {
              clearLiveKeys()
              setApiKey('')
              setApiSecret('')
              setMsg('Cleared')
            }}
            className="px-2 py-1 rounded border border-[#2b3139] text-[#848e9c]"
          >
            Clear
          </button>
        </div>
        {msg && <p className="text-[10px] text-[#0ecb81]">{msg}</p>}
      </div>
    </div>
  )
}
