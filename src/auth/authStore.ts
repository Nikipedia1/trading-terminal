/**
 * Client auth – Cloudflare Pages Functions + KV.
 * Token in memory + localStorage; passwords never stored client-side.
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
  token: string | null
  status: 'unknown' | 'guest' | 'authenticated'
  error: string | null
  busy: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
  clearError: () => void
}

const TOKEN_KEY = 'tt-auth-token'

async function api<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {}
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  }
  const token = opts.token ?? localStorage.getItem(TOKEN_KEY)
  if (token) headers.Authorization = `Bearer ${token}`
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null,
  status: 'unknown',
  error: null,
  busy: false,

  clearError: () => set({ error: null }),

  refreshMe: async () => {
    const token = get().token ?? localStorage.getItem(TOKEN_KEY)
    if (!token) {
      set({ user: null, token: null, status: 'guest' })
      return
    }
    const res = await api<{ user: AuthUser }>('/api/auth/me', { token })
    if (!res.ok) {
      localStorage.removeItem(TOKEN_KEY)
      set({ user: null, token: null, status: 'guest' })
      return
    }
    set({ user: res.data.user, token, status: 'authenticated', error: null })
  },

  login: async (email, password) => {
    set({ busy: true, error: null })
    const res = await api<{ user: AuthUser; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    set({ busy: false })
    if (!res.ok) {
      set({ error: res.error, status: 'guest', user: null, token: null })
      return false
    }
    localStorage.setItem(TOKEN_KEY, res.data.token)
    set({
      user: res.data.user,
      token: res.data.token,
      status: 'authenticated',
      error: null,
    })
    return true
  },

  register: async (email, password) => {
    set({ busy: true, error: null })
    const res = await api<{ user: AuthUser; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    set({ busy: false })
    if (!res.ok) {
      set({ error: res.error, status: 'guest', user: null, token: null })
      return false
    }
    localStorage.setItem(TOKEN_KEY, res.data.token)
    set({
      user: res.data.user,
      token: res.data.token,
      status: 'authenticated',
      error: null,
    })
    return true
  },

  logout: async () => {
    const token = get().token
    await api('/api/auth/logout', { method: 'POST', token })
    localStorage.removeItem(TOKEN_KEY)
    set({ user: null, token: null, status: 'guest', error: null })
  },
}))
