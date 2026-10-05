/**
 * Chrome around movable desk widgets (paper, book, tape, …).
 * Drag via .panel-drag-handle; close via × button.
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
    <div className="h-full w-full flex flex-col bg-terminal-panel border border-terminal-border rounded-sm overflow-hidden">
      <div className="panel-drag-handle flex items-center gap-2 px-2 py-1 border-b border-terminal-border bg-terminal-bg shrink-0 cursor-move select-none min-h-[32px]">
        <span className="text-xxs font-semibold tracking-wide text-[#eaecef]">{title}</span>
        <button
          type="button"
          className="ml-auto shrink-0 flex items-center justify-center w-7 h-7 rounded border border-[#2b3139] bg-[#12161c] text-[#f6465d] text-sm font-bold leading-none hover:bg-[#f6465d]/15 hover:border-[#f6465d]/60 active:scale-95"
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
