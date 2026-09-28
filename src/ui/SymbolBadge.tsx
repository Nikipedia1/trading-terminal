/** Prominent trading-pair badge used on panels and tools. */

import { resolveSymbolMeta } from '@/data/symbolMeta'

interface SymbolBadgeProps {
  symbol: string
  /** show base name under pair */
  showName?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function SymbolBadge({
  symbol,
  showName = true,
  size = 'md',
  className = '',
}: SymbolBadgeProps) {
  const m = resolveSymbolMeta(symbol)
  const pairCls =
    size === 'md'
      ? 'text-sm font-bold tracking-wide'
      : 'text-[11px] font-bold tracking-wide'
  const subCls = size === 'md' ? 'text-[10px]' : 'text-[9px]'

  return (
    <div
      className={`inline-flex flex-col leading-tight min-w-0 ${className}`}
      title={m.name ? `${m.name} · ${m.pair}` : m.pair}
    >
      <span className={`${pairCls} text-[#f0b90b] font-mono-nums truncate`}>
        {m.pair}
      </span>
      {showName && (
        <span className={`${subCls} text-[#848e9c] truncate`}>
          {m.name ? `${m.label} · ${m.name}` : m.label}
          {m.quote ? ` / ${m.quote}` : ''}
        </span>
      )}
    </div>
  )
}
