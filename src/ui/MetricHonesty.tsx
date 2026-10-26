/**
 * Honest metric badges — surface methodology limits in UI (no marketing spin).
 */

export type MetricHonestyKind =
  | 'aggressor'
  | 'tpo-ohlc'
  | 'ring-buffer'
  | 'archive-only'
  | 'synthetic-none'
  | 'feed-limit'

const COPY: Record<
  MetricHonestyKind,
  { label: string; title: string; tone: 'gold' | 'muted' | 'warn' }
> = {
  aggressor: {
    label: 'aggressor only',
    title: 'Delta/CVD from trade aggressor side (isBuyerMaker). Not reconstructed from OHLC.',
    tone: 'gold',
  },
  'tpo-ohlc': {
    label: 'TPO from OHLC',
    title: 'Period letters from candle high–low blocks. Tick-true profile requires Cluster/Footprint + live trades.',
    tone: 'warn',
  },
  'ring-buffer': {
    label: 'ring buffer',
    title: 'In-memory window only; older ticks need trade archive (IndexedDB).',
    tone: 'muted',
  },
  'archive-only': {
    label: 'archive ticks',
    title: 'Replay seeks stored trades only — no synthetic fills or interpolated prices.',
    tone: 'gold',
  },
  'synthetic-none': {
    label: 'no synthetic',
    title: 'No invented ticks, fills, or book levels.',
    tone: 'muted',
  },
  'feed-limit': {
    label: 'feed limits',
    title: 'Subject to venue rate limits, gaps, and throttle policy — see Ops / Feed health.',
    tone: 'muted',
  },
}

const TONE: Record<string, string> = {
  gold: 'border-[#f0b90b]/45 text-[#f0b90b] bg-[#f0b90b]/08',
  muted: 'border-[#2b3139] text-[#848e9c] bg-[#12161c]',
  warn: 'border-[#f0b90b]/35 text-[#c8cdd5] bg-[#1a1508]',
}

export function MetricHonestyBadge({
  kind,
  className = '',
}: {
  kind: MetricHonestyKind
  className?: string
}) {
  const c = COPY[kind]
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-medium uppercase tracking-wide ${TONE[c.tone]} ${className}`}
      title={c.title}
    >
      {c.label}
    </span>
  )
}

export function MetricHonestyRow({
  kinds,
  className = '',
}: {
  kinds: MetricHonestyKind[]
  className?: string
}) {
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {kinds.map((k) => (
        <MetricHonestyBadge key={k} kind={k} />
      ))}
    </div>
  )
}
