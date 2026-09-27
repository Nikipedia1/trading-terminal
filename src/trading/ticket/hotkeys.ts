/**
 * Global execution hotkeys (when enabled + focus not in input).
 * B = buy market · S = sell market
 * Shift+B = limit at bid · Shift+S = limit at ask
 * Escape = cancel all paper orders (or live if armed)
 */

import { useEffect } from 'react'
import { useExecutionStore } from '@/trading/execution/executionStore'
import { usePaperStore } from '@/trading/paper/paperStore'
import { useMarketStore } from '@/stores/marketStore'
import { auditAppend } from '@/trading/audit/auditLog'
import { cancelAllLiveOrders } from '@/trading/live/binanceSigned'

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

export function useExecutionHotkeys() {
  const hotkeysEnabled = useExecutionStore((s) => s.hotkeysEnabled)
  const mode = useExecutionStore((s) => s.mode)
  const defaultQty = useExecutionStore((s) => s.defaultQty)

  useEffect(() => {
    if (!hotkeysEnabled) return

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const symbol = useMarketStore.getState().symbol
      const last = useMarketStore.getState().ticker?.lastPrice ?? 0
      const book = useMarketStore.getState().orderBook
      const bid = book?.bids?.[0]?.price
      const ask = book?.asks?.[0]?.price

      const placePaper = (side: 'long' | 'short', type: 'market' | 'limit', price?: number) => {
        if (!(last > 0)) return
        const r = usePaperStore.getState().placeOrder({
          symbol,
          side,
          type,
          qty: defaultQty,
          leverage: 10,
          price: type === 'limit' ? price ?? last : null,
          markPrice: last,
          marginMode: 'isolated',
        })
        auditAppend({
          mode: 'paper',
          action: 'place',
          symbol,
          detail: `hotkey ${side} ${type} qty=${defaultQty} ${r.ok ? 'ok' : r.error}`,
          ok: r.ok,
        })
      }

      const key = e.key.toLowerCase()

      if (key === 'b' && !e.shiftKey) {
        e.preventDefault()
        if (mode === 'paper') placePaper('long', 'market')
      } else if (key === 's' && !e.shiftKey) {
        e.preventDefault()
        if (mode === 'paper') placePaper('short', 'market')
      } else if (key === 'b' && e.shiftKey) {
        e.preventDefault()
        if (mode === 'paper' && bid) placePaper('long', 'limit', bid)
      } else if (key === 's' && e.shiftKey) {
        e.preventDefault()
        if (mode === 'paper' && ask) placePaper('short', 'limit', ask)
      } else if (key === 'escape') {
        e.preventDefault()
        if (mode === 'paper') {
          const orders = usePaperStore.getState().orders.filter((o) => o.status === 'open')
          for (const o of orders) usePaperStore.getState().cancelOrder(o.id)
          auditAppend({
            mode: 'paper',
            action: 'cancel_all',
            symbol,
            detail: `cancelled ${orders.length} open orders`,
            ok: true,
          })
        } else {
          void cancelAllLiveOrders('binance_futures', symbol)
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotkeysEnabled, mode, defaultQty])
}
