/** Full-screen professional splash with CSS 3D loading object. */

import { useEffect, useState } from 'react'
import { BRAND } from './identity'
import { BrandLogo } from './BrandLogo'

const STEPS = [
  'Initializing desk…',
  'Loading market modules…',
  'Hydrating workspace…',
  'Connecting feeds…',
]

export function SplashLoader({
  label,
  progress,
}: {
  label?: string
  /** 0–1 optional determinate bar */
  progress?: number
}) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length)
    }, 900)
    return () => window.clearInterval(id)
  }, [])

  const pct =
    progress != null && Number.isFinite(progress)
      ? Math.max(0, Math.min(1, progress))
      : null

  return (
    <div className="nacs-splash min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="nacs-splash-grid" aria-hidden />
      <div className="nacs-splash-glow" aria-hidden />

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-md w-full">
        <BrandLogo size="lg" />

        {/* CSS 3D orbital + cube */}
        <div className="nacs-loader-stage" aria-hidden>
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

        <div className="w-full space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#848e9c]">{label ?? STEPS[step]}</span>
            <span className="font-mono-nums text-[#f0b90b]/90">
              {pct != null ? `${Math.round(pct * 100)}%` : '…'}
            </span>
          </div>
          <div className="h-1 rounded-full bg-[#1e2329] overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-[#c99400] to-[#f0b90b] ${
                pct == null ? 'nacs-progress-indeterminate' : ''
              }`}
              style={pct != null ? { width: `${pct * 100}%` } : undefined}
            />
          </div>
        </div>

        <p className="text-[10px] text-[#5e6673] tracking-widest uppercase">
          {BRAND.shortName} · secure session bootstrap
        </p>
      </div>
    </div>
  )
}

/** Compact inline 3D spinner for panels / buttons. */
export function Loader3D({
  size = 36,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <div
      className={`nacs-loader-stage nacs-loader-stage--inline ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
      role="status"
    >
      <div className="nacs-orbit nacs-orbit--sm">
        <div className="nacs-orbit-ring" />
        <div className="nacs-cube nacs-cube--sm">
          <div className="nacs-cube-face nacs-cube-face--front" />
          <div className="nacs-cube-face nacs-cube-face--back" />
          <div className="nacs-cube-face nacs-cube-face--right" />
          <div className="nacs-cube-face nacs-cube-face--left" />
          <div className="nacs-cube-face nacs-cube-face--top" />
          <div className="nacs-cube-face nacs-cube-face--bottom" />
        </div>
      </div>
    </div>
  )
}
