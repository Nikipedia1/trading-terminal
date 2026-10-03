/** Full-screen professional splash with multi-layer CSS 3D objects. */

import { useEffect, useState } from 'react'
import { BRAND } from './identity'
import { BrandLogo } from './BrandLogo'
import { LogoMark3D } from './LogoMark3D'

const STEPS = [
  'Initializing desk…',
  'Loading market modules…',
  'Hydrating workspace…',
  'Connecting feeds…',
]

function Stage3D() {
  return (
    <div className="nacs-loader-stage nacs-loader-stage--xl" aria-hidden>
      <div className="nacs-orbit nacs-orbit--deep">
        <div className="nacs-orbit-ring" />
        <div className="nacs-orbit-ring nacs-orbit-ring--2" />
        <div className="nacs-orbit-ring nacs-orbit-ring--3" />
        <div className="nacs-pyramid">
          <div className="nacs-pyramid-face nacs-pyramid-face--f" />
          <div className="nacs-pyramid-face nacs-pyramid-face--r" />
          <div className="nacs-pyramid-face nacs-pyramid-face--b" />
          <div className="nacs-pyramid-face nacs-pyramid-face--l" />
        </div>
        <div className="nacs-cube nacs-cube--nested">
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
  )
}

export function SplashLoader({
  label,
  progress,
}: {
  label?: string
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
      <div className="nacs-splash-scan" aria-hidden />

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-md w-full">
        <BrandLogo size="xl" animated />

        <Stage3D />

        <div className="w-full space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#848e9c]">{label ?? STEPS[step]}</span>
            <span className="font-mono-nums text-[#f0b90b]/90">
              {pct != null ? `${Math.round(pct * 100)}%` : '…'}
            </span>
          </div>
          <div className="h-1 rounded-full bg-[#1e2329] overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-[#c99400] via-[#f0b90b] to-[#ffe08a] ${
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

export function Loader3D({
  size = 40,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
      role="status"
    >
      <LogoMark3D size={size} animated />
    </div>
  )
}
