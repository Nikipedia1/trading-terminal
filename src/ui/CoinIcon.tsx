/**
 * Wallet-style coin logo — official artwork only.
 *
 * Sources (free, no invented graphics):
 *  1. cryptocurrency-icons (community pack of official brand SVGs)
 *     only with exact lowercase ticker match — no made-up aliases
 *  2. On load error → neutral letter avatar (not a fake logo)
 *
 * We never draw fake coin art. Unknown tickers stay as letter fallback.
 */

import { useMemo, useState } from 'react'
import { resolveSymbolMeta } from '@/data/symbolMeta'

/**
 * Only renames that exist in the official cryptocurrency-icons repo filenames
 * (see https://github.com/spothq/cryptocurrency-icons).
 * Nothing invented beyond documented pack names.
 */
const PACK_FILENAMES: Record<string, string> = {
  // pack uses "miota" for IOTA
  IOTA: 'miota',
  // pack uses "1inch"
  '1INCH': '1inch',
}

/** Strip quote suffix / leverage prefixes → base asset ticker */
function baseTicker(symbol: string): string {
  const m = resolveSymbolMeta(symbol)
  let base = (m.base || m.label || '').toUpperCase()
  // Binance 1000PEPE → PEPE for icon lookup
  if (base.startsWith('1000') && base.length > 4) base = base.slice(4)
  if (base.startsWith('1000000') && base.length > 7) base = base.slice(7)
  return base
}

function packFileId(base: string): string {
  if (PACK_FILENAMES[base]) return PACK_FILENAMES[base]
  // Official pack files are lowercase tickers (btc, eth, sol, …)
  return base.toLowerCase()
}

function hashHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 360
}

interface CoinIconProps {
  symbol: string
  size?: number
  className?: string
}

export function CoinIcon({ symbol, size = 20, className = '' }: CoinIconProps) {
  const base = useMemo(() => baseTicker(symbol), [symbol])
  const fileId = useMemo(() => packFileId(base), [base])
  const meta = useMemo(() => resolveSymbolMeta(symbol), [symbol])

  const [failed, setFailed] = useState(false)
  const [prev, setPrev] = useState(symbol)
  if (prev !== symbol) {
    setPrev(symbol)
    setFailed(false)
  }

  const letter = (base || '?').slice(0, 1)
  const hue = hashHue(base || symbol)

  // Neutral fallback — not a fake coin logo
  if (failed || !fileId || fileId === '—' || fileId.length < 2) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full font-bold text-[10px] shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          background: `hsl(${hue} 40% 28%)`,
          color: '#eaecef',
          border: '1px solid #2b3139',
        }}
        title={meta.pair}
        aria-label={base || symbol}
      >
        {letter}
      </span>
    )
  }

  // Official brand SVG from cryptocurrency-icons (jsDelivr → GitHub)
  const src = `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${fileId}.svg`

  return (
    <img
      src={src}
      alt={base}
      width={size}
      height={size}
      className={`rounded-full shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      title={meta.name ? `${meta.name} (${meta.pair})` : meta.pair}
    />
  )
}
