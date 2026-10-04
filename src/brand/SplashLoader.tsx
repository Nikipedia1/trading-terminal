import { useEffect, useState } from 'react'
import { BRAND } from './identity'
import { BrandLogo } from './BrandLogo'
import { LogoMark3D } from './LogoMark3D'

const STEPS = [
  'Connecting secure session…',
  'Hydrating market feeds…',
  'Loading desk layout…',
  'Warming orderflow engines…',
] as const

function Stage3D() {
  return (
    <div className="nacs-loader-stage" style={{ width: 96, height: 96 }} aria-hidden>
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
  const [imgOk, setImgOk] = useState(true)

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
    <div className="nacs-splash min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden bg-[#05070a]">
      {imgOk && (
        <img
          src={BRAND.splashHeroUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-[0.42] pointer-events-none select-none"
          onError={() => setImgOk(false)}
          draggable={false}
        />
      )}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 42%, rgba(5,10,18,0.35) 0%, rgba(5,7,10,0.82) 55%, #05070a 100%)',
        }}
        aria-hidden
      />
      <div className="nacs-splash-grid opacity-40" aria-hidden />
      <div className="nacs-splash-scan" aria-hidden />

      <div className="relative z-10 flex flex-col items-center gap-7 max-w-lg w-full">
        <BrandLogo size="xl" fullLogo layout="stack" showWordmark />

        <Stage3D />

        <div className="w-full max-w-sm space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#c8cdd5]">{label ?? STEPS[step]}</span>
            <span className="font-mono-nums text-[#f0b90b]/95">
              {pct != null ? `${Math.round(pct * 100)}%` : '…'}
            </span>
          </div>
          <div className="h-1 rounded-full bg-[#1e2329]/90 overflow-hidden border border-[#2b3139]/50">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-[#c99400] via-[#f0b90b] to-[#ffe08a] ${
                pct == null ? 'nacs-progress-indeterminate' : ''
              }`}
              style={pct != null ? { width: `${pct * 100}%` } : undefined}
            />
          </div>
        </div>

        <p className="text-[10px] text-[#7a8494] tracking-[0.2em] uppercase">
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
