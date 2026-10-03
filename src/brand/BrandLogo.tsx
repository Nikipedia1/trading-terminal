import { BRAND } from './identity'
import { LogoMark3D } from './LogoMark3D'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showWordmark?: boolean
  /** Use animated 3D mark instead of static SVG */
  animated?: boolean
  className?: string
}

const SIZE = {
  sm: { box: 26, text: 'text-[12px]', sub: 'text-[8px]' },
  md: { box: 32, text: 'text-[13px]', sub: 'text-[9px]' },
  lg: { box: 56, text: 'text-lg', sub: 'text-[11px]' },
  xl: { box: 72, text: 'text-xl', sub: 'text-[12px]' },
} as const

export function BrandLogo({
  size = 'md',
  showWordmark = true,
  animated = true,
  className = '',
}: BrandLogoProps) {
  const s = SIZE[size]
  const use3d = animated && size !== 'sm'

  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      {use3d ? (
        <LogoMark3D size={s.box} animated className="shrink-0" />
      ) : (
        <img
          src={BRAND.logoMarkUrl}
          alt=""
          width={s.box}
          height={s.box}
          className="shrink-0 rounded-[7px] shadow-[0_0_16px_rgba(240,185,11,0.2)]"
          draggable={false}
        />
      )}
      {showWordmark && (
        <div className="min-w-0 leading-tight">
          <div
            className={`${s.text} font-semibold tracking-[0.06em] text-[#eaecef] truncate`}
          >
            <span className="text-[#f0b90b]">NACS</span>
            <span className="text-[#eaecef]/90"> Lab </span>
            <span className="font-medium text-[#c8cdd3]">Terminal</span>
          </div>
          {size !== 'sm' && (
            <div className={`${s.sub} text-[#848e9c] tracking-[0.12em] uppercase truncate`}>
              {BRAND.tagline}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
