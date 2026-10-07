import { useMemo, useState } from 'react'
import { useLayoutStore, WIDGET_META } from '@/stores/layoutStore'
import type { WidgetKind } from '@/types'

/** Preferred order in the menu (rest follows alphabetically by title). */
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
  const [open, setOpen] = useState(false)

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

  const pick = (kind: WidgetKind) => {
    addWidget(kind)
    setOpen(false)
  }

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
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} aria-hidden />
            <div
              className="absolute right-0 top-full mt-1 bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-xl py-1 z-[80] max-h-[min(70vh,420px)] overflow-y-auto min-w-[200px]"
              role="menu"
            >
              <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-[#5e6673]">
                All panels
              </div>
              {allKinds.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="menuitem"
                  className="block w-full text-left text-[12px] px-3 py-1.5 text-[#eaecef] hover:bg-[#1e2329] hover:text-[#f0b90b] rounded-none cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    pick(k)
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {labelFor(k)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
