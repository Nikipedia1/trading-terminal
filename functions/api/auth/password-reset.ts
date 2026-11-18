/**
 * Password reset – 6-digit OTP stored in KV (15 min TTL).
 * Delivery: Telegram bot when TELEGRAM_BOT_TOKEN + user.telegramChatId are set.
 * AUTH_DEV_RESET=1 also returns otp in JSON for local testing.
 */

import {
  type Env,
  bad,
  cors,
  json,
  normalizeEmail,
  validatePassword,
  hashPassword,
  getUserByEmail,
  getUserById,
  saveUser,
  checkRateLimit,
  clientIp,
  readJsonBody,
  sendTelegramMessage,
} from './_shared'

interface ResetEnv extends Env {
  AUTH_DEV_RESET?: string
  TELEGRAM_BOT_TOKEN?: string
}

const OTP_TTL_SEC = 15 * 60
const OTP_MAX_ATTEMPTS = 5

function otpKey(email: string) {
  return `auth:pwreset:otp:${email}`
}

function tokenKey(token: string) {
  return `auth:pwreset:${token}`
}

function randomOtp6(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000
  return String(n).padStart(6, '0')
}

export const onRequestOptions: PagesFunction<ResetEnv> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestPost: PagesFunction<ResetEnv> = async (ctx) => {
  const { env, request } = ctx
  if (!env.WORKSPACE_KV) return bad('KV not configured', 503, request)

  const ip = clientIp(request)
  const rl = await checkRateLimit(env.WORKSPACE_KV, `pwreset:ip:${ip}`, 8, 3600)
  if (!rl.ok) return bad(`rate limit – retry in ${rl.retryAfterSec}s`, 429, request)

  const bodyRes = await readJsonBody<{
    action?: string
    email?: string
    token?: string
    otp?: string
    code?: string
    password?: string
  }>(request)
  if (!bodyRes.ok) return bodyRes.response
  const body = bodyRes.data
  const action = String(body.action || 'request')

  if (action === 'request') {
    const email = normalizeEmail(String(body.email || ''))
    if (!email) return bad('invalid email', 400, request)
    const user = await getUserByEmail(env.WORKSPACE_KV, email)
    const generic = {
      ok: true,
      message:
        'Se l account esiste, abbiamo inviato un codice OTP a 6 cifre (valido 15 minuti).',
    }
    if (!user || user.disabled) {
      return json(generic, 200, request)
    }
    const otp = randomOtp6()
    await env.WORKSPACE_KV.put(
      otpKey(email),
      JSON.stringify({
        userId: user.id,
        email,
        otp,
        attempts: 0,
        createdAt: Date.now(),
      }),
      { expirationTtl: OTP_TTL_SEC }
    )
    const bytes = crypto.getRandomValues(new Uint8Array(24))
    const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
    await env.WORKSPACE_KV.put(
      tokenKey(token),
      JSON.stringify({ userId: user.id, email, createdAt: Date.now() }),
      { expirationTtl: OTP_TTL_SEC }
    )
    const payload: Record<string, unknown> = { ...generic }
    let delivered = false
    const chatId = user.telegramChatId?.trim()
    if (chatId && env.TELEGRAM_BOT_TOKEN) {
      const tg = await sendTelegramMessage(
        env,
        chatId,
        `NACS Lab Terminal — codice OTP reset password:\n\n${otp}\n\nValido 15 minuti. Se non hai richiesto tu il reset, ignora questo messaggio.`
      )
      delivered = tg.ok
      if (!tg.ok) {
        payload.telegramError = tg.error
      } else {
        payload.message =
          'Se l account esiste e ha Telegram collegato, abbiamo inviato un OTP sul bot.'
      }
    }

    if (env.AUTH_DEV_RESET === '1') {
      payload.otp = otp
      payload.resetToken = token
      payload.message =
        'DEV: codice OTP generato (AUTH_DEV_RESET=1). Usa otp o resetToken.' +
        (delivered ? ' (anche inviato su Telegram)' : '')
    } else if (!delivered && chatId && !env.TELEGRAM_BOT_TOKEN) {
      payload.message =
        'OTP generato ma TELEGRAM_BOT_TOKEN non configurato sul server.'
    } else if (!delivered && !chatId) {
      payload.message =
        'Se l account esiste: collega il Telegram chat ID (pannello Admin) per ricevere l OTP sul bot.'
    }
    payload.telegramDelivered = delivered
    return json(payload, 200, request)
  }

  if (action === 'confirm') {
    const password = String(body.password || '')
    const pwErr = validatePassword(password)
    if (pwErr) return bad(pwErr, 400, request)

    const emailNorm = normalizeEmail(String(body.email || ''))
    const otpRaw = String(body.otp || body.code || '').replace(/\D/g, '')
    const longToken = String(body.token || '').trim()

    let userId: string | null = null

    if (emailNorm && otpRaw.length === 6) {
      const raw = await env.WORKSPACE_KV.get(otpKey(emailNorm))
      if (!raw) return bad('OTP non valido o scaduto', 400, request)
      let rec: {
        userId: string
        email: string
        otp: string
        attempts: number
      }
      try {
        rec = JSON.parse(raw)
      } catch {
        return bad('OTP non valido o scaduto', 400, request)
      }
      rec.attempts = (rec.attempts || 0) + 1
      if (rec.attempts > OTP_MAX_ATTEMPTS) {
        await env.WORKSPACE_KV.delete(otpKey(emailNorm))
        return bad('troppi tentativi OTP – richiedi un nuovo codice', 400, request)
      }
      if (rec.otp !== otpRaw) {
        await env.WORKSPACE_KV.put(otpKey(emailNorm), JSON.stringify(rec), {
          expirationTtl: OTP_TTL_SEC,
        })
        return bad('codice OTP errato', 400, request)
      }
      userId = rec.userId
      await env.WORKSPACE_KV.delete(otpKey(emailNorm))
    } else if (longToken.length >= 32) {
      const raw = await env.WORKSPACE_KV.get(tokenKey(longToken))
      if (!raw) return bad('token non valido o scaduto', 400, request)
      try {
        const rec = JSON.parse(raw) as { userId: string }
        userId = rec.userId
      } catch {
        return bad('token non valido o scaduto', 400, request)
      }
      await env.WORKSPACE_KV.delete(tokenKey(longToken))
    } else {
      return bad('inserisci email + OTP a 6 cifre (oppure token di reset)', 400, request)
    }

    if (!userId) return bad('reset fallito', 400, request)
    const user = await getUserById(env.WORKSPACE_KV, userId)
    if (!user || user.disabled) return bad('utente non trovato', 404, request)

    const { salt, passwordHash } = await hashPassword(password)
    user.salt = salt
    user.passwordHash = passwordHash
    user.updatedAt = Date.now()
    await saveUser(env.WORKSPACE_KV, user)

    return json({ ok: true, message: 'Password aggiornata – effettua il login' }, 200, request)
  }

  return bad('unknown action', 400, request)
}
