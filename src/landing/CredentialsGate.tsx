/**
 * Professional credentials gate over the landing.
 * Uses existing LoginScreen from @/auth when available; includes a
 * self-contained fallback form for drop-in demos.
 */
import { useEffect, useState, type FormEvent } from 'react'

type CredentialsGateProps = {
  open: boolean
  onClose: () => void
  /** Called after successful local/demo login when LoginScreen is not wired */
  onSuccess?: () => void
  /** Prefer injecting the real LoginScreen from @/auth */
  LoginScreen?: React.ComponentType<{ embedded?: boolean; hideLogo?: boolean }>
  brandName?: string
}

export function CredentialsGate({
  open,
  onClose,
  onSuccess,
  LoginScreen,
  brandName = 'APEX TERMINAL',
}: CredentialsGateProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      setError(null)
      setBusy(false)
    }
  }, [open])

  if (!open) return null

  const submitDemo = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Inserisci email e password.')
      return
    }
    setBusy(true)
    // Demo / local gate — replace with real auth when LoginScreen is provided
    await new Promise((r) => setTimeout(r, 650))
    if (password.length < 4) {
      setBusy(false)
      setError('Credenziali non valide.')
      return
    }
    try {
      sessionStorage.setItem('nacs-demo-auth', JSON.stringify({ email: email.trim(), at: Date.now() }))
    } catch {
      /* private mode */
    }
    setBusy(false)
    onSuccess?.()
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cred-gate-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Chiudi"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-[#2b3139] shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
        style={{ background: 'linear-gradient(180deg,#0f1319 0%,#0b0e11 100%)' }}
      >
        {/* Top gold line */}
        <div
          className="h-[2px] w-full"
          style={{ background: 'linear-gradient(90deg,transparent,#F4D35E,transparent)' }}
        />

        <div className="px-6 pb-6 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="grid h-7 w-7 place-items-center rounded-md text-[12px] font-black text-[#1a1a1a]"
                  style={{ background: 'linear-gradient(135deg,#F4D35E,#e0a800)' }}
                >
                  A
                </span>
                <span className="text-[12px] font-bold tracking-[0.1em] text-[#F4D35E]">{brandName}</span>
              </div>
              <h2 id="cred-gate-title" className="text-[18px] font-extrabold text-[#eaecef]">
                Accesso sicuro
              </h2>
              <p className="mt-1 text-[12px] text-[#848e9c]">
                Inserisci le credenziali per entrare nel terminal completo.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#2b3139] px-2.5 py-1 text-[12px] text-[#848e9c] hover:border-[#F4D35E]/50 hover:text-[#eaecef]"
            >
              Esc
            </button>
          </div>

          {LoginScreen ? (
            <div className="nacs-cred-login">
              {/* Real @/auth LoginScreen updates useAuthStore on success;
                  parent App then mounts TerminalApp automatically. */}
              <LoginScreen embedded hideLogo />
            </div>
          ) : (
            <form onSubmit={submitDemo} className="space-y-3.5">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#5e6673]">
                  Email
                </span>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="trader@desk.com"
                  className="w-full rounded-lg border border-[#2b3139] bg-[#080b0f] px-3.5 py-2.5 text-[13px] text-[#eaecef] outline-none transition focus:border-[#F4D35E]/60 focus:ring-1 focus:ring-[#F4D35E]/25"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#5e6673]">
                  Password
                </span>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-[#2b3139] bg-[#080b0f] px-3.5 py-2.5 pr-16 text-[13px] text-[#eaecef] outline-none transition focus:border-[#F4D35E]/60 focus:ring-1 focus:ring-[#F4D35E]/25"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#5e6673] hover:text-[#848e9c]"
                  >
                    {showPwd ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              {error && (
                <div className="rounded-lg border border-[#f6465d]/40 bg-[#2e0a12] px-3 py-2 text-[12px] text-[#f6465d]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-1 w-full rounded-lg py-3 text-[14px] font-extrabold text-[#1a1a1a] transition active:scale-[0.99] disabled:opacity-60"
                style={{
                  background: 'linear-gradient(90deg,#F4D35E,#e0a800)',
                  boxShadow: '0 4px 24px rgba(244,211,94,0.28)',
                }}
              >
                {busy ? 'Verifica…' : 'Entra nel Terminal'}
              </button>

              <p className="pt-1 text-center text-[11px] text-[#5e6673]">
                Sessione protetta · trading e chiavi live solo dopo login
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default CredentialsGate
