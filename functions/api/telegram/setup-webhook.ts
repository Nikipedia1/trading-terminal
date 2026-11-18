/**
 * Register Telegram setWebhook using secrets already on Cloudflare.
 * POST /api/telegram/setup-webhook  (admin session required)
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN          (required secret)
 *   TELEGRAM_BOT_USERNAME       (optional, without @)
 *   TELEGRAM_WEBHOOK_SECRET    (optional secret_token for Telegram)
 *   TELEGRAM_WEBHOOK_URL       (optional full URL; default = origin + /api/telegram/webhook)
 */

import {
  type Env,
  cors,
  json,
  bad,
  requireAdmin,
} from '../auth/_shared'

interface TgEnv extends Env {
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_BOT_USERNAME?: string
  TELEGRAM_WEBHOOK_SECRET?: string
  TELEGRAM_WEBHOOK_URL?: string
}

export const onRequestOptions: PagesFunction<TgEnv> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestGet: PagesFunction<TgEnv> = async (ctx) => {
  const r = await requireAdmin(ctx.env, ctx.request)
  if (r instanceof Response) return r

  const token = ctx.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) return bad('TELEGRAM_BOT_TOKEN non configurato', 503, ctx.request)

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const data = await res.json()
    return json({ ok: true, webhook: data }, 200, ctx.request)
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'telegram error', 502, ctx.request)
  }
}

export const onRequestPost: PagesFunction<TgEnv> = async (ctx) => {
  const r = await requireAdmin(ctx.env, ctx.request)
  if (r instanceof Response) return r

  const token = ctx.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) return bad('TELEGRAM_BOT_TOKEN non configurato su Cloudflare', 503, ctx.request)

  const origin = new URL(ctx.request.url).origin
  const webhookUrl =
    ctx.env.TELEGRAM_WEBHOOK_URL?.trim() || `${origin}/api/telegram/webhook`

  if (!/^https:\/\//i.test(webhookUrl)) {
    return bad('webhook URL must be https', 400, ctx.request)
  }

  const body: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  }
  const secret = ctx.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (secret) body.secret_token = secret

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json()) as {
      ok?: boolean
      description?: string
      result?: boolean
    }
    if (!data.ok) {
      return bad(data.description || 'setWebhook failed', 502, ctx.request)
    }
    return json(
      {
        ok: true,
        webhookUrl,
        description: data.description || 'Webhook was set',
        botUsername: ctx.env.TELEGRAM_BOT_USERNAME || null,
        hasSecretToken: Boolean(secret),
      },
      200,
      ctx.request
    )
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'telegram network error', 502, ctx.request)
  }
}
