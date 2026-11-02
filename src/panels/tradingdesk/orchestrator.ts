/**
 * Trading Desk orchestrator — routes a user brief across specialist agents.
 * Local engines always run; optional LLM polish via existing aiApi settings.
 */

import type { Candle } from '@/types'
import {
  callAiChat,
  loadAiSettings,
  type AiApiSettings,
} from '@/analysis/aiDesk/aiApi'
import type { AiMode } from '@/analysis/aiDesk/chatEngine'
import {
  buildAnalysis,
  reportToText,
  runOrderflow,
  runRisk,
  runSentiment,
  runTechnical,
  runTrader,
  synthesizeOrchestrator,
  type DeskAnalysisBundle,
} from './agents'
import type {
  AgentReport,
  DeskAgentId,
  DeskMarketContext,
  DeskMessage,
  DeskTask,
} from './types'

export interface DeskRunResult {
  messages: DeskMessage[]
  tasks: DeskTask[]
  reports: AgentReport[]
  floorBrief: AgentReport
  bundle: DeskAnalysisBundle
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function msg(
  role: DeskMessage['role'],
  text: string,
  agentId?: DeskAgentId
): DeskMessage {
  return { id: uid('m'), role, agentId, text, ts: Date.now() }
}

function task(title: string, assignee: DeskAgentId): DeskTask {
  return { id: uid('t'), title, assignee, status: 'queued' }
}

/** Map free-text intent → which specialists to wake. */
export function planSpecialists(userText: string): DeskAgentId[] {
  const q = userText.trim().toLowerCase()
  if (!q || /\b(brief|status|floor|desk|tutto|overview|riassunto)\b/.test(q)) {
    return ['technical', 'orderflow', 'risk', 'sentiment', 'trader']
  }
  const out: DeskAgentId[] = []
  if (/\b(tech|structure|s\/r|fib|bias|trend|bos|fvg|ob)\b/.test(q)) out.push('technical')
  if (/\b(flow|orderflow|tape|liquidit|imbalance|delta|cvd)\b/.test(q)) out.push('orderflow')
  if (/\b(risk|stop|sl|tp|rr|size|rischio)\b/.test(q)) out.push('risk')
  if (/\b(sent|macro|news|regime|sentiment)\b/.test(q)) out.push('sentiment')
  if (/\b(trade|entry|setup|long|short|piano)\b/.test(q)) out.push('trader')
  if (out.length === 0) {
    return ['technical', 'orderflow', 'risk', 'trader']
  }
  if (!out.includes('trader') && out.length >= 2) out.push('trader')
  return out
}

async function maybeLlmPolish(
  report: AgentReport,
  userText: string,
  settings: AiApiSettings,
  mode: AiMode,
  bundle: DeskAnalysisBundle
): Promise<string> {
  if (settings.provider === 'local') return reportToText(report)
  try {
    const { text } = await callAiChat(
      `User asked: ${userText}\n\nSpecialist draft:\n${reportToText(report)}\n\nRewrite concise for a trading desk. Keep numbers. No buy/sell order. Italian or English matching the user.`,
      settings,
      mode,
      bundle.ta,
      bundle.smc,
      bundle.liq
    )
    return text
  } catch {
    return reportToText(report)
  }
}

/**
 * Full desk run: plan → specialists → trader → orchestrator synthesis.
 */
export async function runDeskBriefing(
  userText: string,
  candles: Candle[],
  ctx: DeskMarketContext,
  onProgress?: (agentId: DeskAgentId, status: 'thinking' | 'ready' | 'error') => void
): Promise<DeskRunResult> {
  const settings = loadAiSettings()
  const specialists = planSpecialists(userText)
  const bundle = buildAnalysis(candles, ctx)
  const messages: DeskMessage[] = [
    msg(
      'sys',
      `Michael routes to: ${specialists.join(', ')} · ${ctx.symbol} ${ctx.interval} · ${candles.length} candles`
    ),
  ]
  const tasks: DeskTask[] = specialists.map((id) => task(`Brief ${id}`, id))
  const reports: AgentReport[] = []

  const runners: Record<
    Exclude<DeskAgentId, 'orchestrator' | 'trader'>,
    (b: DeskAnalysisBundle) => AgentReport
  > = {
    technical: runTechnical,
    orderflow: runOrderflow,
    risk: runRisk,
    sentiment: runSentiment,
  }

  for (const id of specialists) {
    if (id === 'trader' || id === 'orchestrator') continue
    const t = tasks.find((x) => x.assignee === id)
    if (t) t.status = 'running'
    onProgress?.(id, 'thinking')
    try {
      const runner = runners[id as keyof typeof runners]
      if (!runner) continue
      const report = runner(bundle)
      const polished = await maybeLlmPolish(report, userText, settings, 'technical', bundle)
      report.bullets = polished
        .split('\n')
        .map((l) => l.replace(/^[#*\-•\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 8)
      reports.push(report)
      if (t) {
        t.status = 'done'
        t.result = report.bullets[0]
      }
      messages.push(msg('agent', reportToText(report), id))
      onProgress?.(id, 'ready')
    } catch (e) {
      if (t) t.status = 'failed'
      onProgress?.(id, 'error')
      messages.push(
        msg('agent', `Error: ${e instanceof Error ? e.message : 'failed'}`, id)
      )
    }
  }

  if (specialists.includes('trader')) {
    onProgress?.('trader', 'thinking')
    const t = tasks.find((x) => x.assignee === 'trader')
    if (t) t.status = 'running'
    const traderReport = runTrader(bundle, reports)
    const polished = await maybeLlmPolish(
      traderReport,
      userText,
      settings,
      'risk',
      bundle
    )
    traderReport.bullets = polished
      .split('\n')
      .map((l) => l.replace(/^[#*\-•\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 8)
    reports.push(traderReport)
    if (t) {
      t.status = 'done'
      t.result = traderReport.bullets[0]
    }
    messages.push(msg('agent', reportToText(traderReport), 'trader'))
    onProgress?.('trader', 'ready')
  }

  onProgress?.('orchestrator', 'thinking')
  const floorBrief = synthesizeOrchestrator(bundle, reports)
  const floorText = await maybeLlmPolish(
    floorBrief,
    userText,
    settings,
    'technical',
    bundle
  )
  floorBrief.bullets = floorText
    .split('\n')
    .map((l) => l.replace(/^[#*\-•\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 10)
  messages.push(msg('agent', reportToText(floorBrief), 'orchestrator'))
  onProgress?.('orchestrator', 'ready')

  return { messages, tasks, reports, floorBrief, bundle }
}
