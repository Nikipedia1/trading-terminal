/**
 * Admin user management – list / role / disable / set new password.
 * Never displays or retrieves existing passwords.
 */

import { useCallback, useEffect, useState } from 'react'
import { useAuthStore, type AuthUser } from './authStore'

export function AdminPanel() {
  const token = useAuthStore((s) => s.token)
  const me = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<AuthUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetId, setResetId] = useState<string | null>(null)
  const [newPw, setNewPw] = useState('')

  const load = useCallback(async () => {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || res.statusText)
        setUsers([])
      } else {
        setUsers(data.users || [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setBusy(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const patch = async (
    id: string,
    body: { role?: string; disabled?: boolean; newPassword?: string }
  ) => {
    if (!token) return
    setError(null)
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || res.statusText)
      return
    }
    setResetId(null)
    setNewPw('')
    await load()
  }

  if (me?.role !== 'admin') {
    return (
      <div className="p-3 text-[11px] text-[#848e9c]">
        Admin only. Your role: {me?.role ?? '—'}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[11px] text-[#eaecef]">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex items-center gap-2">
        <span className="text-[9px] text-[#848e9c] uppercase tracking-wider">Admin</span>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto text-[10px] text-[#848e9c] hover:text-[#eaecef]"
        >
          Refresh
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {error && (
          <p className="text-[10px] text-[#f6465d] border border-[#f6465d]/30 rounded px-2 py-1">
            {error}
          </p>
        )}
        <p className="text-[9px] text-[#5e6673]">
          Passwords are never shown. You can only set a new password (hashed on server).
        </p>
        {busy && users.length === 0 && (
          <p className="text-[10px] text-[#5e6673]">Loading…</p>
        )}
        {users.map((u) => (
          <div
            key={u.id}
            className="border border-[#2b3139] rounded px-2 py-1.5 space-y-1 bg-[#12161c]"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{u.email}</span>
              <span
                className={`text-[9px] px-1 rounded ${
                  u.role === 'admin'
                    ? 'bg-[#f0b90b]/15 text-[#f0b90b]'
                    : 'bg-[#1e2329] text-[#848e9c]'
                }`}
              >
                {u.role}
              </span>
              {u.disabled && <span className="text-[9px] text-[#f6465d]">disabled</span>}
            </div>
            <div className="text-[9px] text-[#5e6673]">
              {new Date(u.createdAt).toLocaleString()}
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="px-1.5 py-0.5 rounded border border-[#2b3139] text-[10px] hover:border-[#848e9c]"
                onClick={() =>
                  void patch(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })
                }
                disabled={u.id === me.id}
              >
                {u.role === 'admin' ? 'Make user' : 'Make admin'}
              </button>
              <button
                type="button"
                className="px-1.5 py-0.5 rounded border border-[#2b3139] text-[10px] hover:border-[#848e9c]"
                onClick={() => void patch(u.id, { disabled: !u.disabled })}
                disabled={u.id === me.id}
              >
                {u.disabled ? 'Enable' : 'Disable'}
              </button>
              <button
                type="button"
                className="px-1.5 py-0.5 rounded border border-[#2b3139] text-[10px] hover:border-[#848e9c]"
                onClick={() => setResetId(resetId === u.id ? null : u.id)}
              >
                Set password
              </button>
            </div>
            {resetId === u.id && (
              <div className="flex gap-1 items-center pt-1">
                <input
                  type="password"
                  placeholder="New password (min 8)"
                  className="flex-1 bg-[#0b0e11] border border-[#2b3139] rounded px-1.5 py-1 text-[11px]"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                />
                <button
                  type="button"
                  className="px-2 py-1 rounded bg-[#0ecb81]/20 text-[#0ecb81] border border-[#0ecb81]/40 text-[10px]"
                  onClick={() => void patch(u.id, { newPassword: newPw })}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
