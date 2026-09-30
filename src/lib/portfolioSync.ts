/**
 * Optional server backup of paper account summary (authenticated).
 */

import { createLogger } from '@/lib/logger'

const log = createLogger('portfolioSync')

export async function pushPortfolio(payload: unknown): Promise<boolean> {
  try {
    const res = await fetch('/api/user/portfolio', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch (e) {
    log.warn('push failed', e)
    return false
  }
}

export async function pullPortfolio(): Promise<unknown | null> {
  try {
    const res = await fetch('/api/user/portfolio', { credentials: 'include' })
    if (!res.ok) return null
    const data = (await res.json()) as { portfolio?: unknown }
    return data.portfolio ?? null
  } catch (e) {
    log.warn('pull failed', e)
    return null
  }
}
