/**
 * Client auth – session via HttpOnly cookie (credentials: include).
 * RBAC roles: viewer | trader | risk | admin (user ≡ trader).
 */

import { create } from 'zustand'
import { setStorageUserId } from '@/lib/userScopedStorage'
import type { AuthRole } from './rbac'
import { auditAppend } from '@/trading/audit/auditLog'

export type { AuthRole }

export interface AuthUser {
  id: string
  email: string
  role: AuthRole
  /** Commercial plan from server (admin-assignable) */
  planId?: 'free' | 'pro' | 'team'
  /** Course / product level: base | corso | premium */
  level?: 'base' | 'corso' | 'premium'
  createdAt: number
  disabled?: boolean
  totpEnabled?: boolean
  planNote?: string | null
  planUpdatedAt?: number | null
  fullName?: string | null
  company?: string | null
  phone?: string | null
  telegramUsername?: string | null
  telegramChatId?: string | null
}

export type RegisterInput = {
  email: string
  password: string
  fullName: string
  company?: string
  phone?: string
  telegramUsername?: string
  acceptTerms: boolean
  acceptRisk: boolean
}

interface AuthState {
  user: AuthUser | null
  status: 'unknown' | 'guest' | 'authenticated'
  error: string | null
  busy: boolean
  /** Login paused awaiting TOTP */
  pendingTotp: { email: string; password: string } | null
  login: (email: string, password: string) => Promise<boolean>
  loginTotp: (code: string) => Promise<boolean>
  register: (input: RegisterInput) => Promise<boolean>
  logout: () => Promise<void>
  revokeAllSessions: () => Promise<void>
  requestPasswordReset: (
    email: string
  ) => Promise<{ ok: boolean; message: string; resetToken?: string; otp?: string }>
  /** Confirm with email + 6-digit OTP (preferred) or legacy long token */
  confirmPasswordReset: (args: {
    email?: string
    otp?: string
    token?: string
    password: string
  }) => Promise<{ ok: boolean; message?: string }>
  refreshMe: () => Promise<void>
  clearError: () => void
  cancelTotp: () => void
}

async function api<T>(
  path: string,
  opts: RequestInit = {}
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  }
  if (opts.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  try {
    const res = await fetch(path, {
      ...opts,
      headers,
      credentials: 'include',
    })
    const text = await res.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { error: text || res.statusText }
    }
    if (!res.ok) {
      const err =
        data && typeof data === 'object' && 'error' in data
          ? String((data as { error: string }).error)
          : res.statusText
      return { ok: false, error: err, status: res.status }
    }
    return { ok: true, data: data as T }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'network error',
      status: 0,
    }
  }
}

function clearLegacyToken() {
  try {
    localStorage.removeItem('tt-auth-token')
  } catch {
    /* */
  }
}

function onAuthed(user: AuthUser) {
  setStorageUserId(user.id)
  try {
    const plan = user.planId
    if (plan === 'free' || plan === 'pro' || plan === 'team') {
      localStorage.setItem('tt-plan:v1', plan)
    }
  } catch {
    /* */
  }
  auditAppend({
    mode: 'paper',
    action: 'arm_live',
    detail: `login ${user.email} role=${user.role} plan=${user.planId || 'free'} level=${user.level || 'base'}`,
    ok: true,
  })
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'unknown',
  error: null,
  busy: false,
  pendingTotp: null,

  clearError: () => set({ error: null }),
  cancelTotp: () => set({ pendingTotp: null }),

  refreshMe: async () => {
    clearLegacyToken()
    const res = await api<{ user: AuthUser }>('/api/auth/me')
    if (!res.ok) {
      const isDev =
        typeof import.meta !== 'undefined' &&
        Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV)
      if (isDev && (res.status === 0 || res.status === 404)) {
        setStorageUserId('dev-local')
        set({
          user: {
            id: 'dev-local',
            email: 'dev@localhost',
            role: 'admin',
            planId: 'team',
            level: 'premium',
            createdAt: Date.now(),
          },
          status: 'authenticated',
          error: null,
        })
        return
      }
      setStorageUserId(null)
      set({ user: null, status: 'guest' })
      return
    }
    onAuthed(res.data.user)
    set({ user: res.data.user, status: 'authenticated', error: null })
  },

  login: async (email, password) => {
    set({ busy: true, error: null, pendingTotp: null })
    const totpRes = await api<{ user: AuthUser; requiresTotp?: boolean }>(
      '/api/auth/totp',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'login', email, password }),
      }
    )
    if (totpRes.ok) {
      set({ busy: false })
      clearLegacyToken()
      onAuthed(totpRes.data.user)
      set({
        user: totpRes.data.user,
        status: 'authenticated',
        error: null,
        pendingTotp: null,
      })
      return true
    }
    if (totpRes.error?.toLowerCase().includes('2fa')) {
      set({
        busy: false,
        pendingTotp: { email, password },
        error: 'Inserisci il codice OTP dell authenticator',
      })
      return false
    }

    const res = await api<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    set({ busy: false })
    if (!res.ok) {
      setStorageUserId(null)
      set({ error: res.error, status: 'guest', user: null })
      return false
    }
    clearLegacyToken()
    onAuthed(res.data.user)
    set({
      user: res.data.user,
      status: 'authenticated',
      error: null,
    })
    return true
  },

  loginTotp: async (code) => {
    const pending = get().pendingTotp
    if (!pending) {
      set({ error: 'No pending login' })
      return false
    }
    set({ busy: true, error: null })
    const res = await api<{ user: AuthUser }>('/api/auth/totp', {
      method: 'POST',
      body: JSON.stringify({
        action: 'login',
        email: pending.email,
        password: pending.password,
        code,
      }),
    })
    set({ busy: false })
    if (!res.ok) {
      set({ error: res.error })
      return false
    }
    clearLegacyToken()
    onAuthed(res.data.user)
    set({
      user: res.data.user,
      status: 'authenticated',
      error: null,
      pendingTotp: null,
    })
    return true
  },

  register: async (input) => {
    set({ busy: true, error: null })
    const res = await api<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    set({ busy: false })
    if (!res.ok) {
      setStorageUserId(null)
      set({ error: res.error, status: 'guest', user: null })
      return false
    }
    clearLegacyToken()
    onAuthed(res.data.user)
    set({
      user: res.data.user,
      status: 'authenticated',
      error: null,
    })
    return true
  },

  logout: async () => {
    await api('/api/auth/logout', { method: 'POST' })
    clearLegacyToken()
    setStorageUserId(null)
    auditAppend({
      mode: 'paper',
      action: 'disarm_live',
      detail: 'logout',
      ok: true,
    })
    set({ user: null, status: 'guest', error: null, pendingTotp: null })
  },

  revokeAllSessions: async () => {
    await api('/api/auth/sessions?all=1', { method: 'DELETE' })
    await get().logout()
  },

  requestPasswordReset: async (email) => {
    const res = await api<{ ok: boolean; message: string; resetToken?: string; otp?: string }>(
      '/api/auth/password-reset',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'request', email }),
      }
    )
    if (!res.ok) return { ok: false, message: res.error }
    return res.data
  },

  confirmPasswordReset: async ({ email, otp, token, password }) => {
    const body: Record<string, string> = { action: 'confirm', password }
    if (email) body.email = email
    if (otp) body.otp = otp
    if (token) body.token = token
    const res = await api<{ ok?: boolean; message?: string; error?: string }>(
      '/api/auth/password-reset',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    )
    if (!res.ok) return { ok: false, message: res.error }
    return { ok: true, message: res.data.message || 'Password aggiornata' }
  },
}))
