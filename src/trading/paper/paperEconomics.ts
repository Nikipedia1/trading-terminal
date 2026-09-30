/**
 * Paper trading economics: commissions, funding, equity curve, CSV export.
 */

export interface FeeConfig {
  takerBps: number
  makerBps: number
  fundingRate8h: number
}

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  takerBps: 4,
  makerBps: 2,
  fundingRate8h: 0.0001,
}

export const FUNDING_INTERVAL_MS = 8 * 60 * 60 * 1000

export function commissionFor(
  notional: number,
  isMaker: boolean,
  cfg: FeeConfig = DEFAULT_FEE_CONFIG
): number {
  const bps = isMaker ? cfg.makerBps : cfg.takerBps
  return Math.max(0, (Math.abs(notional) * bps) / 10_000)
}

export function fundingPayment(
  side: 'long' | 'short',
  qty: number,
  mark: number,
  rate: number
): number {
  const notional = qty * mark
  const pay = notional * rate
  return side === 'long' ? -pay : pay
}

export interface EquityPoint {
  t: number
  equity: number
  balance: number
  unrealized: number
  fees: number
  funding: number
}

export function toCsv(
  rows: Record<string, string | number>[],
  columns: string[]
): string {
  const esc = (v: string | number) => {
    const s = String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [columns.join(',')]
  for (const r of rows) {
    lines.push(columns.map((c) => esc(r[c] ?? '')).join(','))
  }
  return lines.join('\n')
}

export function downloadText(filename: string, text: string) {
  if (typeof document === 'undefined') return
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
