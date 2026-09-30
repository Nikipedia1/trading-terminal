import { createLogger, errMessage } from '@/lib/logger'
const log = createLogger('EventBus')
/**
 * Minimal typed pub/sub – no external deps.
 * Used by shared feeds so analysis modules can subscribe without owning sockets.
 */

export type Unsubscribe = () => void

export class EventBus<Events extends Record<string, unknown>> {
  private listeners = new Map<
    keyof Events,
    Set<(payload: Events[keyof Events]) => void>
  >()

  on<K extends keyof Events>(
    event: K,
    handler: (payload: Events[K]) => void
  ): Unsubscribe {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(handler as (payload: Events[keyof Events]) => void)
    return () => {
      set!.delete(handler as (payload: Events[keyof Events]) => void)
    }
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const handler of set) {
      try {
        handler(payload)
      } catch (e: unknown) {
        log.error(`listener error: ${String(event)}`, errMessage(e))
      }
    }
  }

  clear(event?: keyof Events): void {
    if (event !== undefined) this.listeners.delete(event)
    else this.listeners.clear()
  }
}
