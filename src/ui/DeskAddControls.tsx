import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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

  const updatePos = () => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const width = 240
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8))
    const top = Math.min(r.bottom + 6, window.innerHeight - 120)
    setPos({ top, left, width })
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePos()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onResize = () => updatePos()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (menuRef.current?.contains(t)) return
      if (btnRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onDoc)
      document.addEventListener('touchstart', onDoc)
    }, 0)
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(id)
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
    setFlash(after > before ? `Aperto: ${title}` : `Non aggiunto: ${title}`)
    setOpen(false)
    window.setTimeout(() => setFlash(null), 2200)
  }

  const menuMaxH = Math.max(
    180,
    Math.min(420, (typeof window !== 'undefined' ? window.innerHeight : 600) - (pos?.top ?? 80) - 16),
  )

  const menu =
    open && pos
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="nacs-panel-menu"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: menuMaxH,
              zIndex: 99999,
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
              background: '#0b0e11',
              border: '1px solid #2b3139',
              borderRadius: 8,
              boxShadow: '0 16px 48px rgba(0,0,0,0.65)',
              padding: '4px 0',
              pointerEvents: 'auto',
            }}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 1,
                padding: '8px 12px',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#5e6673',
                background: '#0b0e11',
                borderBottom: '1px solid #1e2329',
              }}
            >
              Tutti i pannelli · {allKinds.length}
            </div>
            {allKinds.map((k) => {
              const openCount = widgets.filter((w) => w.kind === k).length
              return (
                <button
                  key={k}
                  type="button"
                  role="menuitem"
                  className="nacs-panel-menu-item"
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    gap: 8,
                    textAlign: 'left',
                    fontSize: 13,
                    padding: '10px 12px',
                    color: '#eaecef',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
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
