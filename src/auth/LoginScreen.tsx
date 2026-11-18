/**
 * Login / register (full profile) / password-reset (OTP) / TOTP step.
 * embedded=true → compact form for CredentialsGate modal.
 */

import { useState, type FormEvent } from 'react'
import { useAuthStore } from './authStore'
import { BrandLogo } from '@/brand'
import { DisclaimerBanner } from '@/compliance/DisclaimerBanner'

const fieldClass =
  'w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2.5 text-sm text-[#eaecef] placeholder:text-[#5e6673] outline-none transition-colors focus:border-[#f0b90b] focus:ring-1 focus:ring-[#f0b90b]/30 [color-scheme:dark]'

export function LoginScreen({ embedded = false }: { embedded?: boolean }) {
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
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [telegramUsername, setTelegramUsername] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptRisk, setAcceptRisk] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [resetMsg, setResetMsg] = useState<string | null>(null)
  const [otpSent, setOtpSent] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    clearError()
    setResetMsg(null)

    if (pendingTotp) {
      await loginTotp(totpCode.trim())
      return
    }

    if (mode === 'reset') {
      if (otpSent && resetToken.trim().length >= 6) {
        const r = await confirmPasswordReset({
          email,
          otp: resetToken.trim().length === 6 ? resetToken.trim() : undefined,
          token: resetToken.trim().length > 6 ? resetToken.trim() : undefined,
          password,
        })
        setResetMsg(
          r.ok
            ? r.message || 'Password aggiornata – fai login'
            : r.message || 'Reset fallito'
        )
        if (r.ok) {
          setMode('login')
          setOtpSent(false)
          setResetToken('')
          setPassword('')
        }
      } else {
        const r = await requestPasswordReset(email)
        let msg = r.message
        if (r.otp) msg += ` · DEV OTP: ${r.otp}`
        else if (r.resetToken) msg += ` · dev token: ${r.resetToken}`
        setResetMsg(msg)
        if (r.ok) setOtpSent(true)
      }
      return
    }

    if (mode === 'register') {
      if (!fullName.trim() || fullName.trim().length < 2) {
        setResetMsg('Inserisci il nome completo')
        return
      }
      if (password !== password2) {
        setResetMsg('Le password non coincidono')
        return
      }
      if (!acceptTerms || !acceptRisk) {
        setResetMsg('Accetta Termini e avviso rischi per continuare')
        return
      }
      await register({
        email,
        password,
        fullName: fullName.trim(),
        company: company.trim() || undefined,
        phone: phone.trim() || undefined,
        telegramUsername: telegramUsername.trim() || undefined,
        acceptTerms,
        acceptRisk,
      })
    } else {
      await login(email, password)
    }
  }

  const form = (
    <div
      className={
        embedded
          ? 'w-full'
          : 'w-full max-w-md rounded-2xl border border-[#2b3139] bg-[#0d1117]/95 shadow-2xl shadow-black/50 p-6 sm:p-8 backdrop-blur-md'
      }
    >
      {!embedded && (
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandLogo size="lg" showWordmark fullLogo />
          <p className="text-[11px] text-[#5e6673] max-w-xs leading-relaxed">
            Secure session · passwords hashed server-side · keys never leave your browser unencrypted
          </p>
        </div>
      )}
      {embedded && (
        <p className="mb-4 text-[11px] text-[#5e6673] text-center leading-relaxed">
          Full desk access · passwords hashed server-side
        </p>
      )}

      {!pendingTotp && (
        <div className="flex gap-1 mb-5 p-1 rounded-lg bg-[#0b0e11] border border-[#1e2329]">
          {(['login', 'register', 'reset'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={
                'flex-1 py-2 rounded-md text-[11px] font-semibold uppercase tracking-wide transition-colors ' +
                (mode === m
                  ? 'bg-[#1e2329] text-[#f0b90b]'
                  : 'text-[#5e6673] hover:text-[#848e9c]')
              }
              onClick={() => {
                setMode(m)
                setResetMsg(null)
                setOtpSent(false)
                clearError()
              }}
            >
              {m === 'login' ? 'Login' : m === 'register' ? 'Register' : 'Reset'}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        {pendingTotp ? (
          <div className="space-y-3">
            <p className="text-[12px] text-[#848e9c]">
              Autenticazione a due fattori per {pendingTotp.email}
            </p>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
                Codice authenticator (OTP)
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className={fieldClass}
                placeholder="6-digit code"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <button type="button" className="text-[10px] text-[#848e9c] underline" onClick={() => cancelTotp()}>
              Annulla
            </button>
          </div>
        ) : (
          <>
            {mode === 'register' && (
              <label className="block space-y-1.5">
                <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
                  Nome completo *
                </span>
                <input
                  type="text"
                  autoComplete="name"
                  required
                  minLength={2}
                  className={fieldClass}
                  placeholder="Mario Rossi"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>
            )}

            <label className="block space-y-1.5">
              <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
                Email *
              </span>
              <input
                type="email"
                autoComplete="email"
                required
                className={fieldClass}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            {mode === 'register' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
                      Azienda
                    </span>
                    <input
                      type="text"
                      autoComplete="organization"
                      className={fieldClass}
                      placeholder="opzionale"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
                      Telefono
                    </span>
                    <input
                      type="tel"
                      autoComplete="tel"
                      className={fieldClass}
                      placeholder="+39 …"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </label>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
                    Telegram @username
                  </span>
                  <input
                    type="text"
                    className={fieldClass}
                    placeholder="@username (opzionale, poi colleghi il bot)"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                  />
                </label>
              </>
            )}

            {(mode !== 'reset' || otpSent) && (
              <label className="block space-y-1.5">
                <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
                  {mode === 'reset' ? 'Nuova password *' : 'Password *'}
                </span>
                <input
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required={mode !== 'reset' || otpSent}
                  minLength={8}
                  placeholder="Min. 8 caratteri, lettera + cifra"
                  className={fieldClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}

            {mode === 'register' && (
              <label className="block space-y-1.5">
                <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
                  Conferma password *
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Ripeti password"
                  className={fieldClass}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                />
              </label>
            )}

            {mode === 'reset' && otpSent && (
              <label className="block space-y-1.5">
                <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
                  Codice OTP (6 cifre) *
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={fieldClass}
                  value={resetToken}
                  onChange={(e) =>
                    setResetToken(e.target.value.replace(/[^\da-fA-F]/g, '').slice(0, 64))
                  }
                  placeholder="000000"
                  maxLength={64}
                />
                <span className="text-[9px] text-[#5e6673]">
                  Codice ricevuto su Telegram (o DEV OTP a schermo).
                </span>
              </label>
            )}

            {mode === 'register' && (
              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-2 text-[10px] text-[#848e9c] cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[#f0b90b]"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    required
                  />
                  <span>
                    Accetto i <strong className="text-[#eaecef]">Termini di servizio</strong> e la Privacy
                    Policy *
                  </span>
                </label>
                <label className="flex items-start gap-2 text-[10px] text-[#848e9c] cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[#f0b90b]"
                    checked={acceptRisk}
                    onChange={(e) => setAcceptRisk(e.target.checked)}
                    required
                  />
                  <span>
                    Dichiaro di comprendere i <strong className="text-[#eaecef]">rischi del trading</strong>{' '}
                    (possibile perdita del capitale) *
                  </span>
                </label>
              </div>
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
              ? 'Verifica OTP 2FA'
              : mode === 'login'
                ? 'Sign in'
                : mode === 'register'
                  ? 'Crea account'
                  : otpSent
                    ? 'Imposta nuova password'
                    : 'Invia codice OTP'}
        </button>
        <DisclaimerBanner compact />
        <p className="text-[9px] text-[#5e6673] leading-snug text-center">
          First registered account becomes <strong className="text-[#848e9c]">admin</strong>. Rate-limited
          login · optional TOTP 2FA · reset via OTP Telegram.
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
