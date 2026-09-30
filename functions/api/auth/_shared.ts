/**
 * Shared auth helpers for Cloudflare Pages Functions.
 * Passwords: PBKDF2-SHA256, never stored plaintext.
 * Session: HttpOnly cookie preferred; Bearer opt-in only.
 */

export interface Env {
  WORKSPACE_KV: KVNamespace
  AUTH_SECRET?: string
  /** Set to "1" to allow Authorization: Bearer session tokens */
  AUTH_ALLOW_BEARER?: string
}

export type UserRole = 'user' | 'admin'

export interface UserRecord {
  id: string
  email: string
  salt: string
  passwordHash: string
  role: UserRole
  createdAt: number
  updatedAt: number
  disabled?: boolean
}

export interface SessionRecord {
  userId: string
  email: string
  role: UserRole
  createdAt: number
}

const PBKDF2_ITERATIONS = 100_000
const SESSION_TTL_SEC = 60 * 60 * 24 * 7
export const AUTH_BODY_MAX = 4_096

export function cors(request: Request, extra?: HeadersInit): HeadersInit {
  const origin = request.headers.get('Origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Bearer',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    ...extra,
  }
}

export function json(
  data: unknown,
  status: number,
  request: Request,
  extraHeaders?: HeadersInit
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...cors(request),
      ...extraHeaders,
    },
  })
}

export function bad(msg: string, status: number, request: Request): Response {
  return json({ error: msg }, status, request)
}

export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 254) return null
  return e
}

export function validatePassword(pw: string): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'password min 8 characters'
  if (pw.length > 128) return 'password too long'
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return 'password needs at least one letter and one digit'
  }
  return null
}

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

export function userKeyEmail(email: string) {
  return `auth:user:email:${email}`
}
export function userKeyId(id: string) {
  return `auth:user:id:${id}`
}
export function sessionKey(token: string) {
  return `auth:session:${token}`
}
export const USERS_INDEX = 'auth:users:index'

export async function getUserByEmail(
  kv: KVNamespace,
  email: string
): Promise<UserRecord | null> {
  const raw = await kv.get(userKeyEmail(email))
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserRecord
  } catch {
    return null
  }
}

export async function getUserById(
  kv: KVNamespace,
  id: string
): Promise<UserRecord | null> {
  const raw = await kv.get(userKeyId(id))
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserRecord
  } catch {
    return null
  }
}

export async function saveUser(kv: KVNamespace, user: UserRecord): Promise<void> {
  const body = JSON.stringify(user)
  await kv.put(userKeyEmail(user.email), body)
  await kv.put(userKeyId(user.id), body)
  try {
    const idxRaw = await kv.get(USERS_INDEX)
    let ids: string[] = []
    try {
      ids = idxRaw ? (JSON.parse(idxRaw) as string[]) : []
    } catch {
      ids = []
    }
    if (!ids.includes(user.id)) {
      ids.push(user.id)
      await kv.put(USERS_INDEX, JSON.stringify(ids))
    }
  } catch {
    /* index secondary */
  }
}

export async function listUsers(kv: KVNamespace): Promise<UserRecord[]> {
  const out: UserRecord[] = []
  let cursor: string | undefined
  do {
    const page = await kv.list({
      prefix: 'auth:user:id:',
      limit: 100,
      cursor,
    })
    for (const key of page.keys) {
      const raw = await kv.get(key.name)
      if (!raw) continue
      try {
        out.push(JSON.parse(raw) as UserRecord)
      } catch {
        /* skip */
      }
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  const seen = new Set<string>()
  return out.filter((u) => {
    if (seen.has(u.id)) return false
    seen.add(u.id)
    return true
  })
}

export function publicUser(u: UserRecord) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    disabled: !!u.disabled,
  }
}

export async function createSession(
  kv: KVNamespace,
  user: UserRecord
): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  const rec: SessionRecord = {
    userId: user.id,
    email: user.email,
    role: user.role,
    createdAt: Date.now(),
  }
  await kv.put(sessionKey(token), JSON.stringify(rec), {
    expirationTtl: SESSION_TTL_SEC,
  })
  return token
}

export async function getSession(
  kv: KVNamespace,
  token: string | null
): Promise<SessionRecord | null> {
  if (!token || token.length < 32) return null
  const raw = await kv.get(sessionKey(token))
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionRecord
  } catch {
    return null
  }
}

export async function destroySession(
  kv: KVNamespace,
  token: string | null
): Promise<void> {
  if (!token) return
  await kv.delete(sessionKey(token))
}

/** Prefer HttpOnly cookie. Bearer only if AUTH_ALLOW_BEARER=1 or X-Auth-Bearer: 1. */
export function extractToken(
  request: Request,
  env?: { AUTH_ALLOW_BEARER?: string }
): string | null {
  const cookie = request.headers.get('Cookie') || ''
  const m = cookie.match(/(?:^|;\s*)tt_session=([a-f0-9]+)/i)
  if (m?.[1]) return m[1]

  const allowBearer =
    env?.AUTH_ALLOW_BEARER === '1' || request.headers.get('X-Auth-Bearer') === '1'
  if (!allowBearer) return null

  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) {
    const tok = auth.slice(7).trim()
    if (/^[a-f0-9]{64}$/i.test(tok)) return tok
  }
  return null
}

/** CSRF defense-in-depth for cookie-authenticated mutations. */
export function assertCsrf(request: Request): Response | null {
  const method = request.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null

  const cookie = request.headers.get('Cookie') || ''
  const hasSessionCookie = /(?:^|;\s*)tt_session=/.test(cookie)
  if (!hasSessionCookie) return null

  const origin = request.headers.get('Origin')
  const referer = request.headers.get('Referer')
  const expected = new URL(request.url).origin

  if (origin) {
    if (origin !== expected && origin !== 'null') {
      return bad('csrf: origin mismatch', 403, request)
    }
    return null
  }
  if (referer) {
    try {
      if (new URL(referer).origin !== expected) {
        return bad('csrf: referer mismatch', 403, request)
      }
      return null
    } catch {
      return bad('csrf: bad referer', 403, request)
    }
  }
  return bad('csrf: missing origin', 403, request)
}

export async function readJsonBody<T extends Record<string, unknown>>(
  request: Request,
  maxBytes = AUTH_BODY_MAX
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  const ct = request.headers.get('Content-Type') || ''
  if (ct && !ct.includes('application/json')) {
    return {
      ok: false,
      response: bad('Content-Type must be application/json', 415, request),
    }
  }
  const text = await request.text()
  if (text.length > maxBytes) {
    return { ok: false, response: bad('body too large', 413, request) }
  }
  try {
    const data = JSON.parse(text || '{}') as T
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, response: bad('invalid json object', 400, request) }
    }
    return { ok: true, data }
  } catch {
    return { ok: false, response: bad('invalid json', 400, request) }
  }
}

export function sessionCookie(
  token: string,
  request?: Request,
  maxAge = SESSION_TTL_SEC
): string {
  const url = request ? new URL(request.url) : null
  const secure =
    url?.protocol === 'https:' ||
    request?.headers.get('X-Forwarded-Proto') === 'https'
  const flags = secure ? 'HttpOnly; Secure; SameSite=Lax' : 'HttpOnly; SameSite=Lax'
  return `tt_session=${token}; Path=/; ${flags}; Max-Age=${maxAge}`
}

export function clearSessionCookie(request?: Request): string {
  const url = request ? new URL(request.url) : null
  const secure =
    url?.protocol === 'https:' ||
    request?.headers.get('X-Forwarded-Proto') === 'https'
  const flags = secure ? 'HttpOnly; Secure; SameSite=Lax' : 'HttpOnly; SameSite=Lax'
  return `tt_session=; Path=/; ${flags}; Max-Age=0`
}

export async function requireUser(
  env: Env,
  request: Request
): Promise<{ user: UserRecord; token: string } | Response> {
  if (!env.WORKSPACE_KV) return bad('KV not configured', 503, request)
  const csrf = assertCsrf(request)
  if (csrf) return csrf
  const token = extractToken(request, env)
  const sess = await getSession(env.WORKSPACE_KV, token)
  if (!sess || !token) return bad('unauthorized', 401, request)
  const user = await getUserById(env.WORKSPACE_KV, sess.userId)
  if (!user || user.disabled) return bad('unauthorized', 401, request)
  return { user, token }
}

export async function requireAdmin(
  env: Env,
  request: Request
): Promise<{ user: UserRecord; token: string } | Response> {
  const r = await requireUser(env, request)
  if (r instanceof Response) return r
  if (r.user.role !== 'admin') return bad('forbidden', 403, request)
  return r
}

export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSec: number
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const k = `auth:rl:${key}`
  const raw = await kv.get(k)
  const now = Date.now()
  let hits: number[] = []
  try {
    hits = raw ? (JSON.parse(raw) as number[]) : []
  } catch {
    hits = []
  }
  const cutoff = now - windowSec * 1000
  hits = hits.filter((t) => t > cutoff)
  if (hits.length >= limit) {
    const oldest = hits[0] ?? now
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + windowSec * 1000 - now) / 1000)
    )
    return { ok: false, retryAfterSec }
  }
  hits.push(now)
  await kv.put(k, JSON.stringify(hits), { expirationTtl: windowSec + 60 })
  return { ok: true }
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  )
}
