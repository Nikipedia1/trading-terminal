/**
 * Chrome around movable desk widgets.
 * Drag via .panel-drag-handle; close via ×.
 */

import type { ReactNode } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'

interface WidgetShellProps {
  id: string
  title: string
  children: ReactNode
}

export function WidgetShell({ id, title, children }: WidgetShellProps) {
  const removeWidget = useLayoutStore((s) => s.removeWidget)

  return (
    <div className="h-full w-full flex flex-col overflow-hidden rounded-[inherit]">
      <div className="panel-drag-handle nacs-widget-title cursor-move select-none min-h-[34px]">
        <span className="truncate font-semibold tracking-wide text-[#c8d0dc]">{title}</span>
        <button
          type="button"
          className="ml-auto shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border border-white/10 bg-white/[0.03] text-[#f2556d] text-sm font-bold leading-none hover:bg-[#f2556d]/15 hover:border-[#f2556d]/40 active:scale-95"
          title="Chiudi pannello"
          aria-label="Chiudi pannello"
          onClick={(e) => {
            e.stopPropagation()
            removeWidget(id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          ×
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
