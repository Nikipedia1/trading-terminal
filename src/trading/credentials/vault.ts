/**
 * Local credential vault – AES-GCM with user passphrase.
 * Secrets never leave the browser; never logged in plain text.
 * Live trading is opt-in only; default is paper.
 */

export type LiveVenue = 'binance_spot' | 'binance_futures'

export interface StoredCredentialMeta {
  venue: LiveVenue
  label: string
  /** First/last 4 of apiKey only – never full key */
  keyHint: string
  createdAt: number
}

interface VaultBlob {
  v: 1
  salt: string
  iv: string
  ciphertext: string
  meta: StoredCredentialMeta
}

const STORAGE_PREFIX = 'tt-vault:v1:'

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

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const base = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 120_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export function listVaultMeta(): StoredCredentialMeta[] {
  const out: StoredCredentialMeta[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith(STORAGE_PREFIX)) continue
      const raw = localStorage.getItem(k)
      if (!raw) continue
      const blob = JSON.parse(raw) as VaultBlob
      if (blob?.meta) out.push(blob.meta)
    }
  } catch {
    /* ignore */
  }
  return out
}

export async function vaultStore(
  venue: LiveVenue,
  apiKey: string,
  apiSecret: string,
  passphrase: string,
  label = venue
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!apiKey.trim() || !apiSecret.trim()) {
    return { ok: false, error: 'API key and secret required' }
  }
  if (passphrase.length < 8) {
    return { ok: false, error: 'Passphrase min 8 characters' }
  }
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const key = await deriveKey(passphrase, salt)
    const payload = JSON.stringify({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() })
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(payload)
    )
    const meta: StoredCredentialMeta = {
      venue,
      label,
      keyHint: `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`,
      createdAt: Date.now(),
    }
    const blob: VaultBlob = {
      v: 1,
      salt: b64(salt.buffer),
      iv: b64(iv.buffer),
      ciphertext: b64(ct),
      meta,
    }
    localStorage.setItem(STORAGE_PREFIX + venue, JSON.stringify(blob))
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Encrypt failed' }
  }
}

export async function vaultUnlock(
  venue: LiveVenue,
  passphrase: string
): Promise<
  { ok: true; apiKey: string; apiSecret: string } | { ok: false; error: string }
> {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + venue)
    if (!raw) return { ok: false, error: 'No credentials stored for ' + venue }
    const blob = JSON.parse(raw) as VaultBlob
    const key = await deriveKey(passphrase, fromB64(blob.salt))
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(blob.iv) as BufferSource },
      key,
      fromB64(blob.ciphertext) as BufferSource
    )
    const data = JSON.parse(new TextDecoder().decode(pt)) as {
      apiKey: string
      apiSecret: string
    }
    if (!data.apiKey || !data.apiSecret) {
      return { ok: false, error: 'Corrupt vault payload' }
    }
    return { ok: true, apiKey: data.apiKey, apiSecret: data.apiSecret }
  } catch {
    return { ok: false, error: 'Wrong passphrase or corrupt vault' }
  }
}

export function vaultDelete(venue: LiveVenue) {
  localStorage.removeItem(STORAGE_PREFIX + venue)
}

/** In-memory session only – cleared on tab close; never persisted unlocked. */
let session: {
  venue: LiveVenue
  apiKey: string
  apiSecret: string
} | null = null

export function setSessionCredentials(
  venue: LiveVenue,
  apiKey: string,
  apiSecret: string
) {
  session = { venue, apiKey, apiSecret }
}

export function clearSessionCredentials() {
  session = null
}

export function getSessionCredentials(
  venue: LiveVenue
): { apiKey: string; apiSecret: string } | null {
  if (!session || session.venue !== venue) return null
  return { apiKey: session.apiKey, apiSecret: session.apiSecret }
}
