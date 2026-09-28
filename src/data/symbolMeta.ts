/**
 * Resolve human-readable meta for any exchange symbol string.
 * Always expose the full pair (e.g. BTCUSDT) as the primary label.
 */

import { SYMBOL_PRESETS, type SymbolPreset } from './symbols'

export interface SymbolMeta {
  /** Full trading pair – primary identifier */
  pair: string
  /** Base asset without quote */
  base: string
  /** Quote asset if detected */
  quote: string
  /** Short ticker label (BTC) */
  label: string
  /** Friendly name when known */
  name: string | null
  /** Preset group when known */
  group: string | null
}

const QUOTE_SUFFIXES = ['USDT', 'USDC', 'BUSD', 'USD', 'EUR', 'BTC', 'ETH', 'FDUSD', 'TUSD'] as const

function splitPair(raw: string): { base: string; quote: string } {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  for (const q of QUOTE_SUFFIXES) {
    if (s.endsWith(q) && s.length > q.length) {
      return { base: s.slice(0, -q.length), quote: q }
    }
  }
  return { base: s || '—', quote: '' }
}

const presetBySymbol = new Map<string, SymbolPreset>(
  SYMBOL_PRESETS.map((p) => [p.symbol.toUpperCase(), p])
)

export function resolveSymbolMeta(symbol: string): SymbolMeta {
  const pair = (symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || '—'
  const preset = presetBySymbol.get(pair)
  const { base, quote } = splitPair(pair)
  return {
    pair,
    base: preset?.label ?? base,
    quote,
    label: preset?.label ?? base,
    name: preset?.name ?? null,
    group: preset?.group ?? null,
  }
}

/** Option text: "BTC · BTCUSDT" or "BTCUSDT" if unknown */
export function formatSymbolOption(symbol: string): string {
  const m = resolveSymbolMeta(symbol)
  if (m.label && m.label !== m.pair) return `${m.label} · ${m.pair}`
  return m.pair
}
