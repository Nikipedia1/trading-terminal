/**
 * Shared auth helpers for Cloudflare Pages Functions.
 * Passwords: PBKDF2-SHA256, never stored plaintext.
 */

export interface Env {
  WORKSPACE_KV: KVNamespace
  AUTH_SECRET?: string
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

export function cors(request: Request, extra?: HeadersInit): HeadersInit {
  const origin = request.headers.get('Origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
  return null
}

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
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
  for (let i = 0; i < h.length; i++) ok |= h.charCodeAt(i) ^ passwordHash.charCodeAt(i)
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
}

export async function listUsers(kv: KVNamespace): Promise<UserRecord[]> {
  const idxRaw = await kv.get(USERS_INDEX)
  if (!idxRaw) return []
  let ids: string[] = []
  try {
    ids = JSON.parse(idxRaw) as string[]
  } catch {
    return []
  }
  const out: UserRecord[] = []
  for (const id of ids) {
    const u = await getUserById(kv, id)
    if (u) out.push(u)
  }
  return out
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

export function extractToken(request: Request): string | null {
  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) {
    const t = auth.slice(7).trim()
    if (t) return t
  }
  const cookie = request.headers.get('Cookie') || ''
  const m = cookie.match(/(?:^|;\s*)tt_session=([a-f0-9]+)/i)
  return m?.[1] ?? null
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
  const token = extractToken(request)
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
