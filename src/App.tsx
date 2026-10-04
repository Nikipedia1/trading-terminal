import { useEffect, useRef, useState, useMemo } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { useUiDensityStore } from '@/stores/uiDensityStore'
import { PanelGrid } from '@/layout/PanelGrid'
import { ExecutionBar, useExecutionHotkeys } from '@/trading'
import { SYMBOL_PRESETS, ALL_INTERVALS } from '@/data/symbols'
import type { Interval, ExchangeId } from '@/types'
import { WorkspaceMenu, loadWorkspace, applyWorkspace } from '@/workspace'
import { ArchiveMenu } from '@/ui/ArchiveMenu'
import { FeedHealthHud } from '@/ui/FeedHealthHud'
import { useGlobalHotkeys, HotkeyHelpOverlay } from '@/ui/hotkeyMap'
import { startAlertEngine } from '@/alerts'
import { ChartPanel } from '@/charts/ChartPanel'
import { EXCHANGE_LABELS } from '@/data/exchanges/registry'
import { SymbolBadge } from '@/ui/SymbolBadge'
import { formatSymbolOption } from '@/data/symbolMeta'
import { LoginScreen, useAuthStore } from '@/auth'
import { readDetachConfig } from '@/layout/detachPanel'
import { usePaperWalletSync } from '@/trading/paper'
import { OnboardingTour, resetOnboardingTour } from '@/ui/OnboardingTour'
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

function ErrorBanner() {
  const lastError = useMarketStore((s) => s.lastError)
  const clearError = useMarketStore((s) => s.clearError)
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)
  if (!lastError) return null
  return (
    <div className="bg-terminal-red/10 border border-terminal-red/40 text-terminal-red px-4 py-2 text-sm flex justify-between items-center density-chrome gap-2 flex-wrap">
      <span>
        <strong>[{lastError.code}]</strong> {lastError.message}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            clearError()
            void loadHistorical().then(() => startLive())
          }}
          className="px-2 py-0.5 rounded bg-[#f0b90b] text-[#0b0e11] text-xs font-semibold hover:bg-[#fcd535]"
        >
          Retry
        </button>
        <button type="button" onClick={clearError} className="text-xs underline hover:no-underline">
          Dismiss
        </button>
      </div>
    </div>
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
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-terminal-border bg-terminal-panel density-compact">
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
        className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm max-w-[11rem]"
        value={SYMBOL_PRESETS.some((p) => p.symbol === symbol) ? symbol : ''}
        onChange={(e) => {
          if (e.target.value) applySymbol(e.target.value)
        }}
      >
        <option value="">Pairs…</option>
        {(['Major', 'L1', 'DeFi', 'Meme', 'Other'] as const).map((g) => (
          <optgroup key={g} label={g}>
            {SYMBOL_PRESETS.filter((p) => p.group === g).map((p) => (
              <option key={p.symbol} value={p.symbol}>
                {formatSymbolOption(p.symbol)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
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
        className="px-3 py-1 bg-terminal-blue/20 text-terminal-blue rounded text-sm hover:bg-terminal-blue/30 density-chrome"
      >
        Load History
      </button>
      {status === 'connected' || status === 'connecting' || status === 'reconnecting' ? (
        <button
          onClick={stopLive}
          className="px-3 py-1 bg-terminal-red/20 text-terminal-red rounded text-sm hover:bg-terminal-red/30"
        >
          Stop Live
        </button>
      ) : (
        <button
          onClick={startLive}
          className="px-3 py-1 bg-terminal-green/20 text-terminal-green rounded text-sm hover:bg-terminal-green/30"
        >
          Start Live
        </button>
      )}
      <StatusBadge />
    </div>
  )
}

function TickerBar() {
  const ticker = useMarketStore((s) => s.ticker)
  if (!ticker) return null
  const up = ticker.priceChangePercent >= 0
  return (
    <div className="flex items-center gap-6 px-4 py-1.5 border-b border-terminal-border text-sm font-mono-nums density-compact">
      <SymbolBadge symbol={ticker.symbol} size="md" />
      <span className={up ? 'text-terminal-green' : 'text-terminal-red'}>
        {ticker.lastPrice.toFixed(2)}
      </span>
      <span className={up ? 'text-terminal-green' : 'text-terminal-red'}>
        {up ? '+' : ''}
        {ticker.priceChangePercent.toFixed(2)}%
      </span>
    </div>
  )
}

function usePrimarySync(enabled: boolean) {
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const panels = useLayoutStore((s) => s.panels)
  const setSymbol = useMarketStore((s) => s.setSymbol)
  const setIntervalStore = useMarketStore((s) => s.setInterval)
  const setExchange = useMarketStore((s) => s.setExchange)
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)
  const stopLive = useMarketStore((s) => s.stopLive)
  const primary = panels.find((p) => p.id === primaryPanelId)
  useEffect(() => {
    if (!enabled || !primary) return
    stopLive()
    setSymbol(primary.symbol)
    setIntervalStore(primary.interval)
    setExchange(primary.exchange)
    loadHistorical().then(() => startLive())
  }, [enabled, primary?.symbol, primary?.interval, primary?.exchange, primaryPanelId])
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
      <PanelGrid width={size.width} height={size.height} />
    </div>
  )
}

function useDetachParams() {
  return useMemo(() => {
    const cfg = readDetachConfig()
    if (!cfg) return null
    const symbol = normalizeSymbol(cfg.symbol) || 'BTCUSDT'
    return {
      symbol,
      interval: cfg.interval as Interval,
      exchange: cfg.exchange as ExchangeId,
    }
  }, [])
}

function DetachedApp({
  symbol,
  interval,
  exchange,
}: {
  symbol: string
  interval: Interval
  exchange: ExchangeId
}) {
  const setSymbol = useMarketStore((s) => s.setSymbol)
  const setIntervalStore = useMarketStore((s) => s.setInterval)
  const setExchange = useMarketStore((s) => s.setExchange)
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)
  useEffect(() => {
    setSymbol(symbol)
    setIntervalStore(interval)
    setExchange(exchange)
    void loadHistorical().then(() => startLive())
  }, [symbol, interval, exchange])
  const config = useMemo(
    () => ({
      id: 'detached',
      symbol,
      interval,
      exchange,
      syncGroup: null as string | null,
    }),
    [symbol, interval, exchange]
  )
  return (
    <div className="h-full flex flex-col bg-terminal-bg">
      <header className="nacs-app-header flex items-center gap-3 px-3 py-1.5 shrink-0">
        <BrandLogo size="sm" showWordmark={false} />
        <span className="text-xxs font-semibold tracking-wide text-[#f0b90b]">DETACHED</span>
        <SymbolBadge symbol={symbol} size="sm" showName={false} />
        <span className="text-xs font-mono-nums text-terminal-text">
          {interval} · {EXCHANGE_LABELS[exchange] ?? exchange}
        </span>
        <StatusBadge />
      </header>
      <div className="flex-1 min-h-0">
        <ChartPanel config={config} />
      </div>
    </div>
  )
}

function TerminalApp() {
  usePaperWalletSync()
  useCloudLayoutSync()
  const mobile = useMobileLayout()
  const detach = useDetachParams()
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
    if (detach) return
    void loadWorkspace()
      .then((res) => {
        if (res.ok) applyWorkspace(res.doc)
      })
      .finally(() => {
        loadHistorical().then(() => startLive())
      })
  }, [detach])
  usePrimarySync(!detach)
  if (detach) {
    return (
      <DetachedApp symbol={detach.symbol} interval={detach.interval} exchange={detach.exchange} />
    )
  }
  return (
    <div className={`h-full flex flex-col pb-7 ${mobile ? 'tt-mobile-shell' : ''}`}>
      <header className="nacs-app-header flex items-center justify-between px-4 py-2 density-compact">
        <div className="nacs-header-brand">
          <BrandLogo size="sm" />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher />
          <a href="/help/" className="text-xxs text-terminal-muted hover:text-[#f0b90b] hidden sm:inline" target="_blank" rel="noreferrer">Help</a>
          <a href="/pricing/" className="text-xxs text-terminal-muted hover:text-[#f0b90b] hidden md:inline" target="_blank" rel="noreferrer">Plans</a>
          <a href="/support/" className="text-xxs text-terminal-muted hover:text-[#f0b90b] hidden md:inline" target="_blank" rel="noreferrer">Support</a>
          <a href="/status/" className="text-xxs text-terminal-muted hover:text-[#f0b90b] hidden lg:inline" target="_blank" rel="noreferrer">Status</a>
          <a href="/roadmap/" className="text-xxs text-terminal-muted hover:text-[#f0b90b] hidden lg:inline" target="_blank" rel="noreferrer">Roadmap</a>
          <button type="button" className="text-xxs px-2 py-0.5 rounded border border-terminal-border text-terminal-muted hover:text-[#f0b90b] hover:border-[#f0b90b]/40 transition-colors" title="Toggle density (D)" onClick={toggleDensity}>
            {density === 'scalp' ? 'SCALP' : 'RESEARCH'}
          </button>
          <button type="button" className="text-xxs px-2 py-0.5 rounded border border-terminal-border text-terminal-muted hover:text-[#eaecef] density-chrome transition-colors" title="Hotkey map (?)" onClick={() => setHelpOpen(true)}>?</button>
          <button type="button" className="text-xxs px-2 py-0.5 rounded border border-terminal-border text-terminal-muted hover:text-[#eaecef] density-chrome transition-colors" title="Replay onboarding tour" onClick={() => { resetOnboardingTour(); window.location.reload() }}>Tour</button>
          <ArchiveMenu />
          <WorkspaceMenu />
          <UserMenu />
          <span className="hidden sm:inline text-xxs text-terminal-muted density-chrome">Desk · {BRAND.versionLabel}</span>
        </div>
      </header>
      <MobileBanner />
      <ErrorBanner />
      <Controls />
      <TickerBar />
      <div className="density-chrome" data-tour="execution-bar"><ExecutionBar /></div>
      <div className="flex-1 bg-terminal-bg overflow-auto min-h-0 flex flex-col" data-tour="chart-area"><ChartArea /></div>
      <FeedHealthHud />
      <HotkeyHelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
      <OnboardingTour />
      <OnboardingChecklist />
      <PerfGuard />
    </div>
  )
}

function UserMenu() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  if (!user) return null
  return (
    <div className="flex items-center gap-2 text-xxs text-terminal-muted">
      <span className="truncate max-w-[9rem]" title={user.email}>
        {user.email}
        {user.role === 'admin' ? ' · admin' : ''}
      </span>
      <button type="button" onClick={() => void logout()} className="px-1.5 py-0.5 rounded border border-terminal-border hover:text-[#eaecef]">
        Logout
      </button>
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
          backgroundImage: `url(${BRAND.splashHeroUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 55% 50% at 50% 45%, rgba(5,8,14,0.12) 0%, rgba(5,8,14,0.5) 65%, rgba(5,8,14,0.78) 100%)',
          }}
          aria-hidden
        />
        <div className="relative z-10 nacs-guest-card rounded-2xl px-6 sm:px-8 py-7 max-w-md w-full max-h-[min(92vh,820px)] overflow-y-auto flex flex-col items-center gap-5 bg-[#0b0e11]/80 border border-[#2b3139]/90 backdrop-blur-md shadow-[0_24px_64px_rgba(0,0,0,0.55)]">
          <BrandLogo size="xl" layout="stack" fullLogo showWordmark />
          <div className="nacs-loader-stage" style={{ width: 88, height: 88 }} aria-hidden>
            <div className="nacs-orbit">
              <div className="nacs-orbit-ring" />
              <div className="nacs-orbit-ring nacs-orbit-ring--2" />
              <div className="nacs-cube">
                <div className="nacs-cube-face nacs-cube-face--front" />
                <div className="nacs-cube-face nacs-cube-face--back" />
                <div className="nacs-cube-face nacs-cube-face--right" />
                <div className="nacs-cube-face nacs-cube-face--left" />
                <div className="nacs-cube-face nacs-cube-face--top" />
                <div className="nacs-cube-face nacs-cube-face--bottom" />
              </div>
              <div className="nacs-orbit-dot" />
            </div>
          </div>
          <p className="text-[12px] text-[#848e9c] text-center leading-relaxed">
            Continue as guest for a read-only desk (charts & public data).
            Trading, bots, and live keys stay disabled until you sign in.
          </p>
          <button
            type="button"
            className="w-full px-4 py-3 rounded-lg bg-[#f0b90b] text-[#0b0e11] text-sm font-bold tracking-wide hover:bg-[#f5c93a] active:scale-[0.99] transition-all shadow-[0_0_24px_rgba(240,185,11,0.28)]"
            onClick={() => setEntered(true)}
          >
            Enter as guest
          </button>
          <div className="w-full border-t border-[#1e2329] pt-5 mt-1">
            <LoginScreen embedded hideLogo />
          </div>
        </div>
      </div>
    )
  }
  return <TerminalApp />
}

export default function App() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const refreshMe = useAuthStore((s) => s.refreshMe)
  const setMode = useSessionModeStore((s) => s.setMode)
  const planId = usePlanStore((s) => s.planId)
  const [bootDone, setBootDone] = useState(() => {
    try {
      return sessionStorage.getItem('nacs-boot-v1') === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  useEffect(() => {
    if (status === 'authenticated') setMode('full')
  }, [status, setMode])

  const finishBoot = () => {
    try {
      sessionStorage.setItem('nacs-boot-v1', '1')
    } catch {
      /* private mode */
    }
    setBootDone(true)
  }

  if (!bootDone) {
    const sessionMode =
      status === 'authenticated'
        ? 'authenticated'
        : status === 'unknown'
          ? 'checking'
          : 'guest'
    return (
      <BootSequence
        onComplete={finishBoot}
        userEmail={user?.email}
        userRole={user?.role}
        planId={planId}
        sessionMode={sessionMode}
      />
    )
  }

  if (status === 'unknown') {
    return <SplashLoader label="Checking secure session…" />
  }
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
