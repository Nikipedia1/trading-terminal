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
  'draw',
  'cycles',
  'livekeys',
  'plugins',
  'ops',
  'admin',
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
            <div
              style={{
                padding: '6px 10px 8px',
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#848e9c',
              }}
            >
              Add panel
            </div>
            {allKinds.map((k) => {
              const openCount = openCounts.get(k) ?? 0
              return (
                <button
                  key={k}
                  type="button"
                  role="menuitem"
                  className="nacs-panel-menu-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    color: '#eaecef',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    pick(k)
                  }}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {labelFor(k)}
                  </span>
                  {openCount > 0 ? (
                    <span style={{ fontSize: 10, color: '#848e9c' }}>{openCount} open</span>
                  ) : null}
                </button>
              )
            })}
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative flex items-center gap-1.5 mr-1">
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
      <button
        type="button"
        className="text-[11px] px-2.5 py-1 rounded border border-[#0ecb81]/40 bg-[#0ecb81]/10 text-[#0ecb81] hover:border-[#0ecb81] hover:bg-[#0ecb81]/20 font-medium"
        title="Order Block market X-ray"
        onClick={() => pick('orderblock')}
      >
        ▣ Order Block
      </button>
      <button
        ref={btnRef}
        type="button"
        className="text-[11px] px-2.5 py-1 rounded border border-[#2b3139] bg-[#12161c] text-[#eaecef] hover:border-[#f0b90b]/50 hover:text-[#f0b90b] font-medium"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        + Panel
      </button>
      {menu}
      {flash &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              bottom: 64,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 100000,
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid rgba(240,185,11,0.4)',
              background: '#12161c',
              color: '#f0b90b',
              fontSize: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
            }}
          >
            {flash}
          </div>,
          document.body,
        )}
      <style>{`
        .nacs-panel-menu-item:hover {
          background: #1e2329 !important;
          color: #f0b90b !important;
        }
        .nacs-panel-menu-item:active {
          background: #2b3139 !important;
        }
      `}</style>
    </div>
  )
}
