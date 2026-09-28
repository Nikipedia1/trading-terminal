/**
 * Chrome around movable desk widgets (paper, book, tape, …).
 * Drag via .panel-drag-handle; close via − button.
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
      <div className="panel-drag-handle flex items-center gap-2 px-2 py-1 border-b border-terminal-border bg-terminal-bg shrink-0 cursor-move select-none min-h-[28px]">
        <span className="text-xxs font-semibold tracking-wide text-[#eaecef]">{title}</span>
        <button
          type="button"
          className="ml-auto text-terminal-red/80 hover:text-terminal-red text-xs px-1"
          title="Remove panel"
          onClick={(e) => {
            e.stopPropagation()
            removeWidget(id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          −
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
