import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  isSessionTokenShape,
  PBKDF2_ITERATIONS,
} from '../passwordCrypto'

describe('passwordCrypto', () => {
  it('uses 100k iterations constant', () => {
    expect(PBKDF2_ITERATIONS).toBe(100_000)
  })

  it('hashes and verifies', async () => {
    const { salt, passwordHash } = await hashPassword('correct-horse-battery')
    expect(salt.length).toBeGreaterThan(10)
    expect(passwordHash.length).toBeGreaterThan(10)
    expect(await verifyPassword('correct-horse-battery', salt, passwordHash)).toBe(true)
    expect(await verifyPassword('wrong-password-xx', salt, passwordHash)).toBe(false)
  })

  it('is deterministic for same salt', async () => {
    const a = await hashPassword('same-pass')
    const b = await hashPassword('same-pass', a.salt)
    expect(b.passwordHash).toBe(a.passwordHash)
  })

  it('session token shape is 64 hex chars', () => {
    const t = createSessionToken()
    expect(isSessionTokenShape(t)).toBe(true)
    expect(isSessionTokenShape('short')).toBe(false)
    expect(isSessionTokenShape(null)).toBe(false)
  })
})
