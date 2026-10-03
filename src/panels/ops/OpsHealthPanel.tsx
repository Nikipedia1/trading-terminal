/** Ops health dashboard – feeds, Functions, KV, AI, metrics, flags, backup. */

import { useCallback, useEffect, useState } from 'react'
import { getAllFeedHealth } from '@/data/shared'
import { getMetricsSnapshot, resetMetrics } from '@/lib/metrics'
import { getLogBuffer } from '@/lib/logger'
import { FEATURES, setFeatureOverride, listFeatureOverrides, type FlagKey } from '@/lib/features'
import { downloadDeskBackup, restoreDeskBackupFromFile } from '@/lib/backup'
import { isTelemetryEnabled } from '@/lib/telemetry'
import { timedFetch } from '@/lib/metrics'

interface HealthBody {
  ok: boolean
  time?: string
  checks?: Record<string, string>
  upstream?: Record<string, { ok: boolean; ms?: number; detail?: string }>
}

export function OpsHealthPanel() {
  const [health, setHealth] = useState<HealthBody | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [overrides, setOverrides] = useState(listFeatureOverrides())

  const refresh = useCallback(async () => {
    setErr(null)
    try {
      const res = await timedFetch('health', '/api/health')
      const body = (await res.json()) as HealthBody
      setHealth(body)
    } catch (e: any) {
      setErr(e?.message || 'health unreachable')
      setHealth(null)
    }
    setTick((t) => t + 1)
    setOverrides(listFeatureOverrides())
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 30_000)
    return () => window.clearInterval(id)
  }, [refresh])

  const feeds = getAllFeedHealth()
  const metrics = getMetricsSnapshot()
  const logs = getLogBuffer().slice(-15).reverse()

  const toggleFlag = (key: FlagKey) => {
    const cur = FEATURES[key as keyof typeof FEATURES]
    const on = typeof cur === 'boolean' ? cur : true
    setFeatureOverride(key, !on)
    setOverrides(listFeatureOverrides())
  }

  return (
    <div className="h-full flex flex-col bg-[#0b0e11] text-[11px] text-[#eaecef] overflow-hidden">
      <div className="px-2 py-1.5 border-b border-[#1e2329] flex items-center gap-2 shrink-0">
        <span className="font-semibold text-[#f0b90b]">Ops / Health</span>
        <button
          type="button"
          className="ml-auto px-2 py-0.5 rounded border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]"
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        <section className="space-y-1">
          <h3 className="text-[#848e9c] uppercase tracking-wider text-[10px]">Backend</h3>
          {err && <p className="text-[#f6465d]">{err}</p>}
          {health && (
            <div className="grid grid-cols-2 gap-1 font-mono-nums">
              <span>status</span>
              <span className={health.ok ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                {health.ok ? 'OK' : 'DEGRADED'}
              </span>
              {health.checks &&
                Object.entries(health.checks).map(([k, v]) => (
                  <>
                    <span key={`k-${k}`}>{k}</span>
                    <span
                      key={`v-${k}`}
                      className={v === 'ok' || v === 'cloudflare-pages' ? 'text-[#0ecb81]' : 'text-[#f0b90b]'}
                    >
                      {v}
                    </span>
                  </>
                ))}
              {health.upstream &&
                Object.entries(health.upstream).map(([k, u]) => (
                  <>
                    <span key={`uk-${k}`}>{k}</span>
                    <span key={`uv-${k}`} className={u.ok ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                      {u.ok ? `ok ${u.ms ?? '—'}ms` : u.detail || 'fail'}
                    </span>
                  </>
                ))}
              <span>sentry</span>
              <span>{isTelemetryEnabled() ? 'configured' : 'off'}</span>
            </div>
          )}
        </section>

        <section className="space-y-1">
          <h3 className="text-[#848e9c] uppercase tracking-wider text-[10px]">
            Feeds ({feeds.length})
          </h3>
          {feeds.length === 0 && <p className="text-[#5e6673]">No active feed metrics</p>}
          {feeds.map((f) => (
            <div key={f.key} className="flex justify-between border-b border-[#1e2329] py-0.5 font-mono-nums">
              <span>
                {f.exchange}:{f.symbol}
              </span>
              <span
                className={
                  f.bookStale || f.tickStale ? 'text-[#f6465d]' : 'text-[#0ecb81]'
                }
              >
                {f.status} · gaps {f.gaps} · resync {f.resyncs}
              </span>
            </div>
          ))}
        </section>

        <section className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[#848e9c] uppercase tracking-wider text-[10px]">API metrics</h3>
            <button
              type="button"
              className="text-[10px] text-[#f6465d]"
              onClick={() => {
                resetMetrics()
                setTick((t) => t + 1)
              }}
            >
              reset
            </button>
          </div>
          {metrics.rows.length === 0 && <p className="text-[#5e6673]">No samples yet</p>}
          {metrics.rows.slice(0, 12).map((r) => (
            <div key={r.name} className="flex justify-between font-mono-nums text-[10px]">
              <span className="truncate max-w-[55%]">{r.name}</span>
              <span>
                n={r.count} err={(r.errorRate * 100).toFixed(0)}% avg={r.avgMs.toFixed(0)}ms
              </span>
            </div>
          ))}
        </section>

        <section className="space-y-1">
          <h3 className="text-[#848e9c] uppercase tracking-wider text-[10px]">Feature flags</h3>
          <p className="text-[#5e6673] text-[10px]">Runtime overrides (rollback without redeploy)</p>
          {(['newsPanel', 'aiAnalyze', 'liveTrading', 'liveKeysUi', 'opsPanel'] as FlagKey[]).map(
            (k) => (
              <label key={k} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-[#f0b90b]"
                  checked={!!FEATURES[k as keyof typeof FEATURES]}
                  onChange={() => toggleFlag(k)}
                />
                <span>
                  {k}
                  {overrides[k] != null ? ' *' : ''}
                </span>
              </label>
            )
          )}
        </section>

        <section className="space-y-1">
          <h3 className="text-[#848e9c] uppercase tracking-wider text-[10px]">Backup / DR</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="px-2 py-1 rounded bg-[#0ecb81]/15 text-[#0ecb81]"
              onClick={() => downloadDeskBackup(false)}
            >
              Export workspace JSON
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded bg-[#0ecb81]/15 text-[#0ecb81]"
              onClick={() => downloadDeskBackup(true)}
            >
              Export + ops
            </button>
            <label className="px-2 py-1 rounded border border-[#2b3139] text-[#848e9c] cursor-pointer">
              Import…
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  void restoreDeskBackupFromFile(f).then((r) => {
                    if (!r.ok) alert(r.error)
                    else alert('Workspace restored')
                  })
                }}
              />
            </label>
          </div>
        </section>

        <section className="space-y-1">
          <h3 className="text-[#848e9c] uppercase tracking-wider text-[10px]">Recent logs</h3>
          <ul className="font-mono text-[10px] text-[#848e9c] space-y-0.5">
            {logs.map((l, i) => (
              <li key={`${l.ts}-${i}`} className={l.level === 'error' ? 'text-[#f6465d]' : ''}>
                {new Date(l.ts).toLocaleTimeString()} [{l.level}] {l.scope}: {l.message}
              </li>
            ))}
          </ul>
          <span className="sr-only">{tick}</span>
        </section>
      </div>
    </div>
  )
}
