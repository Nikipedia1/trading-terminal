/** Alerts config + event log */

import { useEffect, useState } from 'react'
import { useAlertStore } from './engine'
import { ALERT_KIND_LABELS } from './types'
import {
  getWebhookUrl,
  setWebhookUrl,
  ensureDesktopPermission,
} from './notify'

export function AlertPanel() {
  const rules = useAlertStore((s) => s.rules)
  const events = useAlertStore((s) => s.events)
  const setRule = useAlertStore((s) => s.setRule)
  const clearEvents = useAlertStore((s) => s.clearEvents)
  const running = useAlertStore((s) => s.running)
  const start = useAlertStore((s) => s.start)
  const stop = useAlertStore((s) => s.stop)

  const [webhook, setWebhook] = useState(getWebhookUrl())

  useEffect(() => {
    if (!running) start()
  }, [running, start])

  return (
    <div className="flex flex-col h-full min-h-0 text-[11px]">
      <div className="px-2 py-1.5 border-b border-[#1e2329] flex flex-wrap gap-2 items-center shrink-0">
        <span className="font-semibold text-[#eaecef]">Alerts</span>
        <span className={running ? 'text-[#0ecb81]' : 'text-[#848e9c]'}>
          {running ? 'running' : 'stopped'}
        </span>
        <button
          type="button"
          className="px-1.5 py-0.5 rounded border border-[#2b3139] text-[#848e9c]"
          onClick={() => (running ? stop() : start())}
        >
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          type="button"
          className="px-1.5 py-0.5 rounded border border-[#2b3139] text-[#848e9c]"
          onClick={() => void ensureDesktopPermission()}
        >
          Desktop perm
        </button>
      </div>

      <div className="px-2 py-1 border-b border-[#1e2329] space-y-1 shrink-0">
        <div className="text-[#5e6673] text-[10px]">
          Webhook (Discord/Telegram) — stored locally only
        </div>
        <div className="flex gap-1">
          <input
            className="flex-1 bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px]"
            placeholder="https://discord.com/api/webhooks/..."
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
          />
          <button
            type="button"
            className="px-2 py-0.5 bg-[#1e2329] rounded text-[#eaecef]"
            onClick={() => setWebhookUrl(webhook)}
          >
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-2 py-1 text-[10px] text-[#5e6673] uppercase">Rules</div>
        {rules.map((r) => (
          <div
            key={r.id}
            className="px-2 py-1.5 border-b border-[#1e2329]/50 flex flex-wrap gap-2 items-center"
          >
            <input
              type="checkbox"
              className="accent-[#f0b90b]"
              checked={r.enabled}
              onChange={(e) => setRule(r.id, { enabled: e.target.checked })}
            />
            <span className="text-[#eaecef] w-32">{ALERT_KIND_LABELS[r.kind]}</span>
            {r.threshold != null && (
              <input
                type="number"
                className="w-16 bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5"
                value={r.threshold}
                onChange={(e) =>
                  setRule(r.id, { threshold: Number(e.target.value) || 0 })
                }
              />
            )}
            <label className="flex items-center gap-0.5 text-[#848e9c]">
              <input
                type="checkbox"
                checked={r.sound}
                onChange={(e) => setRule(r.id, { sound: e.target.checked })}
              />
              snd
            </label>
            <label className="flex items-center gap-0.5 text-[#848e9c]">
              <input
                type="checkbox"
                checked={r.desktop}
                onChange={(e) => setRule(r.id, { desktop: e.target.checked })}
              />
              desk
            </label>
            <label className="flex items-center gap-0.5 text-[#848e9c]">
              <input
                type="checkbox"
                checked={r.webhook}
                onChange={(e) => setRule(r.id, { webhook: e.target.checked })}
              />
              hook
            </label>
          </div>
        ))}

        <div className="px-2 py-1 text-[10px] text-[#5e6673] uppercase flex justify-between">
          <span>Events</span>
          <button type="button" className="text-[#f6465d]" onClick={() => clearEvents()}>
            Clear
          </button>
        </div>
        {events.length === 0 && (
          <div className="p-3 text-[#848e9c]">No alerts yet. Enable rules above.</div>
        )}
        {events.slice(0, 40).map((e) => (
          <div key={e.id} className="px-2 py-1 border-b border-[#1e2329]/40 text-[#848e9c]">
            <span className="text-[#f0b90b]">{new Date(e.ts).toLocaleTimeString()}</span>{' '}
            <span className="text-[#eaecef]">{e.symbol}</span> {e.message}
          </div>
        ))}
      </div>
    </div>
  )
}
