/**
 * Client auth – session via HttpOnly cookie (credentials: include).
 * No session token in localStorage (XSS-safe). Memory user only.
 */

import { create } from 'zustand'

export type AuthRole = 'user' | 'admin'

export interface AuthUser {
  id: string
  email: string
  role: AuthRole
  createdAt: number
  disabled?: boolean
}

interface AuthState {
  user: AuthUser | null
  status: 'unknown' | 'guest' | 'authenticated'
  error: string | null
  busy: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
  clearError: () => void
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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'unknown',
  error: null,
  busy: false,

  clearError: () => set({ error: null }),

  refreshMe: async () => {
    clearLegacyToken()
    const res = await api<{ user: AuthUser }>('/api/auth/me')
    if (!res.ok) {
      // B9: local Vite without Pages Functions → soft-dev session
      const isDev =
        typeof import.meta !== 'undefined' &&
        Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV)
      if (isDev && (res.status === 0 || res.status === 404)) {
        set({
          user: {
            id: 'dev-local',
            email: 'dev@localhost',
            role: 'admin',
            createdAt: Date.now(),
          },
          status: 'authenticated',
          error: null,
        })
        return
      }
      set({ user: null, status: 'guest' })
      return
    }
    set({ user: res.data.user, status: 'authenticated', error: null })
  },

  login: async (email, password) => {
    set({ busy: true, error: null })
    const res = await api<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    set({ busy: false })
    if (!res.ok) {
      set({ error: res.error, status: 'guest', user: null })
      return false
    }
    clearLegacyToken()
    set({
      user: res.data.user,
      status: 'authenticated',
      error: null,
    })
    return true
  },

  register: async (email, password) => {
    set({ busy: true, error: null })
    const res = await api<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    set({ busy: false })
    if (!res.ok) {
      set({ error: res.error, status: 'guest', user: null })
      return false
    }
    clearLegacyToken()
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
    set({ user: null, status: 'guest', error: null })
  },
}))
