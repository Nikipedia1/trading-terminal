/**
 * PBKDF2-SHA256 password helpers (browser / Node 20+ Web Crypto).
 * Parameters must stay aligned with functions/api/auth/_shared.ts
 */

export const PBKDF2_ITERATIONS = 100_000

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function hashPassword(
  password: string,
  saltB64?: string
): Promise<{ salt: string; passwordHash: string }> {
  const salt = saltB64
    ? fromB64(saltB64)
    : crypto.getRandomValues(new Uint8Array(16))
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )
  return {
    salt:
      saltB64 ??
      b64(salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength)),
    passwordHash: b64(bits),
  }
}

export async function verifyPassword(
  password: string,
  salt: string,
  passwordHash: string
): Promise<boolean> {
  const { passwordHash: h } = await hashPassword(password, salt)
  if (h.length !== passwordHash.length) return false
  let ok = 0
  for (let i = 0; i < h.length; i++) ok |= h.charCodeAt(i)! ^ passwordHash.charCodeAt(i)!
  return ok === 0
}

export function createSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function isSessionTokenShape(token: string | null | undefined): boolean {
  return typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token)
}
