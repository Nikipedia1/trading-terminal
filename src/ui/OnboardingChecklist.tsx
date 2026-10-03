/**
 * Post-tour checklist: paper first → live data → risk → workspace → live keys last.
 */

import { useCallback, useEffect, useState } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import { useMarketStore } from '@/stores/marketStore'
import { useLocale } from '@/i18n'

const STORAGE = 'tt-checklist:v1'

interface ChecklistState {
  paper: boolean
  liveData: boolean
  risk: boolean
  workspace: boolean
  exchange: boolean
  dismissed: boolean
}

const DEFAULT: ChecklistState = {
  paper: false,
  liveData: false,
  risk: false,
  workspace: false,
  exchange: false,
  dismissed: false,
}

function load(): ChecklistState {
  try {
    const raw = localStorage.getItem(STORAGE)
    if (!raw) return { ...DEFAULT }
    return { ...DEFAULT, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT }
  }
}

function save(s: ChecklistState) {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(s))
  } catch {
    /* */
  }
}

export function markChecklist(key: keyof Omit<ChecklistState, 'dismissed'>) {
  const s = load()
  s[key] = true
  save(s)
  window.dispatchEvent(new Event('tt-checklist'))
}

export function OnboardingChecklist() {
  const { t } = useLocale()
  const [state, setState] = useState(load)
  const widgets = useLayoutStore((s) => s.widgets)
  const status = useMarketStore((s) => s.status)

  const reload = useCallback(() => setState(load()), [])

  useEffect(() => {
    window.addEventListener('tt-checklist', reload)
    return () => window.removeEventListener('tt-checklist', reload)
  }, [reload])

  // Auto-detect progress
  useEffect(() => {
    const s = load()
    let changed = false
    if (widgets.some((w) => w.kind === 'paper') && !s.paper) {
      s.paper = true
      changed = true
    }
    if (status === 'connected' && !s.liveData) {
      s.liveData = true
      changed = true
    }
    if (widgets.some((w) => w.kind === 'livekeys') && !s.exchange) {
      s.exchange = true
      changed = true
    }
    if (changed) {
      save(s)
      setState({ ...s })
    }
  }, [widgets, status])

  if (state.dismissed) return null

  const items: { key: keyof Omit<ChecklistState, 'dismissed'>; label: string }[] = [
    { key: 'paper', label: t('checklist.paper') },
    { key: 'liveData', label: t('checklist.liveData') },
    { key: 'risk', label: t('checklist.risk') },
    { key: 'workspace', label: t('checklist.workspace') },
    { key: 'exchange', label: t('checklist.exchange') },
  ]

  const done = items.filter((i) => state[i.key]).length
  const allDone = done === items.length

  return (
    <div
      className="fixed bottom-10 right-3 z-[45] w-72 max-w-[calc(100vw-1.5rem)] rounded-lg border border-[#2b3139] bg-[#0b0e11]/95 shadow-xl p-3 text-[11px]"
      role="region"
      aria-label={t('checklist.title')}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-[#f0b90b]">{t('checklist.title')}</span>
        <span className="text-[#5e6673] font-mono-nums">
          {done}/{items.length}
        </span>
      </div>
      <ul className="space-y-1.5 mb-2">
        {items.map((it) => (
          <li key={it.key} className="flex gap-2 items-start">
            <span className={state[it.key] ? 'text-[#0ecb81]' : 'text-[#5e6673]'} aria-hidden>
              {state[it.key] ? '✓' : '○'}
            </span>
            <button
              type="button"
              className={
                'text-left leading-snug ' +
                (state[it.key] ? 'text-[#848e9c] line-through' : 'text-[#eaecef] hover:text-[#f0b90b]')
              }
              onClick={() => {
                if (it.key === 'paper') useLayoutStore.getState().addWidget('paper')
                if (it.key === 'risk') useLayoutStore.getState().addWidget('paper')
                if (it.key === 'exchange') useLayoutStore.getState().addWidget('livekeys')
                if (it.key === 'liveData') {
                  void useMarketStore.getState().loadHistorical()
                  useMarketStore.getState().startLive()
                }
                if (it.key === 'workspace') {
                  markChecklist('workspace')
                  reload()
                }
                if (it.key !== 'workspace') {
                  // mark after interaction for risk
                  if (it.key === 'risk') markChecklist('risk')
                  reload()
                }
              }}
            >
              {it.label}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="text-[10px] text-[#848e9c] hover:text-[#eaecef] underline"
        onClick={() => {
          const s = { ...load(), dismissed: true }
          save(s)
          setState(s)
        }}
      >
        {allDone ? '✓ ' : ''}{t('checklist.dismiss')}
      </button>
    </div>
  )
}
