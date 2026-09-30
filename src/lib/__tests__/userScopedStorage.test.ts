import { describe, it, expect, beforeEach } from 'vitest'
import { setStorageUserId, getStorageUserId, scopedKey, userStorage } from '../userScopedStorage'

const mem = new Map<string, string>()

beforeEach(() => {
  mem.clear()
  setStorageUserId(null)
  // @ts-expect-error test polyfill
  globalThis.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v) },
    removeItem: (k: string) => { mem.delete(k) },
  }
})

describe('userScopedStorage', () => {
  it('defaults to guest namespace', () => {
    expect(getStorageUserId()).toBe('guest')
    expect(scopedKey('tt-bots:v1')).toContain('guest')
  })

  it('isolates keys per user', () => {
    setStorageUserId('user-a')
    userStorage.setItem('tt-bots:v1', 'A')
    setStorageUserId('user-b')
    userStorage.setItem('tt-bots:v1', 'B')
    setStorageUserId('user-a')
    expect(userStorage.getItem('tt-bots:v1')).toBe('A')
    setStorageUserId('user-b')
    expect(userStorage.getItem('tt-bots:v1')).toBe('B')
  })
})
