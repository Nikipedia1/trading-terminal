/**
 * Deribit public REST – book summary by currency (options).
 */

export interface DeribitBookRow {
  instrument_name: string
  open_interest: number
  underlying_price: number
  mark_price: number
  mark_iv?: number
  bid_price?: number
  ask_price?: number
}

interface DeribitResponse {
  result?: DeribitBookRow[]
  error?: { message?: string }
}

export async function fetchDeribitOptionBook(
  currency: 'BTC' | 'ETH'
): Promise<DeribitBookRow[]> {
  const url =
    `https://www.deribit.com/api/v2/public/get_book_summary_by_currency` +
    `?currency=${currency}&kind=option`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Deribit HTTP ${res.status}`)
  const json = (await res.json()) as DeribitResponse
  if (json.error) throw new Error(json.error.message || 'Deribit error')
  return json.result ?? []
}

/** Parse BTC-3OCT25-65000-C → { strike, isCall } */
export function parseInstrument(name: string): {
  strike: number
  isCall: boolean
} | null {
  const parts = name.split('-')
  if (parts.length < 4) return null
  const right = parts[parts.length - 1]
  const strike = parseFloat(parts[parts.length - 2])
  if (!Number.isFinite(strike)) return null
  const isCall = right === 'C' || right.startsWith('C')
  const isPut = right === 'P' || right.startsWith('P')
  if (!isCall && !isPut) return null
  return { strike, isCall }
}
