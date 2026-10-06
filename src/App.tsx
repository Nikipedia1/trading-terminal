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
    <span className={`px-2 py-0.5 rounded text-xxs font-medium ${colors[status] || ''}`}>
      {status.toUpperCase()}
    </span>
  )
}

function normalizeSymbol(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function Controls() {
  const marketSymbol = useMarketStore((s) => s.symbol)
  const marketInterval = useMarketStore((s) => s.interval)
  const setSymbol = useMarketStore((s) => s.setSymbol)
  const setIntervalStore = useMarketStore((s) => s.setInterval)
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)
  const stopLive = useMarketStore((s) => s.stopLive)
  const status = useMarketStore((s) => s.status)
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const panels = useLayoutStore((s) => s.panels)
  const updatePanel = useLayoutStore((s) => s.updatePanel)
  const primary = panels.find((p) => p.id === primaryPanelId) ?? panels[0]
  const symbol = primary?.symbol ?? marketSymbol
  const interval = primary?.interval ?? marketInterval
  const [symbolDraft, setSymbolDraft] = useState(symbol)
  useEffect(() => {
    setSymbolDraft(symbol)
  }, [symbol])
  const applySymbol = (raw: string) => {
    const v = normalizeSymbol(raw)
    if (!v || v === symbol) {
      setSymbolDraft(symbol)
      return
    }
    setSymbol(v)
    updatePanel(primaryPanelId, { symbol: v })
  }
  const applyInterval = (v: Interval) => {
    if (v === interval) return
    setIntervalStore(v)
    updatePanel(primaryPanelId, { interval: v })
  }
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-terminal-border bg-terminal-panel/95 density-compact">
      <SymbolBadge symbol={symbolDraft || symbol} size="sm" className="shrink-0" />
      <input
        className="bg-terminal-bg border border-[#f0b90b]/40 rounded px-2 py-1 text-sm w-32 font-mono-nums font-semibold text-[#eaecef]"
        value={symbolDraft}
        list="top-symbol-presets"
        placeholder="BTCUSDT"
        onChange={(e) => setSymbolDraft(normalizeSymbol(e.target.value))}
        onBlur={() => applySymbol(symbolDraft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      <datalist id="top-symbol-presets">
        {SYMBOL_PRESETS.map((p) => (
          <option key={p.symbol} value={p.symbol}>
            {formatSymbolOption(p.symbol)} · {p.group}
          </option>
        ))}
      </datalist>
      <select
        className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm"
        value={interval}
        onChange={(e) => applyInterval(e.target.value as Interval)}
      >
        {ALL_INTERVALS.map((i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>
      <button
        onClick={() => loadHistorical()}
        className="px-3 py-1 bg-terminal-blue/20 text-terminal-blue rounded text-sm"
      >
        Load History
      </button>
      {status === 'connected' || status === 'connecting' || status === 'reconnecting' ? (
        <button
          onClick={stopLive}
          className="px-3 py-1 bg-terminal-red/20 text-terminal-red rounded text-sm"
        >
          Stop Live
        </button>
      ) : (
        <button
          onClick={startLive}
          className="px-3 py-1 bg-terminal-green/20 text-terminal-green rounded text-sm"
        >
          Start Live
        </button>
      )}
      <StatusBadge />
    </div>
  )
}

function ChartArea() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ width, height })
    })
    ro.observe(ref.current)
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
  useEffect(() => {
    if (entered) setMode('guest-readonly')
  }, [entered, setMode])
  if (!entered) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center text-[#eaecef] px-4 py-6 relative overflow-hidden bg-[#05070a]"
        style={{
          backgroundImage: 'url(' + BRAND.splashHeroUrl + ')',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 nacs-guest-card rounded-2xl px-6 sm:px-8 py-7 max-w-md w-full flex flex-col items-center gap-5">
          <BrandLogo size="xl" layout="stack" fullLogo showWordmark />
          <p className="text-[12px] text-[#848e9c] text-center">
            Continue as guest for a read-only desk.
          </p>
          <button
            type="button"
            className="w-full px-4 py-3 rounded-lg bg-[#f0b90b] text-[#0b0e11] font-semibold"
            onClick={() => setEntered(true)}
          >
            Enter desk
          </button>
        </div>
      </div>
    )
  }
  return (
    <ErrorBoundary name="terminal-guest">
      <TerminalApp />
    </ErrorBoundary>
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
