/**
 * Resolve human-readable meta for any exchange symbol string.
 * Crypto: BTCUSDT primary label. Yahoo: keep ticker as-is (AAPL, EURUSD=X, ^GSPC).
 */

import {
  SYMBOL_PRESETS,
  type SymbolPreset,
  getPreset,
  inferAssetFromSymbol,
  normalizeSymbolInput,
} from './symbols'

export interface SymbolMeta {
  /** Full trading pair / ticker – primary identifier */
  pair: string
  /** Base asset without quote */
  base: string
  /** Quote asset if detected */
  quote: string
  /** Short ticker label (BTC, AAPL) */
  label: string
  /** Friendly name when known */
  name: string | null
  /** Preset group when known */
  group: string | null
  assetClass: string | null
}

const QUOTE_SUFFIXES = ['USDT', 'USDC', 'BUSD', 'USD', 'EUR', 'BTC', 'ETH', 'FDUSD', 'TUSD'] as const

function splitPair(raw: string): { base: string; quote: string } {
  const s = raw.toUpperCase()
  if (s.includes('=X') || s.includes('=F')) {
    return { base: s.split('=')[0] || s, quote: '' }
  }
  if (s.startsWith('^')) return { base: s.slice(1), quote: '' }
  if (s.includes('-')) {
    const [a, b] = s.split('-')
    return { base: a || s, quote: b || '' }
  }
  const alnum = s.replace(/[^A-Z0-9]/g, '')
  for (const q of QUOTE_SUFFIXES) {
    if (alnum.endsWith(q) && alnum.length > q.length) {
      return { base: alnum.slice(0, -q.length), quote: q }
    }
  }
  return { base: alnum || s || '—', quote: '' }
}

const presetBySymbol = new Map<string, SymbolPreset>(
  SYMBOL_PRESETS.map((p) => [p.symbol.toUpperCase(), p])
)

export function resolveSymbolMeta(symbol: string): SymbolMeta {
  const raw = (symbol || '').trim()
  const preset =
    getPreset(raw) ||
    presetBySymbol.get(raw.toUpperCase()) ||
    null
  const pair = preset?.symbol ?? (raw ? normalizeSymbolInput(raw) : '—')
  const { base, quote } = splitPair(pair)
  const inferred = inferAssetFromSymbol(pair)
  return {
    pair,
    base: preset?.label ?? base,
    quote,
    label: preset?.label ?? base,
    name: preset?.name ?? null,
    group: preset?.group ?? null,
    assetClass: preset?.assetClass ?? inferred.assetClass,
  }
}

/** Option text: "BTC · BTCUSDT" or "AAPL · Apple" */
export function formatSymbolOption(symbol: string): string {
  const m = resolveSymbolMeta(symbol)
  if (m.name && m.label) return `${m.label} · ${m.name}`
  if (m.label && m.label !== m.pair) return `${m.label} · ${m.pair}`
  return m.pair
}

export { normalizeSymbolInput, inferAssetFromSymbol }
