/**
 * Desk agent roster + local specialist pipelines.
 * Uses existing TA / SMC / liquidity engines — no invented prices.
 */

import type { Candle } from '@/types'
import { analyzeCandles, type TaReport } from '@/analysis/aiDesk/taEngine'
import { analyzeSmc, type SmcReport } from '@/analysis/aiDesk/smcEngine'
import { analyzeLiquidity, type LiquidityReport } from '@/analysis/aiDesk/liquidityEngine'
import type {
  AgentReport,
  DeskAgentId,
  DeskAgentMeta,
  DeskMarketContext,
} from './types'

export const DESK_AGENTS: DeskAgentMeta[] = [
  {
    id: 'orchestrator',
    name: 'Michael',
    role: 'Orchestrator',
    color: '#f0b90b',
    accent: '#3d2e0a',
    tagline: 'Routes work · synthesizes the floor',
  },
  {
    id: 'technical',
    name: 'Dwight',
    role: 'Technical',
    color: '#0ecb81',
    accent: '#0a2e1f',
    tagline: 'Structure · S/R · fib · bias',
  },
  {
    id: 'orderflow',
    name: 'Jim',
    role: 'Orderflow',
    color: '#3b82f6',
    accent: '#0c1a33',
    tagline: 'Liquidity · imbalance · tape bias',
  },
  {
    id: 'risk',
    name: 'Angela',
    role: 'Risk',
    color: '#f6465d',
    accent: '#2e0a12',
    tagline: 'Stops · RR · size framing',
  },
  {
    id: 'sentiment',
    name: 'Ryan',
    role: 'Sentiment',
    color: '#a855f7',
    accent: '#1f0a2e',
    tagline: 'Macro context · regime read',
  },
  {
    id: 'trader',
    name: 'Stanley',
    role: 'Trader',
    color: '#f59e0b',
    accent: '#2e200a',
    tagline: 'Setup summary · paper framing only',
  },
]

export function agentMeta(id: DeskAgentId): DeskAgentMeta {
  return DESK_AGENTS.find((a) => a.id === id) ?? DESK_AGENTS[0]!
}

function fmt(n: number | null | undefined, d = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(d)
}

export interface DeskAnalysisBundle {
  ta: TaReport | null
  smc: SmcReport | null
  liq: LiquidityReport | null
  ctx: DeskMarketContext
}

function mapLiqBias(b: string | undefined): 'bullish' | 'bearish' | 'neutral' {
  if (b === 'long') return 'bullish'
  if (b === 'short') return 'bearish'
  return 'neutral'
}

export function buildAnalysis(
  candles: Candle[],
  ctx: DeskMarketContext
): DeskAnalysisBundle {
  if (!candles || candles.length < 8) {
    return { ta: null, smc: null, liq: null, ctx }
  }
  const ta = analyzeCandles(candles, ctx.symbol, ctx.interval)
  const smc = analyzeSmc(candles)
  const liq = analyzeLiquidity(candles, null, [])
  return { ta, smc, liq, ctx }
}

export function runTechnical(bundle: DeskAnalysisBundle): AgentReport {
  const { ta, smc, ctx } = bundle
  if (!ta?.last) {
    return {
      agentId: 'technical',
      title: 'Technical — waiting for data',
      bullets: [`No candles yet for ${ctx.symbol} ${ctx.interval}.`],
      bias: 'neutral',
      confidence: 0,
    }
  }
  const bullets = [
    `Bias: **${ta.bias}** · range pos ${fmt(ta.rangePos, 0)}%`,
    ...ta.summary.slice(0, 6),
  ]
  if (ta.supports[0] != null) bullets.push(`Nearest support ~ ${fmt(ta.supports[0])}`)
  if (ta.resistances[0] != null) bullets.push(`Nearest resistance ~ ${fmt(ta.resistances[0])}`)
  if (smc?.breaks?.length) {
    const last = smc.breaks[smc.breaks.length - 1]!
    bullets.push(
      `Structure: last ${String(last.kind).toUpperCase()} ${last.direction} @ ${fmt(last.price)}`
    )
  }
  return {
    agentId: 'technical',
    title: `Technical · ${ctx.symbol} ${ctx.interval}`,
    bullets,
    bias: ta.bias,
    confidence: 0.55,
  }
}

export function runOrderflow(bundle: DeskAnalysisBundle): AgentReport {
  const { liq, ctx } = bundle
  if (!liq) {
    return {
      agentId: 'orderflow',
      title: 'Orderflow — waiting',
      bullets: ['Need more candles for liquidity map.'],
      bias: 'neutral',
      confidence: 0,
    }
  }
  const mapped = mapLiqBias(liq.bias)
  const bullets = [
    `Liquidity bias: **${liq.bias}** (score ${fmt(liq.score, 2)})`,
    ...(liq.summary ?? []).slice(0, 6),
  ]
  return {
    agentId: 'orderflow',
    title: `Orderflow · ${ctx.symbol}`,
    bullets,
    bias: mapped,
    confidence: Math.min(0.75, 0.35 + Math.abs(liq.score ?? 0) * 0.15),
  }
}

export function runRisk(bundle: DeskAnalysisBundle): AgentReport {
  const { ta, ctx } = bundle
  if (!ta?.last) {
    return {
      agentId: 'risk',
      title: 'Risk — no frame',
      bullets: ['No price frame until candles arrive.'],
      bias: 'neutral',
      confidence: 0,
    }
  }
  const close = ta.last.close
  const atrProxy =
    ta.supports[0] != null && ta.resistances[0] != null
      ? Math.abs(ta.resistances[0] - ta.supports[0])
      : close * 0.01
  const bullets = [
    `Last ${fmt(close, close > 100 ? 1 : 4)} · ATR-proxy zone ~ ${fmt(atrProxy, close > 100 ? 1 : 4)}`,
    ta.supports[0] != null
      ? `Invalidation long (paper) under ~ ${fmt(ta.supports[0])}`
      : 'Support not mapped',
    ta.resistances[0] != null
      ? `Invalidation short (paper) above ~ ${fmt(ta.resistances[0])}`
      : 'Resistance not mapped',
    'Size framing only — no live orders from this desk.',
  ]
  return {
    agentId: 'risk',
    title: `Risk frame · ${ctx.symbol}`,
    bullets,
    bias: ta.bias,
    confidence: 0.5,
  }
}

export function runSentiment(bundle: DeskAnalysisBundle): AgentReport {
  const { ta, ctx } = bundle
  const bias = ta?.bias ?? 'neutral'
  const bullets = [
    `Regime read from price structure: **${bias}** on ${ctx.interval}`,
    ta?.summary?.[0] ?? 'Waiting for richer bar history for macro lean.',
    'Sentiment here is structure-derived, not news NLP.',
  ]
  return {
    agentId: 'sentiment',
    title: `Sentiment · ${ctx.symbol}`,
    bullets,
    bias,
    confidence: 0.4,
  }
}

export function runTrader(bundle: DeskAnalysisBundle, prior: AgentReport[]): AgentReport {
  const { ta, ctx } = bundle
  const biasVotes = prior.map((p) => p.bias).filter(Boolean)
  const bull = biasVotes.filter((b) => b === 'bullish').length
  const bear = biasVotes.filter((b) => b === 'bearish').length
  const bias =
    bull > bear ? 'bullish' : bear > bull ? 'bearish' : ta?.bias ?? 'neutral'
  const bullets = [
    `Desk lean: **${bias}** (${bull} bull / ${bear} bear specialists)`,
    ta?.last
      ? `Anchor price ${fmt(ta.last.close, ta.last.close > 100 ? 1 : 4)}`
      : 'No anchor price',
    'Paper setup only — confirm on chart before any discretionary action.',
  ]
  if (ta?.supports[0] != null && ta?.resistances[0] != null) {
    bullets.push(
      `Watch zone ${fmt(ta.supports[0])} — ${fmt(ta.resistances[0])}`
    )
  }
  return {
    agentId: 'trader',
    title: `Setup summary · ${ctx.symbol}`,
    bullets,
    bias,
    confidence: 0.45 + Math.min(0.25, Math.abs(bull - bear) * 0.08),
  }
}

export function synthesizeOrchestrator(
  bundle: DeskAnalysisBundle,
  reports: AgentReport[]
): AgentReport {
  const { ctx, ta } = bundle
  const bias =
    reports.find((r) => r.agentId === 'trader')?.bias ?? ta?.bias ?? 'neutral'
  const bullets = [
    `Floor brief ${ctx.symbol} ${ctx.interval}: lean **${bias}**`,
    ...reports.flatMap((r) => (r.bullets[0] ? [`${r.agentId}: ${r.bullets[0]}`] : [])).slice(0, 6),
  ]
  return {
    agentId: 'orchestrator',
    title: `Floor brief · ${ctx.symbol}`,
    bullets,
    bias,
    confidence: 0.5,
  }
}

export function reportToText(r: AgentReport): string {
  const head = [
    `══ ${r.title} ══`,
    r.bias
      ? `Bias: ${r.bias.toUpperCase()}${
          r.confidence != null ? ` · conf ~ ${Math.round(r.confidence * 100)}%` : ''
        }`
      : null,
    '',
  ].filter((x) => x !== null) as string[]
  const body = r.bullets.map((b) => `• ${b}`)
  return [...head, ...body].join('\n')
}

/** Full multi-section desk report for an asset (user-requested depth). */
export function buildFullAssetReport(
  candles: Candle[],
  ctx: DeskMarketContext
): string {
  const bundle = buildAnalysis(candles, ctx)
  const tech = runTechnical(bundle)
  const of = runOrderflow(bundle)
  const risk = runRisk(bundle)
  const sent = runSentiment(bundle)
  const trader = runTrader(bundle, [tech, of, risk, sent])
  const floor = synthesizeOrchestrator(bundle, [tech, of, risk, sent, trader])
  const last = candles.length ? candles[candles.length - 1] : null
  const dec = last && last.close > 1000 ? 1 : last && last.close > 10 ? 2 : 4
  const lines: string[] = [
    `REPORT COMPLETO · ${ctx.symbol} · ${ctx.interval} · ${ctx.exchange}`,
    last
      ? `Prezzo ultimo: ${last.close.toFixed(dec)} (O ${last.open.toFixed(dec)} H ${last.high.toFixed(dec)} L ${last.low.toFixed(dec)})`
      : 'Prezzo: n/d',
    `Barre: ${ctx.candleCount}`,
    '',
    reportToText(tech),
    '',
    reportToText(of),
    '',
    reportToText(risk),
    '',
    reportToText(sent),
    '',
    reportToText(trader),
    '',
    reportToText(floor),
    '',
    '— Nota: report generato dal desk locale (TA + SMC + liquidità). Nessun ordine reale. —',
  ]
  return lines.join('\n')
}
