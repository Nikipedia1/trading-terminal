/**
 * Admin user management – list / role / level / plan / disable / set password.
 * Never displays or retrieves existing passwords.
 * After payment, admin sets planId (free|pro|team) and optional planNote.
 */

import { useCallback, useEffect, useState } from 'react'
import { useAuthStore, type AuthUser } from './authStore'

const ROLES = ['viewer', 'user', 'risk', 'admin'] as const
const LEVELS = ['base', 'corso', 'premium'] as const
const PLANS = ['free', 'pro', 'team'] as const

type AdminUser = AuthUser & {
  planId?: string
  level?: string
  planNote?: string | null
  planUpdatedAt?: number | null
}

export function AdminPanel() {
  const me = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetId, setResetId] = useState<string | null>(null)
  const [newPw, setNewPw] = useState('')
  const [noteId, setNoteId] = useState<string | null>(null)
  const [planNote, setPlanNote] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
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
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const patch = async (
    id: string,
    body: {
      role?: string
      level?: string
      planId?: string
      planNote?: string
      disabled?: boolean
      newPassword?: string
    }
  ) => {
    setError(null)
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: {
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
    setNoteId(null)
    setPlanNote('')
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
        <span className="text-[9px] text-[#848e9c] uppercase tracking-wider">Admin · utenti</span>
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
        <p className="text-[9px] text-[#5e6673] leading-relaxed">
          Dopo un pagamento imposta <span className="text-[#f0b90b]">Piano</span> (free/pro/team) e
          opzionalmente una nota (ref bonifico / Stripe). Livello = percorso corso (base / corso /
          premium). Ruolo = permessi desk.
        </p>
        {busy && users.length === 0 && (
          <p className="text-[10px] text-[#5e6673]">Loading…</p>
        )}
        {users.map((u) => (
          <div
            key={u.id}
            className="border border-[#2b3139] rounded px-2 py-1.5 space-y-1.5 bg-[#12161c]"
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
              <span className="text-[9px] px-1 rounded bg-[#1e2329] text-[#848e9c]">
                {u.level || 'base'}
              </span>
              <span
                className={`text-[9px] px-1 rounded ${
                  (u.planId || 'free') === 'free'
                    ? 'bg-[#1e2329] text-[#848e9c]'
                    : 'bg-[#0ecb81]/15 text-[#0ecb81]'
                }`}
              >
                plan:{u.planId || 'free'}
              </span>
              {u.disabled && <span className="text-[9px] text-[#f6465d]">disabled</span>}
            </div>
            <div className="text-[9px] text-[#5e6673]">
              {new Date(u.createdAt).toLocaleString()}
              {u.planUpdatedAt
                ? ` · plan upd ${new Date(u.planUpdatedAt).toLocaleString()}`
                : ''}
              {u.planNote ? ` · ${u.planNote}` : ''}
            </div>

            <div className="grid grid-cols-3 gap-1">
              <label className="flex flex-col gap-0.5 text-[9px] text-[#5e6673]">
                Ruolo
                <select
                  className="bg-[#0b0e11] border border-[#2b3139] rounded px-1 py-1 text-[10px] text-[#eaecef]"
                  value={u.role}
                  disabled={u.id === me.id}
                  onChange={(e) => void patch(u.id, { role: e.target.value })}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5 text-[9px] text-[#5e6673]">
                Livello
                <select
                  className="bg-[#0b0e11] border border-[#2b3139] rounded px-1 py-1 text-[10px] text-[#eaecef]"
                  value={u.level || 'base'}
                  onChange={(e) => void patch(u.id, { level: e.target.value })}
                >
                  {LEVELS.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv === 'corso' ? 'allievo corso' : lv}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5 text-[9px] text-[#5e6673]">
                Piano
                <select
                  className="bg-[#0b0e11] border border-[#2b3139] rounded px-1 py-1 text-[10px] text-[#eaecef]"
                  value={u.planId || 'free'}
                  onChange={(e) =>
                    void patch(u.id, {
                      planId: e.target.value,
                      planNote: planNote || `manual ${new Date().toISOString().slice(0, 10)}`,
                    })
                  }
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-1">
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
              <button
                type="button"
                className="px-1.5 py-0.5 rounded border border-[#2b3139] text-[10px] hover:border-[#848e9c]"
                onClick={() => {
                  setNoteId(noteId === u.id ? null : u.id)
                  setPlanNote(u.planNote || '')
                }}
              >
                Nota pagamento
              </button>
            </div>

            {noteId === u.id && (
              <div className="flex gap-1 items-center pt-1">
                <input
                  type="text"
                  placeholder="Ref pagamento / Stripe id"
                  className="flex-1 bg-[#0b0e11] border border-[#2b3139] rounded px-1.5 py-1 text-[11px]"
                  value={planNote}
                  onChange={(e) => setPlanNote(e.target.value)}
                />
                <button
                  type="button"
                  className="px-2 py-1 rounded bg-[#f0b90b]/20 text-[#f0b90b] border border-[#f0b90b]/40 text-[10px]"
                  onClick={() =>
                    void patch(u.id, {
                      planId: u.planId || 'free',
                      planNote: planNote || 'manual',
                    })
                  }
                >
                  Salva nota
                </button>
              </div>
            )}

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
