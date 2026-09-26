/**
 * Minimal typed pub/sub – no external deps.
 * Used by shared feeds so analysis modules can subscribe without owning sockets.
 */

export type Unsubscribe = () => void

export class EventBus<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<(payload: any) => void>>()

  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): Unsubscribe {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(handler as (payload: any) => void)
    return () => {
      set!.delete(handler as (payload: any) => void)
      if (set!.size === 0) this.listeners.delete(event)
    }
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const h of set) {
      try {
        h(payload)
      } catch (e) {
        console.error('[EventBus] listener error', event, e)
      }
    }
  }

  listenerCount<K extends keyof Events>(event: K): number {
    return this.listeners.get(event)?.size ?? 0
  }

  clear(): void {
    this.listeners.clear()
  }
}
