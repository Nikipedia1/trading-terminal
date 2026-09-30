/** Keep paper trading book bound to the active wallet account. */

import { useEffect } from 'react'
import { useWalletStore } from '@/wallet'
import { usePaperStore } from './paperStore'

export function usePaperWalletSync() {
  const activeId = useWalletStore((s) => s.activeId)
  const bind = usePaperStore((s) => s.bindWalletAccount)

  useEffect(() => {
    if (activeId) bind(activeId)
  }, [activeId, bind])
}
