import { useState } from 'react'
import { useAuthStore } from './authStore'

export function LoginScreen() {
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
        useAuthStore.setState({ error: 'passwords do not match' })
        return
      }
      await register(email, password)
    } else {
      await login(email, password)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center p-4">
      <div className="w-full max-w-sm border border-[#2b3139] rounded-lg bg-[#12161c] shadow-xl">
        <div className="px-5 pt-5 pb-3 border-b border-[#1e2329]">
          <h1 className="text-[#eaecef] text-lg font-semibold">Trading Terminal</h1>
          <p className="text-[11px] text-[#848e9c] mt-1">
            Sign in with your account. Passwords are hashed server-side (never stored in plain
            text).
          </p>
        </div>

        <div className="flex border-b border-[#1e2329]">
          <button
            type="button"
            className={`flex-1 py-2 text-xs ${
              mode === 'login' ? 'text-[#f0b90b] border-b-2 border-[#f0b90b]' : 'text-[#848e9c]'
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
            className={`flex-1 py-2 text-xs ${
              mode === 'register'
                ? 'text-[#f0b90b] border-b-2 border-[#f0b90b]'
                : 'text-[#848e9c]'
            }`}
            onClick={() => {
              setMode('register')
              clearError()
            }}
          >
            Register
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-3">
          <label className="block space-y-1">
            <span className="text-[10px] text-[#848e9c] uppercase">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-3 py-2 text-sm text-[#eaecef] outline-none focus:border-[#f0b90b]/50"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] text-[#848e9c] uppercase">Password</span>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-3 py-2 text-sm text-[#eaecef] outline-none focus:border-[#f0b90b]/50"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {mode === 'register' && (
            <label className="block space-y-1">
              <span className="text-[10px] text-[#848e9c] uppercase">Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-3 py-2 text-sm text-[#eaecef] outline-none focus:border-[#f0b90b]/50"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p className="text-[11px] text-[#f6465d] bg-[#f6465d]/10 border border-[#f6465d]/30 rounded px-2 py-1.5">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 rounded bg-[#f0b90b]/20 text-[#f0b90b] border border-[#f0b90b]/40 font-semibold text-sm hover:bg-[#f0b90b]/30 disabled:opacity-50"
          >
            {busy ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
          <p className="text-[9px] text-[#5e6673] leading-snug">
            First registered account becomes{' '}
            <strong className="text-[#848e9c]">admin</strong>. Backend: Cloudflare Pages
            Functions + KV.
          </p>
        </form>
      </div>
    </div>
  )
}
