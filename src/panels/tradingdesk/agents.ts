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
    id: 'masterchief',
    name: 'Master Chief',
    role: 'Position Chief',
    color: '#00e5a8',
    accent: '#0a2e24',
    tagline: 'Big screen · entry/exit calls · size',
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
    tagline: 'Setup summary · execution plan',
  },
  {
    id: 'news',
    name: 'Pam',
    role: 'News Analyst',
    color: '#22d3ee',
    accent: '#0a2a2e',
    tagline: 'Headlines · event risk · calendar',
  },
  {
    id: 'analyst',
    name: 'Oscar',
    role: 'Market Analyst',
    color: '#94a3b8',
    accent: '#1a2030',
    tagline: 'Full picture · cross-asset · levels',
  },
  {
    id: 'strategist',
    name: 'Kelly',
    role: 'Strategist',
    color: '#e879f9',
    accent: '#2a0a2e',
    tagline: 'Multi-TF plan · scenario tree',
  },
  {
    id: 'quant',
    name: 'Creed',
    role: 'Quant',
    color: '#84cc16',
    accent: '#1a2e0a',
    tagline: 'Stats edge · volatility · expectancy',
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

export function buildAnalysis(candles: Candle[], ctx: DeskMarketContext): DeskAnalysisBundle {
  const safe = Array.isArray(candles) ? candles : []
  const ta = safe.length >= 5 ? analyzeCandles(safe) : null
  const smc = safe.length >= 10 ? analyzeSmc(safe) : null
  const liq = safe.length >= 10 ? analyzeLiquidity(safe) : null
  return { ta, smc, liq, ctx }
}

function mapLiqBias(b: string | undefined): AgentReport['bias'] {
  const s = String(b || '').toLowerCase()
  if (s.includes('buy') || s.includes('long') || s.includes('bull')) return 'bullish'
  if (s.includes('sell') || s.includes('short') || s.includes('bear')) return 'bearish'
  return 'neutral'
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
    `Bias: **${ta.bias ?? 'neutral'}** · range pos ${fmt(ta.rangePos, 0)}%`,
    ...(ta.summary ?? []).slice(0, 6),
  ]
  if (ta.supports?.[0] != null) bullets.push(`Nearest support ~ ${fmt(ta.supports[0])}`)
  if (ta.resistances?.[0] != null) bullets.push(`Nearest resistance ~ ${fmt(ta.resistances[0])}`)
  if (smc?.breaks?.length) {
    const last = smc.breaks[smc.breaks.length - 1]!
    bullets.push(`Structure: last ${String(last.kind).toUpperCase()} ${last.direction} @ ${fmt(last.price)}`)
  }
  return {
    agentId: 'technical',
    title: `Technical · ${ctx.symbol} ${ctx.interval}`,
    bullets,
    bias: (ta.bias as AgentReport['bias']) ?? 'neutral',
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
  const atrProxy = Math.abs((ta.last.high - ta.last.low) || close * 0.005)
  const bullets = [
    `Spot ${fmt(close)} · bar range ~ ${fmt(atrProxy)}`,
    ta.supports?.[0] != null ? `Structural stop region under ~ ${fmt(ta.supports[0])}` : 'Define stop under last swing low',
    ta.resistances?.[0] != null ? `Take-profit region toward ~ ${fmt(ta.resistances[0])}` : 'Target prior swing high',
    `Bias ${ta.bias}: size down if mid-range (pos ${fmt(ta.rangePos, 0)}%).`,
    'Hard rule: plan risk first; never move stop against you.',
  ]
  return {
    agentId: 'risk',
    title: `Risk · ${ctx.symbol}`,
    bullets,
    bias: (ta.bias as AgentReport['bias']) ?? 'neutral',
    confidence: 0.5,
  }
}

export function runSentiment(bundle: DeskAnalysisBundle): AgentReport {
  const { ta, ctx } = bundle
  const bias = ta?.bias ?? 'neutral'
  return {
    agentId: 'sentiment',
    title: `Sentiment · ${ctx.symbol}`,
    bullets: [
      `Regime read from price action: **${bias}**`,
      'Crypto beta: risk-on lifts alts; risk-off compresses into BTC.',
      'Avoid stacking discretionary size into event windows.',
      ta?.last ? `Last ${fmt(ta.last.close)} on ${ctx.interval}` : 'Waiting price.',
    ],
    bias: bias as AgentReport['bias'],
    confidence: 0.4,
  }
}

export function runTrader(bundle: DeskAnalysisBundle, prior: AgentReport[]): AgentReport {
  const { ta, ctx } = bundle
  if (!ta?.last) {
    return {
      agentId: 'trader',
      title: 'Trader — flat',
      bullets: ['No setup without data.'],
      bias: 'neutral',
      confidence: 0,
    }
  }
  const votes = (prior ?? []).map((p) => p.bias).filter(Boolean)
  const bull = votes.filter((v) => v === 'bullish').length
  const bear = votes.filter((v) => v === 'bearish').length
  const bias: AgentReport['bias'] =
    bull > bear ? 'bullish' : bear > bull ? 'bearish' : ((ta.bias as AgentReport['bias']) ?? 'neutral')
  const bullets = [
    `Setup lean: **${bias}** (desk votes B${bull}/S${bear})`,
    `Entry idea near ${fmt(ta.last.close)} with structure stops`,
    ta.supports?.[0] != null ? `Invalidation under ${fmt(ta.supports[0])}` : 'Invalidation: swing low',
    ta.resistances?.[0] != null ? `Primary target ${fmt(ta.resistances[0])}` : 'Target: range high',
    'Execute only if RR ≥ 1.5 after fees.',
  ]
  return {
    agentId: 'trader',
    title: `Trader · ${ctx.symbol}`,
    bullets,
    bias,
    confidence: 0.55,
  }
}

export function synthesizeOrchestrator(bundle: DeskAnalysisBundle, reports: AgentReport[]): AgentReport {
  const { ctx, ta } = bundle
  const bias = ta?.bias ?? 'neutral'
  const bullets = [
    `Floor brief ${ctx.symbol} ${ctx.interval}: composite **${bias}**`,
    ...(reports ?? []).slice(0, 5).map((r) => `${r.agentId}: ${(r.bullets && r.bullets[0]) || r.title}`),
    'Next: confirm levels on chart, then size from risk desk.',
  ]
  return {
    agentId: 'orchestrator',
    title: `Orchestrator · floor`,
    bullets,
    bias: bias as AgentReport['bias'],
    confidence: 0.5,
  }
}

export function runNews(bundle: DeskAnalysisBundle): AgentReport {
  const { ta, ctx } = bundle
  const bias = ta?.bias ?? 'neutral'
  const bullets = [
    `Event risk window on **${ctx.symbol}** (${ctx.interval}).`,
    'Watch macro prints / exchange news that move crypto beta.',
    ta?.last
      ? `Spot ${fmt(ta.last.close)} · technical backdrop **${bias}** — news can override.`
      : 'Waiting price frame for news overlay.',
    'Rule: reduce size 30–50% into high-impact events; widen stops or stand aside.',
    'Post-news: wait first 15–30m for fakeout, then trade continuation or fade.',
  ]
  return {
    agentId: 'news',
    title: `News Analyst · ${ctx.symbol}`,
    bullets,
    bias: bias as AgentReport['bias'],
    confidence: 0.4,
  }
}

export function runAnalyst(bundle: DeskAnalysisBundle): AgentReport {
  const { ta, smc, liq, ctx } = bundle
  if (!ta?.last) {
    return {
      agentId: 'analyst',
      title: 'Analyst — waiting',
      bullets: ['Need candles for full picture.'],
      bias: 'neutral',
      confidence: 0,
    }
  }
  const bullets = [
    `Composite: TA **${ta.bias}** · liq **${liq?.bias ?? 'n/a'}**`,
    ...(ta.summary ?? []).slice(0, 4),
    smc?.breaks?.length
      ? `Last structure: ${String(smc.breaks[smc.breaks.length - 1]!.kind)} ${smc.breaks[smc.breaks.length - 1]!.direction}`
      : 'No fresh BOS/CHOCH in window.',
    `Range position ${fmt(ta.rangePos, 0)}% — context for mean-revert vs trend.`,
  ]
  return {
    agentId: 'analyst',
    title: `Market Analyst · ${ctx.symbol} ${ctx.interval}`,
    bullets,
    bias: (ta.bias as AgentReport['bias']) ?? 'neutral',
    confidence: 0.58,
  }
}

export function runStrategist(bundle: DeskAnalysisBundle): AgentReport {
  const { ta, ctx } = bundle
  if (!ta?.last) {
    return {
      agentId: 'strategist',
      title: 'Strategist — no plan',
      bullets: ['No candles → no scenario tree.'],
      bias: 'neutral',
      confidence: 0,
    }
  }
  const close = ta.last.close
  const sup = ta.supports?.[0]
  const res = ta.resistances?.[0]
  const bullets = [
    `Base case: bias **${ta.bias}** on ${ctx.interval}.`,
    res != null ? `Bull scenario: accept above ${fmt(res)} → trail.` : 'Bull scenario: break range high → trail.',
    sup != null ? `Bear scenario: lose ${fmt(sup)} → cut / flip plan.` : 'Bear scenario: lose range low → cut.',
    `Invalidation: opposite structure break vs ${fmt(close)}.`,
    'Only one primary scenario live; secondary is hedge or flat.',
  ]
  return {
    agentId: 'strategist',
    title: `Strategist · ${ctx.symbol}`,
    bullets,
    bias: (ta.bias as AgentReport['bias']) ?? 'neutral',
    confidence: 0.52,
  }
}

export function runQuant(bundle: DeskAnalysisBundle): AgentReport {
  const { ta, ctx } = bundle
  if (!ta?.last) {
    return {
      agentId: 'quant',
      title: 'Quant — no sample',
      bullets: ['Insufficient bars for stats edge.'],
      bias: 'neutral',
      confidence: 0,
    }
  }
  const atrProxy = Math.abs((ta.last.high - ta.last.low) || ta.last.close * 0.005)
  const bullets = [
    `Vol proxy (bar range): ${fmt(atrProxy)} (~${fmt((atrProxy / ta.last.close) * 100, 2)}% of price)`,
    `Range pos ${fmt(ta.rangePos, 0)}% — mean-revert edge higher near extremes.`,
    `Bias alignment: **${ta.bias}** — trade with edge, skip mid-range chop.`,
    'Expectancy tip: fixed R multiple ≥ 1.5R; cut losers at plan, not hope.',
    'Sample: prefer ≥20 bars same session style before sizing up.',
  ]
  return {
    agentId: 'quant',
    title: `Quant · ${ctx.symbol}`,
    bullets,
    bias: (ta.bias as AgentReport['bias']) ?? 'neutral',
    confidence: 0.5,
  }
}

export function runMasterChief(bundle: DeskAnalysisBundle): AgentReport {
  const { ta, liq, smc, ctx } = bundle
  if (!ta?.last) {
    return {
      agentId: 'masterchief',
      title: 'Master Chief — hold fire',
      bullets: ['No market data. Do not enter.'],
      bias: 'neutral',
      confidence: 0,
    }
  }
  const close = ta.last.close
  const sup = ta.supports?.[0]
  const res = ta.resistances?.[0]
  const bias = (ta.bias as AgentReport['bias']) ?? 'neutral'
  const liqBias = liq?.bias ?? 'neutral'
  const aligned =
    (bias === 'bullish' && String(liqBias).toLowerCase().includes('buy')) ||
    (bias === 'bearish' && String(liqBias).toLowerCase().includes('sell')) ||
    bias !== 'neutral'
  const bullets: string[] = [
    `CALL: **${String(bias).toUpperCase()}** on ${ctx.symbol} ${ctx.interval} @ ${fmt(close)}`,
  ]
  if (bias === 'bullish') {
    bullets.push(sup != null ? `ENTRY zone: pullback toward ${fmt(sup)}–${fmt(close)}` : `ENTRY: on hold above structure`)
    bullets.push(res != null ? `TP1: ${fmt(res)} · trail after` : 'TP: prior swing high / measured move')
    bullets.push(sup != null ? `STOP: below ${fmt(sup)} (structure invalidation)` : 'STOP: below last swing low')
  } else if (bias === 'bearish') {
    bullets.push(res != null ? `ENTRY zone: reject ${fmt(res)}–${fmt(close)}` : 'ENTRY: on hold below structure')
    bullets.push(sup != null ? `TP1: ${fmt(sup)} · trail after` : 'TP: prior swing low')
    bullets.push(res != null ? `STOP: above ${fmt(res)}` : 'STOP: above last swing high')
  } else {
    bullets.push('NO TRADE — mid-range / mixed signals. Wait trigger.')
  }
  bullets.push(`Liquidity: ${liqBias} · size: ${aligned ? 'standard' : 'half'} until confirmation`)
  if (smc?.breaks?.length) {
    const last = smc.breaks[smc.breaks.length - 1]!
    bullets.push(`Structure note: ${String(last.kind)} ${last.direction} @ ${fmt(last.price)}`)
  }
  bullets.push('Master Chief rule: one plan, hard stop, no average-down without new thesis.')
  return {
    agentId: 'masterchief',
    title: `Master Chief · POSITION CALL · ${ctx.symbol}`,
    bullets,
    bias,
    confidence: aligned ? 0.62 : 0.45,
  }
}

export function reportToText(r: AgentReport): string {
  const head = `**${r.title}**${r.bias ? ` · ${r.bias}` : ''}`
  return [head, ...(r.bullets ?? []).map((b) => `• ${b}`)].join('\n')
}

export function buildFullAssetReport(candles: Candle[], ctx: DeskMarketContext): string {
  try {
    const bundle = buildAnalysis(candles || [], ctx)
    const parts = [`# Full report · ${ctx.symbol} ${ctx.interval} · ${ctx.exchange}`]
    for (const runner of [runTechnical, runOrderflow, runRisk, runMasterChief]) {
      try {
        parts.push(reportToText(runner(bundle)))
      } catch (e) {
        parts.push(`• ${runner.name}: ${e instanceof Error ? e.message : 'failed'}`)
      }
    }
    if (!candles?.length) {
      parts.push('• No candle data yet — link a chart or wait for market feed.')
    }
    return parts.join('\n\n')
  } catch (e) {
    return `Full report unavailable: ${e instanceof Error ? e.message : 'unknown error'}`
  }
}
