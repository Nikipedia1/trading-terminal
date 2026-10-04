import { useState } from 'react'
import { useAuthStore } from './authStore'
import { BrandLogo, BRAND } from '@/brand'
import { DisclaimerBanner } from '@/compliance'

const fieldClass =
  'w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2.5 text-sm text-[#eaecef] placeholder:text-[#5e6673] outline-none transition-colors focus:border-[#f0b90b] focus:ring-1 focus:ring-[#f0b90b]/30 [color-scheme:dark]'

export function LoginScreen({
  embedded = false,
  hideLogo = false,
}: {
  embedded?: boolean
  hideLogo?: boolean
}) {
  const login = useAuthStore((s) => s.login)
  const loginTotp = useAuthStore((s) => s.loginTotp)
  const register = useAuthStore((s) => s.register)
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset)
  const confirmPasswordReset = useAuthStore((s) => s.confirmPasswordReset)
  const busy = useAuthStore((s) => s.busy)
  const error = useAuthStore((s) => s.error)
  const pendingTotp = useAuthStore((s) => s.pendingTotp)
  const clearError = useAuthStore((s) => s.clearError)
  const cancelTotp = useAuthStore((s) => s.cancelTotp)

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [resetMsg, setResetMsg] = useState<string | null>(null)
  const [company, setCompany] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    if (company.trim()) {
      useAuthStore.setState({ error: 'Rejected' })
      return
    }
    if (pendingTotp) {
      await loginTotp(totpCode.trim())
      return
    }
    if (mode === 'reset') {
      if (resetToken) {
        const ok = await confirmPasswordReset(resetToken, password)
        setResetMsg(ok ? 'Password updated – sign in' : 'Reset failed')
        if (ok) setMode('login')
      } else {
        const r = await requestPasswordReset(email)
        setResetMsg(r.message + (r.resetToken ? ` · dev token: ${r.resetToken}` : ''))
      }
      return
    }
    if (mode === 'register') {
      if (password !== password2) {
        useAuthStore.setState({ error: 'Passwords do not match' })
        return
      }
      await register(email, password)
    } else {
      await login(email, password)
    }
  }

  const showLogo = !hideLogo

  const form = (
    <div
      className={
        embedded
          ? 'w-full'
          : 'w-full max-w-md border border-[#2b3139] rounded-2xl bg-[#12161c]/95 shadow-[0_0_0_1px_rgba(240,185,11,0.06),0_24px_64px_rgba(0,0,0,0.5)] backdrop-blur-sm overflow-hidden'
      }
    >
      {showLogo && (
        <div
          className={
            embedded
              ? 'flex flex-col items-center gap-2 mb-5 pb-4 border-b border-[#1e2329]'
              : 'px-6 pt-8 pb-5 flex flex-col items-center gap-3 border-b border-[#1e2329]'
          }
        >
          <BrandLogo
            size={embedded ? 'lg' : 'xl'}
            layout="stack"
            fullLogo
            showWordmark
          />
          <p className="text-[11px] text-[#848e9c] text-center leading-relaxed max-w-xs">
            Secure session · passwords hashed server-side · keys never leave your browser unencrypted
          </p>
        </div>
      )}

      {!showLogo && embedded && (
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-[#eaecef] tracking-wide">
            Sign in to {BRAND.shortName}
          </h2>
          <p className="text-[11px] text-[#848e9c] mt-0.5">
            Full desk access · passwords hashed server-side
          </p>
        </div>
      )}

      {!pendingTotp && (
        <div className={`${!embedded && showLogo ? 'px-6 pt-4' : ''}`}>
          <div className="flex gap-1 p-1 rounded-lg bg-[#0b0e11] border border-[#1e2329]">
            {(['login', 'register', 'reset'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`flex-1 py-2.5 text-xs font-bold rounded-md transition-all ${
                  mode === m
                    ? 'bg-[#f0b90b] text-[#0b0e11] shadow-[0_0_12px_rgba(240,185,11,0.35)]'
                    : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#1e2329]'
                }`}
                onClick={() => {
                  setMode(m)
                  clearError()
                  setResetMsg(null)
                }}
              >
                {m === 'login' ? 'Login' : m === 'register' ? 'Register' : 'Reset'}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className={`${embedded ? 'mt-4' : 'p-6 pt-4'} space-y-3.5`}>
        <div className="absolute -left-[9999px] opacity-0" aria-hidden>
          <label>
            Company
            <input
              tabIndex={-1}
              autoComplete="off"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </label>
        </div>

        {pendingTotp ? (
          <>
            <p className="text-[11px] text-[#848e9c]">
              Two-factor authentication required for {pendingTotp.email}
            </p>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
                Authenticator code
              </span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                placeholder="6-digit code"
                className={fieldClass}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <button type="button" className="text-[10px] text-[#848e9c] underline" onClick={() => cancelTotp()}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">Email</span>
              <input
                type="email"
                autoComplete="username"
                required
                placeholder="you@company.com"
                className={fieldClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {mode !== 'reset' || resetToken ? (
              <label className="block space-y-1.5">
                <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
                  {mode === 'reset' ? 'New password' : 'Password'}
                </span>
                <input
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required={mode !== 'reset' || !!resetToken}
                  minLength={8}
                  placeholder="Min. 8 characters, letter + digit"
                  className={fieldClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            ) : null}
            {mode === 'reset' && (
              <label className="block space-y-1.5">
                <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
                  Reset token (after request)
                </span>
                <input
                  className={fieldClass}
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste token if issued"
                />
              </label>
            )}
            {mode === 'register' && (
              <label className="block space-y-1.5">
                <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
                  Confirm password
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Repeat password"
                  className={fieldClass}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                />
              </label>
            )}
          </>
        )}

        {error && (
          <p className="text-[11px] text-[#f6465d] bg-[#f6465d]/10 border border-[#f6465d]/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {resetMsg && (
          <p className="text-[11px] text-[#0ecb81] bg-[#0ecb81]/10 border border-[#0ecb81]/30 rounded-lg px-3 py-2 break-all">
            {resetMsg}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-lg bg-[#f0b90b] text-[#0b0e11] font-bold text-sm tracking-wide hover:bg-[#f5c93a] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_24px_rgba(240,185,11,0.25)]"
        >
          {busy
            ? 'Please wait…'
            : pendingTotp
              ? 'Verify 2FA'
              : mode === 'login'
                ? 'Sign in'
                : mode === 'register'
                  ? 'Create account'
                  : resetToken
                    ? 'Set new password'
                    : 'Request reset'}
        </button>
        <DisclaimerBanner compact />
        <p className="text-[9px] text-[#5e6673] leading-snug text-center">
          First registered account becomes <strong className="text-[#848e9c]">admin</strong>. Rate-limited login · optional TOTP 2FA.
        </p>
      </form>
    </div>
  )

  if (embedded) return form

  return (
    <div className="nacs-splash min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="nacs-splash-grid" aria-hidden />
      <div className="nacs-splash-glow" aria-hidden />
      <div className="relative z-10 w-full max-w-md">{form}</div>
    </div>
  )
}
