import { useState } from 'react'
import { useLayoutStore, WIDGET_META } from '@/stores/layoutStore'

const QUICK_PANELS = ['battlefield', 'book', 'tape', 'viz3d', 'quantlab', 'news', 'terminal'] as const

const PANEL_LABELS: Partial<Record<string, string>> = {
  battlefield: '⚔ Battlefield',
  book: 'Order Book',
  tape: 'Tape',
  viz3d: '3D Viz',
  quantlab: 'Quant Lab',
  news: 'News',
  terminal: 'Terminal',
}

export function DeskAddControls() {
  const addChartPanel = useLayoutStore((s) => s.addChartPanel)
  const addWidget = useLayoutStore((s) => s.addWidget)
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-1.5 mr-1">
      <button
        type="button"
        className="text-[11px] px-2.5 py-1 rounded border border-[#2b3139] bg-[#12161c] text-[#eaecef] hover:border-[#f0b90b]/50 hover:text-[#f0b90b] font-medium"
        onClick={() => addChartPanel()}
      >
        + Chart
      </button>
      <button
        type="button"
        className="text-[11px] px-2.5 py-1 rounded border border-[#0ecb81]/40 bg-[#0ecb81]/10 text-[#0ecb81] hover:border-[#0ecb81] hover:bg-[#0ecb81]/20 font-medium"
        title="Open Battlefield (bulls vs bears)"
        onClick={() => addWidget('battlefield')}
      >
        ⚔ Battlefield
      </button>
      <div className="relative">
        <button
          type="button"
          className="text-[11px] px-2.5 py-1 rounded border border-[#2b3139] bg-[#12161c] text-[#eaecef] hover:border-[#f0b90b]/50 hover:text-[#f0b90b] font-medium"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          + Panel
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} aria-hidden />
            <div className="absolute right-0 top-full mt-1 bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-xl p-1 z-[80] max-h-72 overflow-y-auto min-w-[180px]">
              {QUICK_PANELS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="block w-full text-left text-[11px] px-2 py-1.5 text-[#c8cdd5] hover:bg-[#1e2329] rounded"
                  onClick={() => {
                    addWidget(k)
                    setOpen(false)
                  }}
                >
                  {PANEL_LABELS[k] ?? WIDGET_META[k]?.title ?? k}
                </button>
              ))}
              <div className="border-t border-[#2b3139] my-1" />
              {Object.keys(WIDGET_META)
                .filter((k) => !(QUICK_PANELS as readonly string[]).includes(k))
                .map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="block w-full text-left text-[10px] px-2 py-1 text-[#848e9c] hover:bg-[#1e2329] rounded"
                    onClick={() => {
                      addWidget(k as any)
                      setOpen(false)
                    }}
                  >
                    {WIDGET_META[k as keyof typeof WIDGET_META]?.title ?? k}
                  </button>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
