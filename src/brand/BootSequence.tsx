/**
 * Professional cold-start: animated progress → faux terminal bootstrap.
 * Theme: NACS Lab dark + gold. No real package installs — pure UX theatre.
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import { BRAND } from './identity'
import { BrandLogo } from './BrandLogo'
import { PLANS, type PlanId } from '@/billing/plans'

type Phase = 'progress' | 'terminal' | 'exit'

interface BootSequenceProps {
  onComplete: () => void
  userEmail?: string | null
  userRole?: string | null
  planId?: PlanId
  sessionMode?: 'guest' | 'authenticated' | 'checking'
}

const PROGRESS_MS = 4200
const LINE_BASE_MS = 95

type LineKind = 'sys' | 'ok' | 'info' | 'warn' | 'cmd' | 'dim' | 'gold'

interface BootLine {
  text: string
  kind: LineKind
  delayMs?: number
}

function buildLines(opts: {
  email?: string | null
  role?: string | null
  planId: PlanId
  sessionMode: 'guest' | 'authenticated' | 'checking'
}): BootLine[] {
  const plan = PLANS[opts.planId]
  const who =
    opts.sessionMode === 'authenticated' && opts.email
      ? opts.email
      : opts.sessionMode === 'guest'
        ? 'guest@local'
        : 'resolving…'
  const role = opts.role || (opts.sessionMode === 'guest' ? 'viewer' : '—')
  const trade = plan.entitlements.liveTrading ? 'live + paper' : 'paper only'
  const ai = `${plan.entitlements.aiAnalyzePerHour}/h AI quota`

  return [
    { kind: 'gold', text: `╔══════════════════════════════════════════════════╗` },
    { kind: 'gold', text: `║   ${BRAND.name.padEnd(44)}║` },
    { kind: 'gold', text: `║   ${BRAND.tagline.padEnd(44)}║` },
    { kind: 'gold', text: `╚══════════════════════════════════════════════════╝` },
    { kind: 'dim', text: ` ` },
    { kind: 'sys', text: `[kernel]  boot @ ${new Date().toISOString()}` },
    { kind: 'sys', text: `[kernel]  runtime webassembly · vite · react` },
    { kind: 'cmd', text: `$ nacs init --desk professional` },
    { kind: 'info', text: `  → secure context check …………………… OK` },
    { kind: 'info', text: `  → indexedDB vault ……………………………… OK` },
    { kind: 'info', text: `  → websocket capability …………………… OK` },
    { kind: 'dim', text: ` ` },
    { kind: 'cmd', text: `$ nacs pkg sync --channel stable` },
    { kind: 'ok', text: `  ✓ @nacs/core@${BRAND.versionLabel.replace('v', '')}` },
    { kind: 'ok', text: `  ✓ @nacs/charts-lwc@4.2` },
    { kind: 'ok', text: `  ✓ @nacs/orderflow@2.1.0` },
    { kind: 'ok', text: `  ✓ @nacs/microstructure@1.4.2` },
    { kind: 'ok', text: `  ✓ @nacs/volume-profile@1.2.0` },
    { kind: 'ok', text: `  ✓ @nacs/deep-dom@1.0.3` },
    { kind: 'ok', text: `  ✓ @nacs/onchain@0.9.1` },
    { kind: 'ok', text: `  ✓ @nacs/news-rss@1.0.0` },
    { kind: 'info', text: `  8 packages resolved · 0 vulnerabilities (audit mock)` },
    { kind: 'dim', text: ` ` },
    { kind: 'cmd', text: `$ nacs feeds attach --venues binance,kucoin` },
    { kind: 'ok', text: `  ✓ market.klines REST` },
    { kind: 'ok', text: `  ✓ market.trades WS` },
    { kind: 'ok', text: `  ✓ market.depth L2` },
    { kind: 'ok', text: `  ✓ ticker.24h` },
    { kind: 'dim', text: ` ` },
    { kind: 'cmd', text: `$ nacs session inspect` },
    { kind: 'info', text: `  user        ${who}` },
    { kind: 'info', text: `  role        ${role}` },
    { kind: 'gold', text: `  plan        ${plan.name.toUpperCase()}  (${plan.priceLabel})` },
    { kind: 'info', text: `  trading     ${trade}` },
    { kind: 'info', text: `  workspace   ${plan.entitlements.cloudWorkspace ? 'cloud KV' : 'local only'}` },
    { kind: 'info', text: `  ai          ${ai}` },
    { kind: 'dim', text: ` ` },
    { kind: 'cmd', text: `$ nacs desk mount --layout default` },
    { kind: 'ok', text: `  ✓ chart engine` },
    { kind: 'ok', text: `  ✓ panel registry` },
    { kind: 'ok', text: `  ✓ risk gates` },
    { kind: 'ok', text: `  ✓ hotkey map` },
    { kind: 'dim', text: ` ` },
    { kind: 'gold', text: `▶  DESK ONLINE  ·  ${BRAND.shortName} ${BRAND.versionLabel}` },
    { kind: 'dim', text: `   ${plan.blurb}` },
    { kind: 'sys', text: `[ready]  entering desk…` },
  ]
}

const KIND_CLASS: Record<LineKind, string> = {
  sys: 'text-[#5e6673]',
  ok: 'text-[#0ecb81]',
  info: 'text-[#c8cdd5]',
  warn: 'text-[#f0b90b]',
  cmd: 'text-[#f0b90b] font-semibold',
  dim: 'text-[#3d4450]',
  gold: 'text-[#f0b90b]',
}

const PROGRESS_LABELS = [
  'Mounting secure runtime…',
  'Loading chart engine…',
  'Hydrating market adapters…',
  'Warming orderflow buffers…',
  'Linking panel registry…',
  'Calibrating risk gates…',
  'Almost ready…',
]

export function BootSequence({
  onComplete,
  userEmail,
  userRole,
  planId = 'free',
  sessionMode = 'checking',
}: BootSequenceProps) {
  const [phase, setPhase] = useState<Phase>('progress')
  const [pct, setPct] = useState(0)
  const [labelIdx, setLabelIdx] = useState(0)
  const [visibleCount, setVisibleCount] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)
  const termRef = useRef<HTMLDivElement>(null)
  const completed = useRef(false)

  const lines = useMemo(
    () =>
      buildLines({
        email: userEmail,
        role: userRole,
        planId,
        sessionMode,
      }),
    [userEmail, userRole, planId, sessionMode]
  )

  useEffect(() => {
    if (phase !== 'progress') return
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / PROGRESS_MS)
      const eased = 1 - Math.pow(1 - t, 3)
      setPct(eased)
      setLabelIdx(Math.min(PROGRESS_LABELS.length - 1, Math.floor(t * PROGRESS_LABELS.length)))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setPct(1)
        window.setTimeout(() => setPhase('terminal'), 280)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  useEffect(() => {
    if (phase !== 'terminal') return
    setVisibleCount(0)
    let i = 0
    let timer = 0
    const next = () => {
      i += 1
      setVisibleCount(i)
      if (i >= lines.length) {
        window.setTimeout(() => {
          setFadeOut(true)
          window.setTimeout(() => {
            if (!completed.current) {
              completed.current = true
              onComplete()
            }
          }, 450)
        }, 700)
        return
      }
      const extra = lines[i]?.delayMs ?? 0
      const len = lines[i]?.text.length ?? 20
      const ms = LINE_BASE_MS + Math.min(80, len * 2) + extra
      timer = window.setTimeout(next, ms)
    }
    timer = window.setTimeout(next, 200)
    return () => window.clearTimeout(timer)
  }, [phase, lines, onComplete])

  useEffect(() => {
    const el = termRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [visibleCount])

  const pctShow = Math.round(pct * 100)

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 relative overflow-hidden bg-[#05070a] transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        backgroundImage: `url(${BRAND.splashHeroUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
      role="status"
      aria-live="polite"
      aria-label="NACS Lab boot sequence"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            phase === 'terminal'
              ? 'radial-gradient(ellipse 50% 45% at 50% 40%, rgba(5,8,14,0.35) 0%, rgba(5,8,14,0.82) 75%, #05070a 100%)'
              : 'radial-gradient(ellipse 55% 50% at 50% 45%, rgba(5,8,14,0.12) 0%, rgba(5,8,14,0.55) 70%, rgba(5,8,14,0.85) 100%)',
        }}
        aria-hidden
      />
      <div className="nacs-splash-scan opacity-40" aria-hidden />

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-5">
        <div
          className={`transition-all duration-500 ${
            phase === 'terminal' ? 'scale-90 opacity-90' : 'scale-100'
          }`}
        >
          <BrandLogo size="xl" fullLogo layout="stack" showWordmark />
        </div>

        {phase === 'progress' && (
          <div className="w-full max-w-md rounded-2xl bg-[#0b0e11]/80 border border-[#2b3139]/90 backdrop-blur-md px-7 py-7 shadow-[0_24px_64px_rgba(0,0,0,0.55)] flex flex-col items-center gap-6">
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
                <div className="nacs-orbit-dot nacs-orbit-dot--2" />
              </div>
            </div>

            <div className="w-full space-y-2.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#eaecef] font-medium tracking-wide">
                  {PROGRESS_LABELS[labelIdx]}
                </span>
                <span className="font-mono-nums text-[#f0b90b] tabular-nums text-[13px] font-semibold">
                  {pctShow}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1e2329] overflow-hidden border border-[#2b3139]/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#c99400] via-[#f0b90b] to-[#ffe08a] shadow-[0_0_12px_rgba(240,185,11,0.45)] transition-[width] duration-100 ease-out"
                  style={{ width: `${pctShow}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-[#5e6673] uppercase tracking-wider">
                <span>NACS runtime</span>
                <span>stage 1 / 2</span>
              </div>
            </div>
          </div>
        )}

        {phase === 'terminal' && (
          <div className="w-full rounded-xl border border-[#2b3139] bg-[#0a0d12]/92 backdrop-blur-md shadow-[0_24px_80px_rgba(0,0,0,0.65)] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e2329] bg-[#0d1117]/95">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f6465d]/90" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#f0b90b]/90" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#0ecb81]/90" />
              <span className="ml-2 text-[11px] text-[#848e9c] font-mono tracking-wide truncate">
                nacs-lab — bootstrap — {BRAND.versionLabel}
              </span>
              <span className="ml-auto text-[10px] text-[#5e6673] uppercase tracking-wider hidden sm:inline">
                stage 2 / 2
              </span>
            </div>

            <div
              ref={termRef}
              className="h-[min(52vh,420px)] overflow-y-auto px-3 sm:px-4 py-3 font-mono text-[11px] sm:text-[12px] leading-[1.55] select-none"
            >
              {lines.slice(0, visibleCount).map((line, idx) => (
                <div key={idx} className={`${KIND_CLASS[line.kind]} whitespace-pre-wrap break-all`}>
                  {line.text || '\u00a0'}
                </div>
              ))}
              {visibleCount < lines.length && (
                <span className="inline-block w-2 h-3.5 bg-[#f0b90b] ml-0.5 align-middle animate-pulse" />
              )}
            </div>

            <div className="px-3 py-1.5 border-t border-[#1e2329] flex items-center justify-between text-[9px] text-[#5e6673] uppercase tracking-wider">
              <span>pkg · feeds · session · desk</span>
              <span className="text-[#f0b90b]/80">
                {Math.min(100, Math.round((visibleCount / Math.max(lines.length, 1)) * 100))}%
              </span>
            </div>
          </div>
        )}

        <p className="text-[10px] text-[#5e6673] tracking-[0.18em] uppercase">
          {BRAND.shortName} · professional desk bootstrap
        </p>
      </div>
    </div>
  )
}
