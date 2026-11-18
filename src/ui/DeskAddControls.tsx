import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLayoutStore, WIDGET_META } from '@/stores/layoutStore'
import type { WidgetKind } from '@/types'

const PRIORITY: WidgetKind[] = [
  'deepprint',
  'volprofile',
  'domladder',
  'footprint',
  'cluster',
  'tpo',
  'gex',
  'cvd',
  'absorption',
  'imbalance',
  'deeptrades',
  'ofi',
  'iceberg',
  'orderflow',
  'book',
  'tape',
  'battlefield',
  'orderblock',
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
  'tradingdesk',
  'opscanner',
  'draw',
  'cycles',
  'livekeys',
  'plugins',
  'ops',
  'admin',
  'plans',
]

const LABELS: Partial<Record<WidgetKind, string>> = {
  deepprint: 'Deep Print',
  volprofile: 'Volume Profile',
  domladder: 'DOM Ladder',
  footprint: 'Footprint',
  cluster: 'Cluster Chart',
  tpo: 'TPO Profile',
  gex: 'Gamma / GEX',
  cvd: 'CVD / Delta',
  absorption: 'Absorption',
  imbalance: 'Stacked Imbalance',
  deeptrades: 'Deep Trades',
  ofi: 'OFI / VPIN',
  iceberg: 'Iceberg',
  orderflow: 'Deep Print',
  draw: '✎ Draw Tools',
  cycles: 'Cycles',
  battlefield: '⚔ Battlefield',
  orderblock: '▣ Order Block',
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
  plans: 'Plans · Telegram',
  tradingdesk: '🏢 Trading Desk',
  opscanner: '📡 Ops Scanner',
}

function labelFor(k: WidgetKind): string {
  return LABELS[k] ?? WIDGET_META[k]?.title ?? k
}

type MenuPos = { top: number; left: number; width: number }

export function DeskAddControls() {
  const addChartPanel = useLayoutStore((s) => s.addChartPanel)
  const addWidget = useLayoutStore((s) => s.addWidget)
  const widgets = useLayoutStore((s) => s.widgets)
  const [open, setOpen] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [pos, setPos] = useState<MenuPos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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

  const openCounts = useMemo(() => {
    const m = new Map<WidgetKind, number>()
    for (const w of widgets) m.set(w.kind, (m.get(w.kind) ?? 0) + 1)
    return m
  }, [widgets])

  useLayoutEffect(() => {
    if (!open || !btnRef.current) {
      setPos(null)
      return
    }
    const r = btnRef.current.getBoundingClientRect()
    const width = Math.min(280, Math.max(220, window.innerWidth - 16))
    let left = r.left
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8
    if (left < 8) left = 8
    setPos({ top: r.bottom + 6, left, width })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (kind: WidgetKind) => {
    addWidget(kind)
    setOpen(false)
    setFlash(`Added ${labelFor(kind)}`)
    window.setTimeout(() => setFlash(null), 1800)
  }

  const menu =
    open && pos
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: 'min(70vh, 420px)',
              overflowY: 'auto',
              zIndex: 100000,
              background: '#0b0e11',
              border: '1px solid #2b3139',
              borderRadius: 10,
              boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
              padding: 6,
            }}
          >
            <p className="px-2 py-1 text-[9px] text-[#5e6673] uppercase tracking-wider">Add panel</p>
            {allKinds.map((k) => {
              const n = openCounts.get(k) ?? 0
              return (
                <button
                  key={k}
                  type="button"
                  role="menuitem"
                  className="w-full text-left px-2 py-1.5 rounded text-[11px] text-[#eaecef] hover:bg-[#1e2329] flex justify-between gap-2"
                  onClick={() => pick(k)}
                >
                  <span>{labelFor(k)}</span>
                  {n > 0 && <span className="text-[9px] text-[#5e6673]">{n}</span>}
                </button>
              )
            })}
          </div>,
          document.body
        )
      : null

  return (
    <div className="flex items-center gap-1.5 relative">
      <button
        ref={btnRef}
        type="button"
        className="px-2 py-1 rounded border border-[#2b3139] text-[10px] text-[#848e9c] hover:text-[#eaecef] hover:border-[#848e9c]"
        onClick={() => setOpen((o) => !o)}
      >
        + Panel
      </button>
      <button
        type="button"
        className="px-2 py-1 rounded border border-[#2b3139] text-[10px] text-[#848e9c] hover:text-[#eaecef]"
        onClick={() => {
          addChartPanel()
          setFlash('Added chart')
          window.setTimeout(() => setFlash(null), 1800)
        }}
      >
        + Chart
      </button>
      {flash && <span className="text-[9px] text-[#0ecb81]">{flash}</span>}
      {menu}
    </div>
  )
}
