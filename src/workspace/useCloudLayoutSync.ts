import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/auth'
import { useLayoutStore } from '@/stores/layoutStore'
import { FEATURES } from '@/lib/features'
import { buildSnapshot } from './snapshot'
import { saveWorkspace } from './api'

export function useCloudLayoutSync() {
  const status = useAuthStore((s) => s.status)
  const layout = useLayoutStore((s) => s.layout)
  const panels = useLayoutStore((s) => s.panels)
  const widgets = useLayoutStore((s) => s.widgets)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!FEATURES.autoCloudLayout) return
    if (status !== 'authenticated') return

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try {
        const snap = buildSnapshot('auto')
        void saveWorkspace(snap)
      } catch {
        /* */
      }
    }, 2_500)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [status, layout, panels, widgets])
}
