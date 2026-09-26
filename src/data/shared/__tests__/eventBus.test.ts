import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../eventBus'

describe('EventBus', () => {
  it('delivers payload to subscribers', () => {
    const bus = new EventBus<{ tick: number }>()
    const handler = vi.fn()
    bus.on('tick', handler)
    bus.emit('tick', 42)
    expect(handler).toHaveBeenCalledWith(42)
  })

  it('unsubscribe stops delivery', () => {
    const bus = new EventBus<{ tick: number }>()
    const handler = vi.fn()
    const off = bus.on('tick', handler)
    off()
    bus.emit('tick', 1)
    expect(handler).not.toHaveBeenCalled()
  })

  it('clear removes all listeners', () => {
    const bus = new EventBus<{ a: string }>()
    const handler = vi.fn()
    bus.on('a', handler)
    bus.clear()
    bus.emit('a', 'x')
    expect(handler).not.toHaveBeenCalled()
  })
})
