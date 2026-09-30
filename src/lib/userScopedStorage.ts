/**
 * Namespace localStorage by authenticated user id.
 * Prevents two accounts on the same browser from overwriting paper/bots/journal.
 * Guest mode uses "guest" namespace.
 */

let currentUserId: string | null = null

export function setStorageUserId(userId: string | null) {
  currentUserId = userId && userId.trim() ? userId.trim() : null
}

export function getStorageUserId(): string {
  return currentUserId || 'guest'
}

export function scopedKey(baseKey: string): string {
  const uid = getStorageUserId()
  if (baseKey.includes(`:u:${uid}:`)) return baseKey
  return `tt:u:${uid}:${baseKey}`
}

export const userStorage = {
  getItem(baseKey: string): string | null {
    try {
      const k = scopedKey(baseKey)
      const v = localStorage.getItem(k)
      if (v != null) return v
      if (getStorageUserId() === 'guest') {
        return localStorage.getItem(baseKey)
      }
      const legacy = localStorage.getItem(baseKey)
      if (legacy != null) {
        localStorage.setItem(k, legacy)
        return legacy
      }
      return null
    } catch {
      return null
    }
  },
  setItem(baseKey: string, value: string): void {
    try {
      localStorage.setItem(scopedKey(baseKey), value)
    } catch {
      /* quota */
    }
  },
  removeItem(baseKey: string): void {
    try {
      localStorage.removeItem(scopedKey(baseKey))
    } catch {
      /* */
    }
  },
}
