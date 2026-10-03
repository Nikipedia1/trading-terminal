import { useState } from 'react'
import { useAuthStore } from './authStore'
import { BrandLogo, BRAND } from '@/brand'

const fieldClass =
  'w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2.5 text-sm text-[#eaecef] placeholder:text-[#5e6673] outline-none transition-colors focus:border-[#f0b90b] focus:ring-1 focus:ring-[#f0b90b]/30 [color-scheme:dark]'

export function LoginScreen({
  embedded = false,
}: {
  /** When true, skip full-page chrome (used inside GuestEntry). */
  embedded?: boolean
}) {
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const busy = useAuthStore((s) => s.busy)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
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

  const form = (
    <div
      className={
        embedded
          ? 'w-full'
          : 'w-full max-w-md border border-[#2b3139] rounded-2xl bg-[#12161c]/95 shadow-[0_0_0_1px_rgba(240,185,11,0.06),0_24px_64px_rgba(0,0,0,0.5)] backdrop-blur-sm overflow-hidden'
      }
    >
      {!embedded && (
        <div className="px-6 pt-7 pb-4 flex flex-col items-center gap-3 border-b border-[#1e2329]">
          <BrandLogo size="lg" animated />
          <p className="text-[11px] text-[#848e9c] text-center leading-relaxed max-w-xs">
            Sign in to unlock trading, bots, and live keys. Passwords are hashed
            server-side.
          </p>
        </div>
      )}

      {embedded && (
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-[#eaecef] tracking-wide">
            Sign in to {BRAND.shortName}
          </h2>
          <p className="text-[11px] text-[#848e9c] mt-0.5">
            Full desk access · passwords hashed server-side
          </p>
        </div>
      )}

      <div className="flex gap-1 p-1 rounded-lg bg-[#0b0e11] border border-[#1e2329]">
        <button
          type="button"
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
            mode === 'login'
              ? 'bg-[#f0b90b] text-[#0b0e11] shadow-[0_0_12px_rgba(240,185,11,0.35)]'
              : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#1e2329]'
          }`}
          onClick={() => {
            setMode('login')
            clearError()
          }}
        >
          Login
        </button>
        <button
          type="button"
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
            mode === 'register'
              ? 'bg-[#f0b90b] text-[#0b0e11] shadow-[0_0_12px_rgba(240,185,11,0.35)]'
              : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#1e2329]'
          }`}
          onClick={() => {
            setMode('register')
            clearError()
          }}
        >
          Register
        </button>
      </div>

      <form onSubmit={onSubmit} className={`${embedded ? 'mt-4' : 'p-6 pt-4'} space-y-3.5`}>
        <label className="block space-y-1.5">
          <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
            Email
          </span>
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
        <label className="block space-y-1.5">
          <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
            Password
          </span>
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            placeholder="Min. 8 characters"
            className={fieldClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {mode === 'register' && (
          <label className="block space-y-1.5">
            <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-wider">
              Confirm password
            </span>
            <input
              type="password"
euenComplete="new-password"
              required
              minLength={8}
              placeholder="Repeat password"
              className={fieldClass}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          </label>
        )}
        {error && (
          <p className="text-[11px] text-[#f6465d] bg-[#f6465d]/10 border border-[#f6465d]/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-lg bg-[#f0b90b] text-[#0b0e11] font-bold text-sm tracking-wide hover:bg-[#f5c93a] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_24px_rgba(240,185,11,0.25)]"
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <p className="text-[9px] text-[#5e6673] leading-snug text-center">
          First registered account becomes{' '}
          <strong className="text-[#848e9c]">admin</strong>. Backend: Cloudflare Pages
          Functions + KV.
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
