/** Trading-pair chip with wallet-style coin logo + pair text. */

import { resolveSymbolMeta } from '@/data/symbolMeta'
import { CoinIcon } from '@/ui/CoinIcon'

interface SymbolBadgeProps {
  symbol: string
  showName?: boolean
  /** Show coin logo (default true) */
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function SymbolBadge({
  symbol,
  showName = false,
  showIcon = true,
  size = 'md',
  className = '',
}: SymbolBadgeProps) {
  const m = resolveSymbolMeta(symbol)
  const pair =
    size === 'lg' ? 'text-base' : size === 'md' ? 'text-sm' : 'text-xs'
  const iconPx = size === 'lg' ? 22 : size === 'md' ? 18 : 14

  return (
    <div
      className={`inline-flex items-center gap-1.5 shrink-0 max-w-full ${className}`}
      title={m.name ? `${m.pair} · ${m.name}` : m.pair}
    >
      {showIcon && <CoinIcon symbol={symbol} size={iconPx} />}
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
