/**
 * TOTP 2FA (RFC 6238) – secret stored on user record; verify on login step 2.
 */

import {
  type Env,
  bad,
  cors,
  json,
  requireUser,
  saveUser,
  getUserByEmail,
  createSession,
  sessionCookie,
  publicUser,
  verifyPassword,
  normalizeEmail,
  checkRateLimit,
  clientIp,
  readJsonBody,
  type UserRecord,
} from './_shared'

function base32Encode(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let output = ''
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]!
    bits += 8
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31]
  return output
}

function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const cleaned = input.replace(/=+$/, '').toUpperCase()
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const c of cleaned) {
    const idx = alphabet.indexOf(c)
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

async function hotp(secret: Uint8Array, counter: number): Promise<string> {
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  // high 32 bits 0 for typical counters
  view.setUint32(0, 0)
  view.setUint32(4, counter >>> 0)
  const key = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf))
  const offset = sig[sig.length - 1]! & 0xf
  const code =
    ((sig[offset]! & 0x7f) << 24) |
    ((sig[offset + 1]! & 0xff) << 16) |
    ((sig[offset + 2]! & 0xff) << 8) |
    (sig[offset + 3]! & 0xff)
  return String(code % 1_000_000).padStart(6, '0')
}

async function verifyTotp(secretB32: string, code: string): Promise<boolean> {
  const secret = base32Decode(secretB32)
  const timestep = Math.floor(Date.now() / 1000 / 30)
  for (let w = -1; w <= 1; w++) {
    const expected = await hotp(secret, timestep + w)
    if (expected === code) return true
  }
  return false
}

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { env, request } = ctx
  if (!env.WORKSPACE_KV) return bad('KV not configured', 503, request)

  const bodyRes = await readJsonBody<{
    action?: string
    code?: string
    email?: string
    password?: string
  }>(request)
  if (!bodyRes.ok) return bodyRes.response
  const action = String(bodyRes.data.action || '')

  // Setup / disable requires session
  if (action === 'setup' || action === 'enable' || action === 'disable') {
    const auth = await requireUser(env, request)
    if (auth instanceof Response) return auth
    const user = auth.user as UserRecord & { totpSecret?: string; totpEnabled?: boolean }

    if (action === 'setup') {
      const secretBytes = crypto.getRandomValues(new Uint8Array(20))
      const secret = base32Encode(secretBytes)
      user.totpSecret = secret
      user.totpEnabled = false
      user.updatedAt = Date.now()
      await saveUser(env.WORKSPACE_KV, user)
      const issuer = encodeURIComponent('NACS Lab Terminal')
      const label = encodeURIComponent(user.email)
      const otpauth = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30`
      return json({ secret, otpauth }, 200, request)
    }

    if (action === 'enable') {
      const code = String(bodyRes.data.code || '')
      if (!user.totpSecret) return bad('run setup first', 400, request)
      if (!(await verifyTotp(user.totpSecret, code))) return bad('invalid code', 401, request)
      user.totpEnabled = true
      user.updatedAt = Date.now()
      await saveUser(env.WORKSPACE_KV, user)
      return json({ ok: true, totpEnabled: true }, 200, request)
    }

    if (action === 'disable') {
      const code = String(bodyRes.data.code || '')
      if (user.totpEnabled && user.totpSecret) {
        if (!(await verifyTotp(user.totpSecret, code))) return bad('invalid code', 401, request)
      }
      user.totpEnabled = false
      user.totpSecret = undefined
      user.updatedAt = Date.now()
      await saveUser(env.WORKSPACE_KV, user)
      return json({ ok: true, totpEnabled: false }, 200, request)
    }
  }

  // Login step 2: password already verified via temp flag — here full login with TOTP
  if (action === 'login') {
    const ip = clientIp(request)
    const rl = await checkRateLimit(env.WORKSPACE_KV, `totp:ip:${ip}`, 20, 60)
    if (!rl.ok) return bad('rate limit', 429, request)

    const email = normalizeEmail(String(bodyRes.data.email || ''))
    if (!email) return bad('invalid email', 400, request)
    const user = (await getUserByEmail(env.WORKSPACE_KV, email)) as
      | (UserRecord & { totpSecret?: string; totpEnabled?: boolean })
      | null
    if (!user || user.disabled) return bad('invalid credentials', 401, request)
    if (!(await verifyPassword(String(bodyRes.data.password || ''), user.salt, user.passwordHash))) {
      return bad('invalid credentials', 401, request)
    }
    if (user.totpEnabled && user.totpSecret) {
      const code = String(bodyRes.data.code || '')
      if (!(await verifyTotp(user.totpSecret, code))) return bad('invalid 2FA code', 401, request)
    }
    const token = await createSession(env.WORKSPACE_KV, user)
    // index session
    try {
      const idxKey = `auth:sessions:user:${user.id}`
      const raw = await env.WORKSPACE_KV.get(idxKey)
      const list = raw ? (JSON.parse(raw) as { token: string; createdAt: number }[]) : []
      list.push({ token, createdAt: Date.now() })
      await env.WORKSPACE_KV.put(idxKey, JSON.stringify(list.slice(-20)))
    } catch {
      /* */
    }
    return json(
      { user: publicUser(user) },
      200,
      request,
      { 'Set-Cookie': sessionCookie(token, request) }
    )
  }

  return bad('unknown action', 400, request)
}
