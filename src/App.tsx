import { useEffect, useState, useRef } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { useUiDensityStore } from '@/stores/uiDensityStore'
import { PanelGrid } from '@/layout/PanelGrid'
import { ExecutionBar, useExecutionHotkeys } from '@/trading'
import { SYMBOL_PRESETS, ALL_INTERVALS } from '@/data/symbols'
import type { Interval } from '@/types'
import { WorkspaceMenu, loadWorkspace, applyWorkspace } from '@/workspace'
import { ArchiveMenu } from '@/ui/ArchiveMenu'
import { FeedHealthHud } from '@/ui/FeedHealthHud'
import { useGlobalHotkeys, HotkeyHelpOverlay } from '@/ui/hotkeyMap'
import { startAlertEngine } from '@/alerts'
import { SymbolBadge } from '@/ui/SymbolBadge'
import { formatSymbolOption } from '@/data/symbolMeta'
import { LoginScreen, useAuthStore } from '@/auth'
import { usePaperWalletSync } from '@/trading/paper'
import { OnboardingTour } from '@/ui/OnboardingTour'
import { OnboardingChecklist } from '@/ui/OnboardingChecklist'
import { MobileBanner } from '@/ui/MobileBanner'
import { PerfGuard } from '@/ui/PerfGuard'
import { LocaleSwitcher } from '@/ui/LocaleSwitcher'
import { ErrorBoundary } from '@/ui/ErrorBoundary'
import { FEATURES } from '@/lib/features'
import { useSessionModeStore } from '@/stores/sessionModeStore'
import { useCloudLayoutSync } from '@/workspace/useCloudLayoutSync'
import { useMobileLayout } from '@/layout/useMobileLayout'
import { BrandLogo, SplashLoader, BootSequence, BRAND } from '@/brand'
import { usePlanStore } from '@/billing/planStore'
import { DeskAddControls } from '@/ui/DeskAddControls'

function StatusBadge() {
  const status = useMarketStore((s) => s.status)
  const colors: Record<string, string> = {
    connecting: 'bg-terminal-yellow/20 text-terminal-yellow',
    reconnecting: 'bg-terminal-yellow/20 text-terminal-yellow',
    connected: 'bg-terminal-green/20 text-terminal-green',
    disconnected: 'bg-terminal-muted/20 text-terminal-muted',
    error: 'bg-terminal-red/20 text-terminal-red',
  }
  return (
    <span className={`text-xxs px-1.5 py-0.5 rounded ${colors[status] ?? ''}`}>
      {status}
    </span>
  )
}

function normalizeSymbol(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function Controls() {
  const setSymbol = useMarketStore((s) => s.setSymbol)
  const setInterval = useMarketStore((s) => s.setInterval)
  const marketSymbol = useMarketStore((s) => s.symbol)
  const marketInterval = useMarketStore((s) => s.interval)
  const panels = useLayoutStore((s) => s.panels)
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const updatePanel = useLayoutStore((s) => s.updatePanel)
  const primary = panels.find((p) => p.id === primaryPanelId) ?? panels[0]
  const symbol = primary?.symbol ?? marketSymbol
  const interval = primary?.interval ?? marketInterval
  const [symbolDraft, setSymbolDraft] = useState(symbol)
  useEffect(() => {
    setSymbolDraft(symbol)
  }, [symbol])
  const commitSymbol = () => {
    const v = normalizeSymbol(symbolDraft)
    if (!v || v.length < 4) {
      setSymbolDraft(symbol)
      return
    }
    setSymbol(v)
    updatePanel(primaryPanelId, { symbol: v })
  }
  const onInterval = (v: Interval) => {
    setInterval(v)
    updatePanel(primaryPanelId, { interval: v })
  }
  return (
    <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 border-b border-terminal-border bg-[#0b0e11]">
      <SymbolBadge symbol={symbol} size="sm" />
      <input
        className="bg-[#12161c] border border-[#2b3139] rounded px-2 py-1 text-xs w-28 font-mono text-[#eaecef]"
        value={symbolDraft}
        onChange={(e) => setSymbolDraft(normalizeSymbol(e.target.value))}
        onBlur={commitSymbol}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitSymbol()
        }}
        list="global-symbols"
      />
      <datalist id="global-symbols">
        {SYMBOL_PRESETS.map((pr) => (
          <option key={pr.symbol} value={pr.symbol}>
            {formatSymbolOption(pr.symbol)}
          </option>
        ))}
      </datalist>
      <select
        className="bg-[#12161c] border border-[#2b3139] rounded px-2 py-1 text-xs text-[#eaecef]"
        value={interval}
        onChange={(e) => onInterval(e.target.value as Interval)}
      >
        {ALL_INTERVALS.map((iv) => (
          <option key={iv} value={iv}>
            {iv}
          </option>
        ))}
      </select>
      <StatusBadge />
    </div>
  )
}

function ChartArea() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 1200, height: 600 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="flex-1 min-h-0 min-w-0 relative overflow-auto">
      <PanelGrid width={size.width} />
    </div>
  )
}

function TerminalApp() {
  usePaperWalletSync()
  useCloudLayoutSync()
  const mobile = useMobileLayout()
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)
  const density = useUiDensityStore((s) => s.mode)
  const toggleDensity = useUiDensityStore((s) => s.toggle)
  const { helpOpen, setHelpOpen } = useGlobalHotkeys()
  useExecutionHotkeys()
  useEffect(() => {
    startAlertEngine()
  }, [])
  useEffect(() => {
    void loadWorkspace()
      .then((res) => {
        if (res.ok) applyWorkspace(res.doc)
      })
      .finally(() => {
        loadHistorical().then(() => startLive())
      })
  }, [])
  return (
    <div className={`nacs-desk h-full flex flex-col pb-7 ${mobile ? 'tt-mobile-shell' : ''}`}>
      <header className="nacs-app-header flex items-stretch justify-between gap-3 pr-3 density-compact min-h-[56px]">
        <div className="nacs-header-brand flex items-center pl-1 pr-2 self-stretch">
          <BrandLogo size="sm" showWordmark={false} fullLogo />
        </div>
        <div className="flex items-center gap-2 sm:gap-3 py-2 ml-auto">
          <LocaleSwitcher />
          <button
            type="button"
            className="text-xxs px-2 py-0.5 rounded border border-terminal-border text-terminal-muted"
            onClick={toggleDensity}
          >
            {density === 'scalp' ? 'SCALP' : 'RESEARCH'}
          </button>
          <button
            type="button"
            className="text-xxs px-2 py-0.5 rounded border border-terminal-border text-terminal-muted"
            onClick={() => setHelpOpen(true)}
          >
            ?
          </button>
          <DeskAddControls />
          <ArchiveMenu />
          <WorkspaceMenu />
          <AuthControls />
          <span className="hidden sm:inline text-xxs text-terminal-muted">
            Desk · {BRAND.versionLabel}
          </span>
        </div>
      </header>
      <MobileBanner />
      <Controls />
      <div className="density-chrome" data-tour="execution-bar">
        <ExecutionBar />
      </div>
      <div
        className="flex-1 bg-transparent overflow-auto min-h-0 flex flex-col"
        data-tour="chart-area"
      >
        <ChartArea />
      </div>
      <FeedHealthHud />
      <HotkeyHelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
      <OnboardingTour />
      <OnboardingChecklist />
      <PerfGuard />
    </div>
  )
}

function GuestEntry() {
  const setMode = useSessionModeStore((s) => s.setMode)
  const [entered, setEntered] = useState(false)
  const [tab, setTab] = useState<'login' | 'guest'>('login')
  useEffect(() => {
    if (entered) setMode('guest-readonly')
  }, [entered, setMode])
  if (entered) {
    return (
      <ErrorBoundary name="terminal-guest">
        <TerminalApp />
      </ErrorBoundary>
    )
  }
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-[#eaecef] px-4 py-6 relative overflow-hidden bg-[#05070a]">
      <div className="relative z-10 w-full max-w-md flex flex-col gap-3">
        <div className="flex rounded-lg border border-[#2b3139] overflow-hidden bg-[#0b0e11]">
          <button
            type="button"
            className={`flex-1 py-2.5 text-[12px] font-semibold ${
              tab === 'login' ? 'bg-[#f0b90b] text-[#0b0e11]' : 'text-[#848e9c] hover:text-[#eaecef]'
            }`}
            onClick={() => setTab('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`flex-1 py-2.5 text-[12px] font-semibold ${
              tab === 'guest' ? 'bg-[#f0b90b] text-[#0b0e11]' : 'text-[#848e9c] hover:text-[#eaecef]'
            }`}
            onClick={() => setTab('guest')}
          >
            Guest
          </button>
        </div>
        {tab === 'login' ? (
          <LoginScreen embedded />
        ) : (
          <div className="nacs-guest-card rounded-2xl px-6 sm:px-8 py-7 flex flex-col items-center gap-5 border border-[#2b3139] bg-[#0b0e11]/90">
            <BrandLogo size="lg" layout="stack" fullLogo showWordmark />
            <p className="text-[12px] text-[#848e9c] text-center">
              Continue as guest for a read-only desk. Login anytime from the header.
            </p>
            <button
              type="button"
              className="w-full px-4 py-3 rounded-lg bg-[#f0b90b] text-[#0b0e11] font-semibold"
              onClick={() => setEntered(true)}
            >
              Enter desk (guest)
            </button>
            <button
              type="button"
              className="text-[12px] text-[#f0b90b] hover:underline"
              onClick={() => setTab('login')}
            >
              ← Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Header account control – login / user / logout */
function AuthControls() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [open, setOpen] = useState(false)

  if (status === 'authenticated' && user) {
    return (
      <div className="relative">
        <button
          type="button"
          className="text-[11px] px-2.5 py-1 rounded border border-[#2b3139] bg-[#12161c] text-[#eaecef] hover:border-[#f0b90b]/50 max-w-[140px] truncate"
          onClick={() => setOpen((v) => !v)}
          title={user.email}
        >
          {user.email.split('@')[0]}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-[70] min-w-[160px] rounded-md border border-[#2b3139] bg-[#0b0e11] shadow-xl py-1">
              <div className="px-3 py-1.5 text-[10px] text-[#5e6673] border-b border-[#1e2329] truncate">
                {user.email}
              </div>
              <button
                type="button"
                className="block w-full text-left text-[12px] px-3 py-2 text-[#f6465d] hover:bg-[#1e2329]"
                onClick={() => {
                  setOpen(false)
                  void logout()
                }}
              >
                Logout
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      className="text-[11px] px-2.5 py-1 rounded border border-[#f0b90b]/50 bg-[#f0b90b]/10 text-[#f0b90b] hover:bg-[#f0b90b]/20 font-medium"
      onClick={() => {
        try {
          sessionStorage.removeItem('nacs-boot-done')
        } catch {
          /* */
        }
        window.location.reload()
      }}
      title="Apri schermata login"
    >
      Login
    </button>
  )
}

export default function App() {
  const status = useAuthStore((s) => s.status)
  const refreshMe = useAuthStore((s) => s.refreshMe)
  const planId = usePlanStore((s) => s.planId)
  const [bootDone, setBootDone] = useState(() => {
    try {
      return sessionStorage.getItem('nacs-boot-done') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    void refreshMe()
  }, [refreshMe])
  if (!bootDone) {
    return (
      <BootSequence
        planId={planId}
        sessionMode={
          status === 'authenticated'
            ? 'authenticated'
            : status === 'unknown'
              ? 'checking'
              : 'guest'
        }
        onComplete={() => {
          try {
            sessionStorage.setItem('nacs-boot-done', '1')
          } catch {
            /* */
          }
          setBootDone(true)
        }}
      />
    )
  }
  if (status === 'unknown') return <SplashLoader label="Checking secure session…" />
  if (status !== 'authenticated') {
    if (FEATURES.allowGuest) {
      return (
        <ErrorBoundary name="terminal-guest">
          <GuestEntry />
        </ErrorBoundary>
      )
    }
    return (
      <ErrorBoundary name="auth">
        <LoginScreen />
      </ErrorBoundary>
    )
  }
  return (
    <ErrorBoundary name="terminal">
      <TerminalApp />
    </ErrorBoundary>
  )
}
