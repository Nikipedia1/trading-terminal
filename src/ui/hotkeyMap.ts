/**
 * Complete hotkey map – institutional desk (Sierra / Bookmap inspired).
 * Execution hotkeys live in trading/ticket/hotkeys.ts;
 * this module owns chart / layout / density / help bindings.
 */

import { useEffect, useState } from 'react'
import { useUiDensityStore } from '@/stores/uiDensityStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { useDrawingStore } from '@/drawings/drawingStore'
import { detachChartPanel } from '@/layout/detachPanel'

export interface HotkeyDef {
  keys: string
  action: string
  group: 'chart' | 'layout' | 'trade' | 'view' | 'tools'
}

export const HOTKEY_DEFS: HotkeyDef[] = [
  { keys: 'B', action: 'Buy market (paper)', group: 'trade' },
  { keys: 'S', action: 'Sell market (paper)', group: 'trade' },
  { keys: 'Shift+B', action: 'Buy limit @ bid', group: 'trade' },
  { keys: 'Shift+S', action: 'Sell limit @ ask', group: 'trade' },
  { keys: 'Esc', action: 'Cancel all open orders', group: 'trade' },
  { keys: 'D', action: 'Toggle density (research ↔ scalp)', group: 'view' },
  { keys: '?', action: 'Show / hide hotkey map', group: 'view' },
  { keys: 'F', action: 'Fit content (primary chart)', group: 'chart' },
  { keys: 'Space', action: 'Pan tool', group: 'tools' },
  { keys: 'V', action: 'Vertical line tool', group: 'tools' },
  { keys: 'H', action: 'Horizontal line tool', group: 'tools' },
  { keys: 'T', action: 'Trend line tool', group: 'tools' },
  { keys: 'Ctrl+Shift+D', action: 'Detach primary panel', group: 'layout' },
  { keys: '+', action: 'Add chart panel', group: 'layout' },
]

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

/** Global non-execution hotkeys + help overlay state */
export function useGlobalHotkeys() {
  const [helpOpen, setHelpOpen] = useState(false)
  const toggleDensity = useUiDensityStore((s) => s.toggle)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return

      // ? or Shift+/ → help
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setHelpOpen((v) => !v)
        return
      }

      if (e.key === 'Escape' && helpOpen) {
        e.preventDefault()
        setHelpOpen(false)
        return
      }

      // Density toggle
      if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        toggleDensity()
        return
      }

      // Detach primary
      if (e.key.toLowerCase() === 'd' && e.ctrlKey && e.shiftKey) {
        e.preventDefault()
        const { panels, primaryPanelId } = useLayoutStore.getState()
        const p = panels.find((x) => x.id === primaryPanelId) ?? panels[0]
        if (p) detachChartPanel({ symbol: p.symbol, interval: p.interval, exchange: p.exchange })
        return
      }

      // Add panel
      if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        useLayoutStore.getState().addPanel()
        return
      }

      // Drawing tools
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = e.key.toLowerCase()
        const setTool = useDrawingStore.getState().setActiveTool
        if (k === ' ' || e.code === 'Space') {
          e.preventDefault()
          setTool('pan')
        } else if (k === 'v') {
          e.preventDefault()
          setTool('vline')
        } else if (k === 'h') {
          e.preventDefault()
          setTool('hline')
        } else if (k === 't') {
          e.preventDefault()
          setTool('trend')
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [helpOpen, toggleDensity])

  return { helpOpen, setHelpOpen }
}

export function HotkeyHelpOverlay({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null
  const groups = ['trade', 'view', 'chart', 'tools', 'layout'] as const
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#12161c] border border-[#2b3139] rounded-sm shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-2 border-b border-[#2b3139] flex justify-between items-center">
          <span className="text-sm font-semibold text-[#eaecef]">Hotkey map</span>
          <button
            type="button"
            className="text-[#848e9c] hover:text-[#eaecef] text-xs"
            onClick={onClose}
          >
            Esc
          </button>
        </div>
        <div className="p-3 space-y-3 text-[11px]">
          {groups.map((g) => {
            const items = HOTKEY_DEFS.filter((h) => h.group === g)
            if (!items.length) return null
            return (
              <div key={g}>
                <div className="text-[#f0b90b] uppercase tracking-wider text-[10px] mb-1">
                  {g}
                </div>
                <table className="w-full font-mono-nums">
                  <tbody>
                    {items.map((h) => (
                      <tr key={h.keys} className="border-t border-[#1e2329]/50">
                        <td className="py-0.5 pr-3 text-[#eaecef] whitespace-nowrap">{h.keys}</td>
                        <td className="py-0.5 text-[#848e9c]">{h.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
