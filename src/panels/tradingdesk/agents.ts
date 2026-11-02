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
  const last = candles[candles.length - 1]
  return {
    ta,
    smc,
    liq,
    ctx: {
      ...ctx,
      lastPrice: last?.close ?? ctx.lastPrice,
      candleCount: candles.length,
    },
  }
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
    ...ta.summary.slice(0, 3),
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
    title: `Technical · ${ctx.symbol}`,
    bullets,
    bias: ta.bias,
    confidence: ta.bias === 'neutral' ? 0.45 : 0.62,
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
    ...(liq.summary ?? []).slice(0, 4),
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
  const slDist = atrProxy * 0.35
  const bullets = [
    `Frame around last **${fmt(close)}** (${ctx.interval})`,
    `Rough invalidation distance ~ **${fmt(slDist)}** (structure-based proxy, not advice)`,
    `Prefer defined invalidation before size; avoid chasing mid-range`,
    `This is risk framing only — not a trade recommendation`,
  ]
  return {
    agentId: 'risk',
    title: `Risk · ${ctx.symbol}`,
    bullets,
    bias: 'neutral',
    confidence: 0.5,
  }
}

export function runSentiment(bundle: DeskAnalysisBundle): AgentReport {
  const { ta, ctx } = bundle
  const bias = ta?.bias ?? 'neutral'
  const bullets = [
    `Regime read from price structure: **${bias}**`,
    `Symbol ${ctx.symbol} on ${ctx.exchange} · ${ctx.interval}`,
    `Candles in context: ${ctx.candleCount}`,
    `Sentiment here is structure-derived only (no external news feed in this pass)`,
  ]
  return {
    agentId: 'sentiment',
    title: `Sentiment · ${ctx.symbol}`,
    bullets,
    bias,
    confidence: 0.4,
  }
}

export function runTrader(bundle: DeskAnalysisBundle, reports: AgentReport[]): AgentReport {
  const { ta, ctx } = bundle
  const tech = reports.find((r) => r.agentId === 'technical')
  const of = reports.find((r) => r.agentId === 'orderflow')
  const agree =
    tech?.bias && of?.bias && tech.bias === of.bias && tech.bias !== 'neutral'
  const bullets = [
    `Desk alignment: ${agree ? `**${tech!.bias}** (tech + flow agree)` : '**mixed / neutral**'}`,
    ta?.last ? `Last print ~ **${fmt(ta.last.close)}**` : 'No last print',
    `Paper framing only — no order placement from this desk`,
    `If acting: wait for your own plan, invalidation, and size rules`,
  ]
  return {
    agentId: 'trader',
    title: `Trader · ${ctx.symbol}`,
    bullets,
    bias: agree ? tech!.bias : 'neutral',
    confidence: agree ? 0.55 : 0.35,
  }
}

export function synthesizeOrchestrator(
  bundle: DeskAnalysisBundle,
  reports: AgentReport[]
): AgentReport {
  const { ctx } = bundle
  const lines = reports
    .filter((r) => r.agentId !== 'orchestrator')
    .map((r) => {
      const m = agentMeta(r.agentId)
      return `**${m.name} (${m.role})**: ${r.bullets[0] ?? r.title}`
    })
  const biases = reports
    .map((r) => r.bias)
    .filter((b): b is NonNullable<typeof b> => !!b && b !== 'neutral')
  const bull = biases.filter((b) => b === 'bullish').length
  const bear = biases.filter((b) => b === 'bearish').length
  let floor: 'bullish' | 'bearish' | 'neutral' = 'neutral'
  if (bull > bear + 1) floor = 'bullish'
  else if (bear > bull + 1) floor = 'bearish'
  return {
    agentId: 'orchestrator',
    title: `Floor brief · ${ctx.symbol} ${ctx.interval}`,
    bullets: [
      `Floor lean: **${floor}**`,
      ...lines.slice(0, 5),
      `Disclaimer: interpretazione desk, non consiglio finanziario.`,
    ],
    bias: floor,
    confidence: 0.5,
  }
}

export function reportToText(r: AgentReport): string {
  return [`### ${r.title}`, ...r.bullets.map((b) => `• ${b}`)].join('\n')
}
