/**
 * Range vs Discovery helper (label only – never auto-trade).
 *
 * Range mode: last price inside Value Area [VAL, VAH]
 * Discovery: price outside VA AND recent candle delta agrees with break direction
 */

export type MarketMode = 'range' | 'discovery_up' | 'discovery_down' | 'unknown'

export interface ModeResult {
  mode: MarketMode
  label: string
  detail: string
}

export function classifyRangeDiscovery(
  lastPrice: number | null,
  val: number,
  vah: number,
  /** recent closed-candle delta (buy − sell); null if unavailable */
  recentDelta: number | null
): ModeResult {
  if (lastPrice == null || !Number.isFinite(lastPrice) || val <= 0 || vah <= 0 || val > vah) {
    return { mode: 'unknown', label: '—', detail: 'Need profile VA + price' }
  }

  if (lastPrice >= val && lastPrice <= vah) {
    return {
      mode: 'range',
      label: 'Range mode',
      detail: `Price inside VA [${val} – ${vah}]`,
    }
  }

  if (lastPrice > vah) {
    const deltaOk = recentDelta == null || recentDelta > 0
    if (deltaOk) {
      return {
        mode: 'discovery_up',
        label: 'Discovery ↑',
        detail: `Break above VAH ${vah}${recentDelta != null ? ` · Δ ${recentDelta.toFixed(2)}` : ''}`,
      }
    }
    return {
      mode: 'range',
      label: 'Range mode',
      detail: `Above VAH but Δ not confirming`,
    }
  }

  // lastPrice < val
  const deltaOk = recentDelta == null || recentDelta < 0
  if (deltaOk) {
    return {
      mode: 'discovery_down',
      label: 'Discovery ↓',
      detail: `Break below VAL ${val}${recentDelta != null ? ` · Δ ${recentDelta.toFixed(2)}` : ''}`,
    }
  }
  return {
    mode: 'range',
    label: 'Range mode',
    detail: `Below VAL but Δ not confirming`,
  }
}
