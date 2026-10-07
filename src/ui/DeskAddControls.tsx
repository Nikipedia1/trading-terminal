import { useEffect, useMemo, useRef, useState } from 'react'
import { useLayoutStore, WIDGET_META } from '@/stores/layoutStore'
import type { WidgetKind } from '@/types'

const PRIORITY: WidgetKind[] = [
  'battlefield',
  'book',
  'tape',
  'large',
  'viz3d',
  'quantlab',
  'news',
  'terminal',
  'watchlist',
  'paper',
  'wallet',
  'alerts',
  'journal',
  'futures',
  'liquidity',
  'micro',
  'calendar',
  'livetv',
  'learn',
  'onchain',
  'bots',
  'backtest',
  'ai',
  'livekeys',
  'plugins',
  'ops',
  'admin',
]

const LABELS: Partial<Record<WidgetKind, string>> = {
  battlefield: '⚔ Battlefield',
  book: 'Order Book',
  tape: 'Tape',
  large: 'Large Trades',
  viz3d: '3D Pro',
  quantlab: 'Quant Lab',
  news: 'News',
  terminal: 'Terminal',
  watchlist: 'Watchlist',
  paper: 'Trade',
  wallet: 'Wallet',
  alerts: 'Alerts',
  journal: 'Journal',
  futures: 'Futures',
  liquidity: 'Liquidity',
  micro: 'Microstructure',
  calendar: 'Calendario',
  livetv: 'Live TV',
  learn: 'Learn',
  onchain: 'On-chain',
  bots: 'Bots',
  backtest: 'Backtest',
  ai: 'AI Analysis',
  livekeys: 'Live Keys',
  plugins: 'Plugins',
  ops: 'Ops',
  admin: 'Admin',
}

function labelFor(k: WidgetKind): string {
  return LABELS[k] ?? WIDGET_META[k]?.title ?? k
}

export function DeskAddControls() {
  const addChartPanel = useLayoutStore((s) => s.addChartPanel)
  const addWidget = useLayoutStore((s) => s.addWidget)
  const widgets = useLayoutStore((s) => s.widgets)
  const [open, setOpen] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const allKinds = useMemo(() => {
    const keys = Object.keys(WIDGET_META) as WidgetKind[]
    const rank = new Map(PRIORITY.map((k, i) => [k, i]))
    return [...keys].sort((a, b) => {
      const ra = rank.get(a)
      const rb = rank.get(b)
      if (ra != null && rb != null) return ra - rb
      if (ra != null) return -1
      if (rb != null) return 1
      return labelFor(a).localeCompare(labelFor(b))
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (kind: WidgetKind) => {
    const before = useLayoutStore.getState().widgets.length
    addWidget(kind)
    const after = useLayoutStore.getState().widgets.length
    const title = labelFor(kind)
    if (after > before) {
      setFlash(`Aperto: ${title}`)
    } else {
      setFlash(`Non aggiunto: ${title}`)
    }
    setOpen(false)
    window.setTimeout(() => setFlash(null), 2200)
  }

  return (
    <div className="relative flex items-center gap-1.5 mr-1" ref={rootRef}>
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
        onClick={() => pick('battlefield')}
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
          <div
            className="absolute right-0 top-full mt-1 bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-xl py-1 z-[200] max-h-[min(70vh,420px)] overflow-y-auto min-w-[210px]"
            role="menu"
          >
            <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider text-[#5e6673] border-b border-[#1e2329]">
              Tutti i pannelli · {allKinds.length}
            </div>
            {allKinds.map((k) => {
              const openCount = widgets.filter((w) => w.kind === k).length
              return (
                <button
                  key={k}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 text-left text-[12px] px-3 py-2 text-[#eaecef] hover:bg-[#1e2329] hover:text-[#f0b90b] cursor-pointer active:bg-[#2b3139]"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    pick(k)
                  }}
                >
                  <span className="flex-1 truncate">{labelFor(k)}</span>
                  {openCount > 0 ? (
                    <span className="text-[9px] text-[#848e9c] tabular-nums">{openCount} open</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
      </div>
      {flash && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[300] px-3 py-1.5 rounded-md border border-[#f0b90b]/40 bg-[#12161c] text-[12px] text-[#f0b90b] shadow-xl pointer-events-none">
          {flash}
        </div>
      )}
    </div>
  )
}
