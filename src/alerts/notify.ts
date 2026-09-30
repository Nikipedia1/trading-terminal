/**
 * Notification channels: sound, desktop Notification API, webhook + server relay.
 */

const WEBHOOK_KEY = 'tt-alert-webhook:v1'

export function getWebhookUrl(): string {
  try {
    return localStorage.getItem(WEBHOOK_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setWebhookUrl(url: string) {
  try {
    if (!url.trim()) localStorage.removeItem(WEBHOOK_KEY)
    else localStorage.setItem(WEBHOOK_KEY, url.trim())
  } catch {
    /* */
  }
}

export function playAlertSound(kind: 'soft' | 'hard' = 'soft') {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = kind === 'hard' ? 880 : 660
    o.connect(g)
    g.connect(ctx.destination)
    g.gain.value = 0.06
    o.start()
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    o.stop(ctx.currentTime + 0.26)
  } catch {
    /* autoplay blocked */
  }
}

export async function ensureDesktopPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const r = await Notification.requestPermission()
  return r === 'granted'
}

export function desktopNotify(title: string, body: string) {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, silent: false })
  } catch {
    /* */
  }
}

export async function webhookNotify(text: string): Promise<boolean> {
  const url = getWebhookUrl()
  if (!url) return false
  try {
    const isDiscord = /discord(?:app)?\.com\/api\/webhooks/i.test(url)
    const body = isDiscord
      ? JSON.stringify({ content: text.slice(0, 1900) })
      : JSON.stringify({ text: text.slice(0, 3500) })
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    return res.ok || res.status === 204
  } catch {
    return false
  }
}

export async function dispatchChannels(
  opts: { sound: boolean; desktop: boolean; webhook: boolean; server?: boolean },
  title: string,
  body: string
) {
  if (opts.sound) playAlertSound()
  if (opts.desktop) desktopNotify(title, body)
  if (opts.webhook) void webhookNotify(`${title}\n${body}`)
  if (opts.server) void serverWebhookDispatch(title, body)
}

export async function serverWebhookDispatch(title: string, body: string): Promise<boolean> {
  try {
    const res = await fetch('/api/alerts/webhook', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dispatch', title, body }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function registerServerWebhook(url: string): Promise<boolean> {
  try {
    const res = await fetch('/api/alerts/webhook', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', url }),
    })
    return res.ok
  } catch {
    return false
  }
}
