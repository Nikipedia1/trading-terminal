/**
 * Align Wallet active account ↔ Paper sub-account 1:1.
 * Switching wallet loads paper book tt-paper:v3:{walletId}.
 * Paper equity mirrors into wallet cashUsdt (debounced).
 */

import { useEffect, useRef } from 'react'
import { useWalletStore } from '@/wallet'
import { usePaperStore, positionUnrealizedPnl } from './paperStore'

export function usePaperWalletSync() {
  const activeId = useWalletStore((s) => s.activeId)
  const setCash = useWalletStore((s) => s.setCashUsdt)
  const bind = usePaperStore((s) => s.bindWalletAccount)
  const balance = usePaperStore((s) => s.account.balance)
  const positions = usePaperStore((s) => s.positions)
  const lastMirror = useRef(0)

  useEffect(() => {
    if (activeId) bind(activeId)
  }, [activeId, bind])

  useEffect(() => {
    if (!activeId || !setCash) return
    const now = Date.now()
    if (now - lastMirror.current < 2_000) return
    lastMirror.current = now
    let u = 0
    for (const p of positions) u += positionUnrealizedPnl(p)
    const equity = balance + u
    if (Number.isFinite(equity)) {
      try {
        setCash(Math.max(0, Math.round(equity * 100) / 100))
      } catch {
        /* */
      }
    }
  }, [activeId, balance, positions, setCash])
}
