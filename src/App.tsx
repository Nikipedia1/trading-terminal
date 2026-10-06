import { useEffect, useRef, useState, useMemo } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { useLayoutStore, WIDGET_META } from '@/stores/layoutStore'
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

// CONTROLS_AND_REST_SEE_FILE
export default function AppBrokenTemp() {
  return <div>Loading restore… open console</div>
}
