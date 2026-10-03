import { BRAND } from './identity'
import { LogoMark3D } from './LogoMark3D'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showWordmark?: boolean
  /** Use animated 3D mark instead of static SVG */
  animated?: boolean
  /** Stack mark above wordmark (login / splash) */
  layout?: 'row' | 'stack'
  className?: string
}

const SIZE = {
  sm: { box: 26, text: 'text-[12px]', sub: 'text-[8px]' },
  md: { box: 36, text: 'text-[14px]', sub: 'text-[9px]' },
  lg: { box: 64, text: 'text-xl', sub: 'text-[11px]' },
  xl: { box: 88, text: 'text-2xl', sub: 'text-[12px]' },
} as const

export function BrandLogo({
  size = 'md',
  showWordmark = true,
  animated = false,
  layout = 'row',
  className = '',
}: BrandLogoProps) {
  const s = SIZE[size]
  /* Prefer crisp static SVG on login; 3D only when explicitly requested */
  const use3d = animated && size !== 'sm'

  const mark = use3d ? (
    <LogoMark3D size={s.box} animated className="shrink-0" />
  ) : (
    <img
      src={BRAND.logoMarkUrl}
      alt={BRAND.name}
      width={s.box}
      height={s.box}
      className="shrink-0 rounded-[12px] shadow-[0_0_28px_rgba(240,185,11,0.35)] ring-1 ring-[#f0b90b]/30"
      draggable={false}
    />
  )

  const wordmark = showWordmark && (
    <div
      className={`min-w-0 leading-tight ${layout === 'stack' ? 'text-center' : ''}`}
    >
      <div
        className={`${s.text} font-bold tracking-[0.04em] truncate`}
      >
        <span className="text-[#f0b90b]">NACS</span>
        <span className="text-[#eaecef]"> Lab </span>
        <span className="font-semibold text-[#eaecef]">Terminal</span>
      </div>
      {size !== 'sm' && (
        <div
          className={`${s.sub} text-[#a0a8b4] tracking-[0.14em] uppercase mt-0.5 ${
            layout === 'stack' ? '' : 'truncate'
          }`}
        >
          {BRAND.tagline}
        </div>
      )}
    </div>
  )

  if (layout === 'stack') {
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        {mark}
        {wordmark}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      {mark}
      {wordmark}
    </div>
  )
}
