import { BRAND } from './identity'
import { LogoMark3D } from './LogoMark3D'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showWordmark?: boolean
  /** Use animated 3D mark instead of static asset */
  animated?: boolean
  /** Stack mark above wordmark (login / splash) */
  layout?: 'row' | 'stack'
  /** Prefer full horizontal logo (image already includes wordmark) */
  fullLogo?: boolean
  className?: string
}

const SIZE = {
  sm: { box: 56, text: 'text-[13px]', sub: 'text-[9px]', fullH: 52 },
  md: { box: 40, text: 'text-[14px]', sub: 'text-[9px]', fullH: 40 },
  lg: { box: 64, text: 'text-xl', sub: 'text-[11px]', fullH: 56 },
  xl: { box: 88, text: 'text-2xl', sub: 'text-[12px]', fullH: 72 },
} as const

export function BrandLogo({
  size = 'md',
  showWordmark = true,
  animated = false,
  layout = 'row',
  fullLogo = false,
  className = '',
}: BrandLogoProps) {
  const s = SIZE[size]
  const use3d = animated && size !== 'sm' && !fullLogo

  if (fullLogo) {
    return (
      <div
        className={`flex ${
          layout === 'stack' ? 'flex-col items-center' : 'items-center'
        } gap-2 ${className}`}
      >
        <img
          src={BRAND.logoFullUrl}
          alt={BRAND.name}
          height={s.fullH}
          className={`shrink-0 object-contain ${size === 'sm' ? 'nacs-header-logo-img' : ''}`}
          style={{
            height: s.fullH,
            width: 'auto',
            maxWidth: size === 'xl' ? 420 : size === 'lg' ? 280 : size === 'sm' ? 240 : 200,
          }}
          draggable={false}
        />
        {size !== 'sm' && showWordmark && (
          <div
            className={`${s.sub} text-[#a0a8b4] tracking-[0.18em] uppercase ${
              layout === 'stack' ? 'text-center' : ''
            }`}
          >
            {BRAND.tagline}
          </div>
        )}
      </div>
    )
  }

  const mark = use3d ? (
    <LogoMark3D size={s.box} animated className="shrink-0" />
  ) : size === 'sm' ? (
    <img
      src={BRAND.logoFullUrl}
      alt={BRAND.name}
      className="nacs-header-logo-img shrink-0 object-contain bg-transparent"
      style={{ height: 52, width: 'auto', maxWidth: 220 }}
      draggable={false}
    />
  ) : (
    <img
      src={BRAND.logoMarkUrl}
      alt={BRAND.name}
      width={s.box}
      height={s.box}
      className="shrink-0 rounded-[12px] shadow-[0_0_32px_rgba(240,185,11,0.4)] ring-2 ring-[#f0b90b]/35 object-cover bg-black"
      draggable={false}
    />
  )

  // Header (sm): logo only — no separate text box
  const wordmark = showWordmark && size !== 'sm' && (
    <div className={`min-w-0 leading-tight ${layout === 'stack' ? 'text-center' : ''}`}>
      <div className={`${s.text} font-bold tracking-[0.04em] truncate`}>
        <span className="text-[#f0b90b]">NACS</span>
        <span className="text-[#eaecef]"> Lab</span>
      </div>
      <div className={`${s.sub} text-[#a0a8b4] tracking-[0.14em] uppercase truncate`}>
        {BRAND.tagline}
      </div>
    </div>
  )

  return (
    <div
      className={`flex ${
        layout === 'stack' ? 'flex-col items-center gap-2' : 'items-center gap-2'
      } ${className}`}
    >
      {mark}
      {wordmark}
    </div>
  )
}
