/**
 * Lightweight onboarding tour – no external deps.
 * Persists completion in localStorage (tt-onboarding:v1).
 */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'tt-onboarding:v1'

export interface TourStep {
  id: string
  title: string
  body: string
  target?: string
}

const DEFAULT_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to the terminal',
    body: 'Desk-style layout: drag panels, resize, and save workspaces. Paper trading only unless you wire live keys yourself.',
  },
  {
    id: 'chart',
    title: 'Chart & symbol',
    body: 'Use the header controls to pick symbol and interval, then Start live for real market data. Primary chart is the default panel.',
    target: '[data-tour="chart-area"]',
  },
  {
    id: 'panels',
    title: 'Widgets',
    body: 'Add Order Book, Paper, Bots, Wallet, Watchlist and more from the layout menu. Every panel is removable and repositionable.',
    target: '[data-tour="add-panel"]',
  },
  {
    id: 'paper',
    title: 'Paper & risk',
    body: 'Paper fills use live marks. Bots respect risk limits (daily loss, exposure, stop). Export fills/equity when ready.',
    target: '[data-tour="execution-bar"]',
  },
  {
    id: 'auth',
    title: 'Session & cloud',
    body: 'Login uses HttpOnly cookies. Cloud workspace needs Cloudflare Pages + KV (not Vite alone). See docs/AUTH.md.',
  },
]

function loadDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'done'
  } catch {
    return false
  }
}

function saveDone() {
  try {
    localStorage.setItem(STORAGE_KEY, 'done')
  } catch {
    /* */
  }
}

interface OnboardingTourProps {
  steps?: TourStep[]
  forceOpen?: boolean
  onClose?: () => void
}

export function OnboardingTour({
  steps = DEFAULT_STEPS,
  forceOpen = false,
  onClose,
}: OnboardingTourProps) {
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (forceOpen) {
      setOpen(true)
      setIdx(0)
      return
    }
    if (!loadDone()) setOpen(true)
  }, [forceOpen])

  const close = useCallback(() => {
    saveDone()
    setOpen(false)
    onClose?.()
  }, [onClose])

  const next = () => {
    if (idx >= steps.length - 1) close()
    else setIdx((i) => i + 1)
  }

  const back = () => setIdx((i) => Math.max(0, i - 1))

  if (!open || !steps.length) return null
  const step = steps[idx]!

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <div className="w-full max-w-md rounded-lg border border-[#2b3139] bg-[#0b0e11] shadow-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-[#5e6673] uppercase tracking-wide">
            Tour {idx + 1}/{steps.length}
          </span>
          <button
            type="button"
            className="text-[11px] text-[#848e9c] hover:text-[#eaecef]"
            onClick={close}
          >
            Skip
          </button>
        </div>
        <h2 id="tour-title" className="text-sm font-semibold text-[#eaecef] mb-1">
          {step.title}
        </h2>
        <p className="text-[12px] text-[#848e9c] leading-relaxed mb-4">{step.body}</p>
        <div className="flex justify-between gap-2">
          <button
            type="button"
            disabled={idx === 0}
            onClick={back}
            className="text-[11px] px-3 py-1.5 rounded border border-[#2b3139] text-[#848e9c] disabled:opacity-40 hover:text-[#eaecef]"
          >
            Back
          </button>
          <button
            type="button"
            onClick={next}
            className="text-[11px] px-3 py-1.5 rounded bg-[#f0b90b] text-[#0b0e11] font-medium hover:bg-[#fcd535]"
          >
            {idx >= steps.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function resetOnboardingTour() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* */
  }
}
