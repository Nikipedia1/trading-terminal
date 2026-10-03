import { BRAND } from './identity'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showWordmark?: boolean
  className?: string
}

const SIZE = {
  sm: { box: 22, text: 'text-[12px]', sub: 'text-[8px]' },
  md: { box: 28, text: 'text-[13px]', sub: 'text-[9px]' },
  lg: { box: 48, text: 'text-lg', sub: 'text-[11px]' },
} as const

export function BrandLogo({
  size = 'md',
  showWordmark = true,
  className = '',
}: BrandLogoProps) {
  const s = SIZE[size]
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <img
        src={BRAND.logoMarkUrl}
        alt=""
        width={s.box}
        height={s.box}
        className="shrink-0 rounded-[6px] shadow-[0_0_12px_rgba(240,185,11,0.15)]"
        draggable={false}
      />
      {showWordmark && (
        <div className="min-w-0 leading-tight">
          <div
            className={`${s.text} font-semibold tracking-[0.04em] text-[#eaecef] truncate`}
          >
            {BRAND.name}
          </div>
          {size !== 'sm' && (
            <div className={`${s.sub} text-[#848e9c] tracking-wide truncate`}>
              {BRAND.tagline}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
