/**
 * Link Telegram for OTP delivery – generates one-time code + deep link.
 * Admin can register setWebhook using TELEGRAM_BOT_TOKEN already on Cloudflare.
 */

import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from './authStore'

export function TelegramLinkCard() {
  const status = useAuthStore((s) => s.status)
  const role = useAuthStore((s) => s.user?.role)
  const [linked, setLinked] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [instructions, setInstructions] = useState<string | null>(null)
  const [setupMsg, setSetupMsg] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (status !== 'authenticated') return
    try {
      const res = await fetch('/api/auth/telegram-link', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) {
        setLinked(Boolean(data.linked))
        setChatId(data.telegramChatId || null)
      }
    } catch {
      /* */
    }
  }, [status])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const generate = async () => {
    setBusy(true)
    setError(null)
    setDeepLink(null)
    setCode(null)
    try {
      const res = await fetch('/api/auth/telegram-link', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || res.statusText)
        return
      }
      setCode(data.code || null)
      setDeepLink(data.deepLink || null)
      setInstructions(data.instructions || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'network error')
    } finally {
      setBusy(false)
    }
  }

  const unlink = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/telegram-link', {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || res.statusText)
        return
      }
      setLinked(false)
      setChatId(null)
      setDeepLink(null)
      setCode(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'network error')
    } finally {
      setBusy(false)
    }
  }

  const registerWebhook = async () => {
    setBusy(true)
    setError(null)
    setSetupMsg(null)
    try {
      const res = await fetch('/api/telegram/setup-webhook', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || res.statusText)
        return
      }
      setSetupMsg(
        `Webhook OK: ${data.webhookUrl || ''} ${data.description ? '· ' + data.description : ''}`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'network error')
    } finally {
      setBusy(false)
    }
  }

  if (status !== 'authenticated') return null

  return (
    <div className="rounded-lg border border-[#2b3139] bg-[#0d1117] p-3 space-y-2 text-[11px] text-[#eaecef]">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-[#229ED9]">Telegram · OTP</span>
        {linked ? (
          <span className="text-[9px] px-1.5 rounded bg-[#0ecb81]/15 text-[#0ecb81]">collegato</span>
        ) : (
          <span className="text-[9px] px-1.5 rounded bg-[#1e2329] text-[#848e9c]">non collegato</span>
        )}
      </div>
      <p className="text-[10px] text-[#848e9c] leading-relaxed">
        Collega il bot una volta: gli OTP di reset password arriveranno in chat Telegram. Nessun chat ID da
        copiare a mano.
      </p>
      {linked && chatId && (
        <p className="text-[9px] text-[#5e6673]">chat id: {chatId}</p>
      )}
      {error && (
        <p className="text-[10px] text-[#f6465d] border border-[#f6465d]/30 rounded px-2 py-1">{error}</p>
      )}
      {setupMsg && (
        <p className="text-[10px] text-[#0ecb81] border border-[#0ecb81]/30 rounded px-2 py-1 break-all">
          {setupMsg}
        </p>
      )}
      {code && (
        <div className="rounded border border-[#229ED9]/30 bg-[#0b1520] px-2 py-1.5 space-y-1">
          <p className="text-[10px] text-[#848e9c]">
            Codice (15 min): <span className="text-[#eaecef] font-mono">{code}</span>
          </p>
          {instructions && <p className="text-[10px] text-[#5e6673]">{instructions}</p>}
          {deepLink && (
            <a
              href={deepLink}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-1 px-2 py-1 rounded bg-[#229ED9] text-[#0b0e11] font-semibold text-[10px]"
            >
              Apri Telegram e collega
            </a>
          )}
          <button
            type="button"
            className="block text-[9px] text-[#848e9c] underline mt-1"
            onClick={() => void refresh()}
          >
            Ho premuto Start – aggiorna stato
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {!linked && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void generate()}
            className="px-2 py-1 rounded bg-[#229ED9]/20 text-[#229ED9] border border-[#229ED9]/40 text-[10px] font-semibold disabled:opacity-50"
          >
            {busy ? '…' : 'Genera link bot'}
          </button>
        )}
        {linked && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void unlink()}
            className="px-2 py-1 rounded border border-[#2b3139] text-[10px] text-[#848e9c] hover:text-[#eaecef]"
          >
            Scollega Telegram
          </button>
        )}
        <button
          type="button"
          className="px-2 py-1 rounded border border-[#2b3139] text-[10px] text-[#5e6673]"
          onClick={() => void refresh()}
        >
          Refresh
        </button>
        {role === 'admin' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void registerWebhook()}
            className="px-2 py-1 rounded border border-[#f0b90b]/40 text-[#f0b90b] text-[10px] font-semibold disabled:opacity-50"
          >
            Admin: registra webhook
          </button>
        )}
      </div>
      {role === 'admin' && (
        <p className="text-[9px] text-[#5e6673] leading-relaxed">
          Prima metti su Cloudflare (Secrets): <code className="text-[#848e9c]">TELEGRAM_BOT_TOKEN</code>,{' '}
          <code className="text-[#848e9c]">TELEGRAM_BOT_USERNAME</code>. Poi premi "registra webhook" — niente curl.
        </p>
      )}
    </div>
  )
}
