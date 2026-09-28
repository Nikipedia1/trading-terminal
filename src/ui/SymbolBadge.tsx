/** High-contrast trading-pair chip – always readable on dark panels. */

import { resolveSymbolMeta } from '@/data/symbolMeta'

interface SymbolBadgeProps {
  symbol: string
  showName?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function SymbolBadge({
  symbol,
  showName = false,
  size = 'md',
  className = '',
}: SymbolBadgeProps) {
  const m = resolveSymbolMeta(symbol)
  const pair =
    size === 'lg'
      ? 'text-base'
      : size === 'md'
        ? 'text-sm'
        : 'text-xs'

  return (
    <div
      className={`inline-flex items-center gap-1.5 shrink-0 max-w-full ${className}`}
      title={m.name ? `${m.pair} · ${m.name}` : m.pair}
    >
      <span
        className={`${pair} font-bold font-mono tracking-wide px-1.5 py-0.5 rounded bg-[#f0b90b] text-[#0b0e11] leading-none`}
      >
        {m.pair || '—'}
      </span>
      {showName && (m.name || m.label) && (
        <span className="text-[10px] text-[#848e9c] truncate max-w-[7rem]">
          {m.name ?? m.label}
        </span>
      )}
    </div>
  )
}
