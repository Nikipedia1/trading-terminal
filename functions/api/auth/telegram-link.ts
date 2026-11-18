/**
 * Authenticated Telegram link helpers.
 * POST  → create one-time code (15 min). User opens t.me/Bot?start=CODE
 * DELETE → unlink telegramChatId from account
 * GET   → current link status
 */

import {
  type Env,
  cors,
  json,
  bad,
  requireUser,
  saveUser,
  publicUser,
} from './_shared'

interface TgEnv extends Env {
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_BOT_USERNAME?: string
}

const LINK_TTL_SEC = 15 * 60

function linkKey(code: string) {
  return `auth:tg_link:${code}`
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const onRequestOptions: PagesFunction<TgEnv> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestGet: PagesFunction<TgEnv> = async (ctx) => {
  const r = await requireUser(ctx.env, ctx.request)
  if (r instanceof Response) return r
  const username = ctx.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '') || null
  return json(
    {
      linked: Boolean(r.user.telegramChatId),
      telegramChatId: r.user.telegramChatId || null,
      botUsername: username,
    },
    200,
    ctx.request
  )
}

export const onRequestPost: PagesFunction<TgEnv> = async (ctx) => {
  const r = await requireUser(ctx.env, ctx.request)
  if (r instanceof Response) return r
  if (!ctx.env.WORKSPACE_KV) return bad('KV not configured', 503, ctx.request)
  if (!ctx.env.TELEGRAM_BOT_TOKEN) {
    return bad('TELEGRAM_BOT_TOKEN non configurato', 503, ctx.request)
  }

  const code = randomCode()
  await ctx.env.WORKSPACE_KV.put(
    linkKey(code),
    JSON.stringify({
      userId: r.user.id,
      email: r.user.email,
      createdAt: Date.now(),
    }),
    { expirationTtl: LINK_TTL_SEC }
  )

  const username = ctx.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '') || null
  const deepLink = username
    ? `https://t.me/${username}?start=${code}`
    : null

  return json(
    {
      ok: true,
      code,
      expiresInSec: LINK_TTL_SEC,
      botUsername: username,
      deepLink,
      instructions: deepLink
        ? 'Apri il link, premi Start sul bot: l account si collega in automatico.'
        : 'Scrivi al bot: /start ' + code,
    },
    200,
    ctx.request
  )
}

export const onRequestDelete: PagesFunction<TgEnv> = async (ctx) => {
  const r = await requireUser(ctx.env, ctx.request)
  if (r instanceof Response) return r
  if (!ctx.env.WORKSPACE_KV) return bad('KV not configured', 503, ctx.request)
  delete r.user.telegramChatId
  r.user.updatedAt = Date.now()
  await saveUser(ctx.env.WORKSPACE_KV, r.user)
  return json({ ok: true, user: publicUser(r.user) }, 200, ctx.request)
}
