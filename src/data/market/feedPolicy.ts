/**
 * Production feed policy: SLA thresholds, fallback venues, resync rules.
 * Client-side only — real public APIs, no mocked ticks.
 */

import type { ExchangeId } from '@/types'

/** Soft/hard SLA for lag and staleness (ms). */
export const FEED_SLA = {
  /** Book considered degraded above this age */
  bookStaleMs: 3_000,
  /** Book hard-fail / force resync above this */
  bookDeadMs: 12_000,
  /** Trade/tick stale */
  tickStaleMs: 5_000,
  tickDeadMs: 20_000,
  /** Latency p99 soft warning */
  latencyP99WarnMs: 800,
  /** Latency p99 critical */
  latencyP99CritMs: 2_500,
  /** Max gaps in a sliding window before alert */
  gapWarnCount: 3,
  gapWindowMs: 60_000,
} as const

/** Preferred fallback order when primary venue fails REST/history. */
export const HISTORY_FALLBACK_CHAIN: ExchangeId[] = [
  'binance',
  'binance_futures',
  'bybit',
  'okx',
  'kucoin',
]

export function fallbackChainFor(primary: ExchangeId): ExchangeId[] {
  const rest = HISTORY_FALLBACK_CHAIN.filter((e) => e !== primary)
  return [primary, ...rest]
}

/** Resync / history load policy */
export const RESYNC_POLICY = {
  /** Initial history pages on connect (most recent first) */
  initialPages: 2,
  /** Max pages when user loads deeper history */
  maxPagesDeep: 20,
  /** Pause between REST pages (rate-limit friendly) */
  pagePauseMs: 150,
  /** Abort stale in-flight history after */
  historyTimeoutMs: 25_000,
  /** Min interval between automatic book resyncs */
  minBookResyncMs: 2_000,
  /** Max concurrent history fetches app-wide */
  maxConcurrentHistory: 2,
} as const

/** Order book / trade stream quality under load */
export const STREAM_POLICY = {
  /** Max trades buffered to UI per second (excess dropped with counter) */
  tradeEmitHz: 40,
  /** Max book snapshots emitted to UI per second */
  bookEmitHz: 15,
  /** Depth levels kept in local book (per side) */
  bookDepthLevels: 50,
  /** Drop book diffs if queue grows beyond this (backpressure) */
  bookDiffQueueMax: 200,
  /** Coalesce book UI updates within this window (ms) */
  bookCoalesceMs: 50,
} as const

export type SlaLevel = 'ok' | 'warn' | 'crit'

export function evaluateSla(input: {
  bookAgeMs: number | null
  tickAgeMs: number | null
  latencyP99: number | null
  gapsRecent: number
}): { level: SlaLevel; reasons: string[] } {
  const reasons: string[] = []
  let level: SlaLevel = 'ok'

  const bump = (l: SlaLevel) => {
    if (l === 'crit') level = 'crit'
    else if (l === 'warn' && level === 'ok') level = 'warn'
  }

  if (input.bookAgeMs != null) {
    if (input.bookAgeMs > FEED_SLA.bookDeadMs) {
      reasons.push('book dead')
      bump('crit')
    } else if (input.bookAgeMs > FEED_SLA.bookStaleMs) {
      reasons.push('book stale')
      bump('warn')
    }
  }
  if (input.tickAgeMs != null) {
    if (input.tickAgeMs > FEED_SLA.tickDeadMs) {
      reasons.push('tick dead')
      bump('crit')
    } else if (input.tickAgeMs > FEED_SLA.tickStaleMs) {
      reasons.push('tick stale')
      bump('warn')
    }
  }
  if (input.latencyP99 != null) {
    if (input.latencyP99 > FEED_SLA.latencyP99CritMs) {
      reasons.push('p99 latency crit')
      bump('crit')
    } else if (input.latencyP99 > FEED_SLA.latencyP99WarnMs) {
      reasons.push('p99 latency warn')
      bump('warn')
    }
  }
  if (input.gapsRecent >= FEED_SLA.gapWarnCount) {
    reasons.push(`gaps ${input.gapsRecent}`)
    bump('warn')
  }

  return { level, reasons }
}
