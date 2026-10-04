/**
 * On-chain analysis desk panel – multi-chain + address inspector.
 * Live data: GET /api/onchain, GET /api/onchain/address. No runtime mocks.
 */

import { useCallback, useEffect, useState } from 'react'
import type {
  AddressChain,
  AddressLookupResult,
  OnchainSnapshot,
  OnchainTab,
} from './types'
import { OnchainBody, fmt, fmtWhen } from './OnchainViews'
import { detectAddressChain, validateAddressFormat } from './addressUtils'

const POLL_MS = 60_000

const TABS: { id: OnchainTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'btc', label: 'BTC' },
  { id: 'eth', label: 'ETH' },
  { id: 'sol', label: 'SOL' },
  { id: 'ltc', label: 'LTC' },
  { id: 'alts', label: 'Alts' },
  { id: 'defi', label: 'DeFi' },
  { id: 'address', label: 'Address' },
]

const CHAIN_OPTS: { id: AddressChain; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'btc', label: 'BTC' },
  { id: 'eth', label: 'ETH' },
  { id: 'sol', label: 'SOL' },
  { id: 'ltc', label: 'LTC' },
]

export function OnchainPanel() {
  const [tab, setTab] = useState<OnchainTab>('overview')
  const [data, setData] = useState<OnchainSnapshot | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [addrInput, setAddrInput] = useState('')
  const [addrChain, setAddrChain] = useState<AddressChain>('auto')
  const [addrLoading, setAddrLoading] = useState(false)
  const [addrResult, setAddrResult] = useState<AddressLookupResult | null>(null)
  const [addrErr, setAddrErr] = useState<string | null>(null)
  const [formatHint, setFormatHint] = useState<string | null>(null)

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res = await fetch('/api/onchain', {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as OnchainSnapshot
      setData(json)
      setErr(null)
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : 'Cannot reach /api/onchain. Deploy CF Functions or run npm run cf:pages:dev'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, POLL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  useEffect(() => {
    const a = addrInput.trim()
    if (!a) {
      setFormatHint(null)
      return
    }
    const detected = detectAddressChain(a)
    if (addrChain === 'auto') {
      setFormatHint(
        detected
          ? `Rilevato: ${detected.toUpperCase()} ✓`
          : 'Formato non riconosciuto – seleziona chain'
      )
    } else {
      const v = validateAddressFormat(addrChain, a)
      setFormatHint(v ?? `Formato ${addrChain.toUpperCase()} ✓`)
    }
  }, [addrInput, addrChain])

  const lookupAddress = useCallback(async () => {
    const a = addrInput.trim()
    if (!a) return
    setAddrLoading(true)
    setAddrErr(null)
    setAddrResult(null)
    try {
      const chainParam =
        addrChain === 'auto' ? detectAddressChain(a) ?? '' : addrChain
      if (addrChain !== 'auto') {
        const v = validateAddressFormat(addrChain, a)
        if (v) throw new Error(v)
      } else if (!chainParam) {
        throw new Error('Seleziona chain o inserisci un indirizzo valido')
      }
      const q = new URLSearchParams({
        address: a,
        ...(chainParam ? { chain: chainParam } : {}),
      })
      const res = await fetch(`/api/onchain/address?${q}`, {
        headers: { Accept: 'application/json' },
      })
      const body = (await res.json()) as AddressLookupResult & { error?: string }
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setAddrResult(body)
    } catch (e) {
      setAddrErr(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setAddrLoading(false)
    }
  }, [addrInput, addrChain])

  return (
    <div className="flex flex-col h-full min-h-0 text-[11px] bg-terminal-panel text-terminal-text">
      <div className="px-2 py-1.5 border-b border-terminal-border shrink-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[#eaecef]">On-chain</span>
          <span className="text-[9px] text-[#5e6673]">
            {data?.updatedAt ? `upd ${fmtWhen(data.updatedAt)}` : ''}
            {data?.cached ? ' · cache' : ''}
          </span>
          <button
            type="button"
            className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-[#2b3139] text-[#848e9c] hover:text-[#f0b90b] hover:border-[#f0b90b]/40 disabled:opacity-40"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            {refreshing ? '…' : 'Refresh'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                tab === t.id
                  ? 'bg-[#1e2329] text-[#f0b90b] border-[#f0b90b]/50'
                  : 'text-terminal-muted border-terminal-border hover:text-terminal-text'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3">
        {loading && !data && tab !== 'address' ? (
          <div className="py-8 text-center text-terminal-muted">Loading on-chain metrics…</div>
        ) : null}

        {err && !data && tab !== 'address' ? (
          <div className="px-2 py-4 text-[#f6465d] text-[11px] leading-relaxed">{err}</div>
        ) : null}

        {tab === 'address' ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold text-[#848e9c] uppercase tracking-wider">
                Address inspector
              </div>
              <p className="text-[9px] text-[#5e6673] leading-relaxed">
                Verifica formato e saldo on-chain reale (BTC · ETH · SOL · LTC). Nessun dato finto.
              </p>
              <div className="flex flex-wrap gap-1">
                {CHAIN_OPTS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      addrChain === c.id
                        ? 'text-[#f0b90b] border-[#f0b90b]/50 bg-[#1e2329]'
                        : 'text-terminal-muted border-terminal-border'
                    }`}
                    onClick={() => setAddrChain(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <input
                  className="flex-1 min-w-0 bg-[#0d1118] border border-[#2b3139] rounded px-2 py-1 text-[11px] font-mono text-[#eaecef] placeholder:text-[#5e6673]"
                  placeholder="bc1… / 0x… / SOL pubkey / ltc1…"
                  value={addrInput}
                  onChange={(e) => setAddrInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void lookupAddress()
                  }}
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="shrink-0 px-2 py-1 rounded border border-[#f0b90b]/40 text-[#f0b90b] text-[10px] hover:bg-[#1e2329] disabled:opacity-40"
                  disabled={addrLoading || !addrInput.trim()}
                  onClick={() => void lookupAddress()}
                >
                  {addrLoading ? '…' : 'Verify'}
                </button>
              </div>
              {formatHint ? (
                <div
                  className={`text-[9px] ${
                    formatHint.includes('✓') ? 'text-[#0ecb81]' : 'text-[#f0b90b]'
                  }`}
                >
                  {formatHint}
                </div>
              ) : null}
            </div>

            {addrErr ? (
              <div className="text-[#f6465d] text-[11px] px-1">{addrErr}</div>
            ) : null}

            {addrResult ? (
              <div className="rounded border border-[#2b3139] bg-[#0d1118] p-2 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase text-[#848e9c]">{addrResult.chain}</span>
                  {addrResult.validFormat ? (
                    <span className="text-[9px] text-[#0ecb81]">format OK</span>
                  ) : null}
                  {addrResult.isContract ? (
                    <span className="text-[9px] px-1 rounded bg-[#1e2329] text-[#f0b90b] border border-[#f0b90b]/30">
                      contract
                    </span>
                  ) : null}
                </div>
                <div className="font-mono text-[10px] text-[#eaecef] break-all">{addrResult.address}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <div className="text-[9px] text-[#848e9c]">Balance</div>
                    <div className="text-[13px] font-mono-nums text-[#eaecef]">
                      {fmt(addrResult.balance, 8)} {addrResult.unit}
                    </div>
                  </div>
                  {addrResult.balanceMempool != null ? (
                    <div>
                      <div className="text-[9px] text-[#848e9c]">Mempool Δ</div>
                      <div className="text-[13px] font-mono-nums text-[#848e9c]">
                        {fmt(addrResult.balanceMempool, 8)}
                      </div>
                    </div>
                  ) : null}
                  {addrResult.totalReceived != null ? (
                    <div>
                      <div className="text-[9px] text-[#848e9c]">Received</div>
                      <div className="text-[12px] font-mono-nums">{fmt(addrResult.totalReceived, 6)}</div>
                    </div>
                  ) : null}
                  {addrResult.totalSent != null ? (
                    <div>
                      <div className="text-[9px] text-[#848e9c]">Sent</div>
                      <div className="text-[12px] font-mono-nums">{fmt(addrResult.totalSent, 6)}</div>
                    </div>
                  ) : null}
                  <div>
                    <div className="text-[9px] text-[#848e9c]">Tx count</div>
                    <div className="text-[12px] font-mono-nums">
                      {addrResult.txCount === -1
                        ? '≥1'
                        : addrResult.txCount != null
                          ? addrResult.txCount.toLocaleString()
                          : '—'}
                    </div>
                  </div>
                </div>
                {addrResult.explorer ? (
                  <a
                    href={addrResult.explorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-[10px] text-[#f0b90b] hover:underline"
                  >
                    Open in explorer ↗
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {data && tab !== 'address' ? <OnchainBody tab={tab} data={data} /> : null}

        {data?.warnings?.length && tab !== 'address' ? (
          <div className="text-[9px] text-[#f0b90b]/80 border border-[#f0b90b]/20 rounded px-2 py-1.5">
            Partial upstream: {data.warnings.slice(0, 3).join(' · ')}
            {data.warnings.length > 3 ? ` (+${data.warnings.length - 3})` : ''}
          </div>
        ) : null}

        {data?.sources?.length && tab !== 'address' ? (
          <div className="text-[9px] text-[#5e6673] px-0.5 pb-2">
            Sources: {data.sources.join(', ')} · real public APIs only
          </div>
        ) : null}
      </div>
    </div>
  )
}
