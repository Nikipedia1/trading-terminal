/**
 * Telegram Bot webhook.
 * User opens t.me/Bot?start=CODE (code from /api/auth/telegram-link).
 * Binds message.chat.id → user.telegramChatId.
 *
 * Setup once:
 *   curl "https://api.telegram.org/bot$TOKEN/setWebhook?url=https://YOUR_DOMAIN/api/telegram/webhook"
 * Optional secret: header X-Telegram-Bot-Api-Secret-Token = TELEGRAM_WEBHOOK_SECRET
 */

import {
  type Env,
  cors,
  json,
  bad,
  getUserById,
  saveUser,
  sendTelegramMessage,
} from '../auth/_shared'

interface TgEnv extends Env {
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_WEBHOOK_SECRET?: string
}

interface TgUpdate {
  update_id?: number
  message?: {
    message_id?: number
    text?: string
    chat?: { id?: number; type?: string }
    from?: { id?: number; username?: string }
  }
}

function linkKey(code: string) {
  return `auth:tg_link:${code}`
}

function extractStartPayload(text: string): string | null {
  const t = text.trim()
  // /start CODE  or  /start@BotName CODE
  const m = t.match(/^\/start(?:@\w+)?(?:\s+(\S+))?$/i)
  if (!m) return null
  return m[1] ? m[1].trim() : ''
}

export const onRequestOptions: PagesFunction<TgEnv> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

/** Telegram may use GET for health checks */
export const onRequestGet: PagesFunction<TgEnv> = async (ctx) =>
  json({ ok: true, service: 'telegram-webhook' }, 200, ctx.request)

export const onRequestPost: PagesFunction<TgEnv> = async (ctx) => {
  const { env, request } = ctx
  if (!env.WORKSPACE_KV) return bad('KV not configured', 503, request)
  if (!env.TELEGRAM_BOT_TOKEN) return bad('bot token missing', 503, request)

  const secret = env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (secret) {
    const hdr = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || ''
    if (hdr !== secret) return bad('unauthorized', 401, request)
  }

  let update: TgUpdate
  try {
    update = (await request.json()) as TgUpdate
  } catch {
    return bad('invalid json', 400, request)
  }

  const msg = update.message
  const chatId = msg?.chat?.id
  const text = msg?.text || ''
  if (chatId == null) {
    // Always 200 so Telegram does not retry endlessly
    return json({ ok: true, ignored: true }, 200, request)
  }

  const chatIdStr = String(chatId)
  const startPayload = extractStartPayload(text)

  // Plain /start without code → help
  if (startPayload === '') {
    await sendTelegramMessage(
      env,
      chatIdStr,
      'NACS Lab Terminal\n\nPer collegare l account:\n1. Accedi al terminal\n2. Genera il link Telegram\n3. Apri il link o invia:\n   /start CODICE\n\nPoi riceverai gli OTP di reset password qui.'
    )
    return json({ ok: true, help: true }, 200, request)
  }

  if (startPayload) {
    const raw = await env.WORKSPACE_KV.get(linkKey(startPayload))
    if (!raw) {
      await sendTelegramMessage(
        env,
        chatIdStr,
        'Codice non valido o scaduto (15 min). Generane uno nuovo dal terminal e riprova.'
      )
      return json({ ok: true, error: 'invalid_code' }, 200, request)
    }
    let rec: { userId: string; email: string }
    try {
      rec = JSON.parse(raw) as { userId: string; email: string }
    } catch {
      await env.WORKSPACE_KV.delete(linkKey(startPayload))
      await sendTelegramMessage(env, chatIdStr, 'Codice corrotto – regenera dal terminal.')
      return json({ ok: true, error: 'bad_code' }, 200, request)
    }

    const user = await getUserById(env.WORKSPACE_KV, rec.userId)
    if (!user || user.disabled) {
      await sendTelegramMessage(env, chatIdStr, 'Account non trovato o disabilitato.')
      return json({ ok: true, error: 'no_user' }, 200, request)
    }

    user.telegramChatId = chatIdStr
    user.updatedAt = Date.now()
    await saveUser(env.WORKSPACE_KV, user)
    await env.WORKSPACE_KV.delete(linkKey(startPayload))

    await sendTelegramMessage(
      env,
      chatIdStr,
      `Collegato a ${user.email}.\nDa ora gli OTP di reset password arriveranno in questa chat.`
    )
    return json({ ok: true, linked: true, userId: user.id }, 200, request)
  }

  // Other messages
  if (text.startsWith('/')) {
    await sendTelegramMessage(
      env,
      chatIdStr,
      'Comandi:\n/start – istruzioni\n/start CODICE – collega account'
    )
  }

  return json({ ok: true }, 200, request)
}
