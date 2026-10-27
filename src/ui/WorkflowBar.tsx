/**
 * One-click desk workflows (focused layouts, not 30 panels).
 * Applies workspace templates: symbol/interval + lean widget set.
 */
import { useState } from 'react'
import { WORKSPACE_TEMPLATES, applyTemplate } from '@/workspace/templates'

export function WorkflowBar() {
  const [flash, setFlash] = useState<string | null>(null)

  const run = (id: string) => {
    const r = applyTemplate(id)
    setFlash(r.ok ? `✓ ${r.name}` : r.error ?? 'Failed')
    window.setTimeout(() => setFlash(null), 2200)
  }

  return (
    <div className="relative flex items-center gap-1 shrink-0">
      <span className="text-[9px] uppercase tracking-wider text-[#5e6673] hidden sm:inline px-1">
        Workflow
      </span>
      {WORKSPACE_TEMPLATES.map((tpl) => (
        <button
          key={tpl.id}
          type="button"
          title={tpl.description}
          onClick={() => run(tpl.id)}
          className="text-[10px] px-1.5 py-0.5 rounded border border-[#2b3139] bg-[#12161c] text-[#c8cdd5] hover:border-[#f0b90b]/50 hover:text-[#f0b90b] whitespace-nowrap max-w-[9rem] truncate"
        >
          {tpl.name}
        </button>
      ))}
      {flash && (
        <span className="absolute left-0 top-full mt-1 z-[60] px-2 py-0.5 rounded border border-[#f0b90b]/40 bg-[#12161c] text-[10px] text-[#f0b90b] whitespace-nowrap shadow-lg">
          {flash}
        </span>
      )}
    </div>
  )
}
