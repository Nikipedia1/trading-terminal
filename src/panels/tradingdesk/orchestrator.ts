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
  runNews,
  runAnalyst,
  runStrategist,
  runQuant,
  runMasterChief,
  synthesizeOrchestrator,
  buildFullAssetReport,
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
  if (!q || /\b(brief|status|floor|desk|tutto|overview|riassunto|report)\b/.test(q)) {
    return ['technical', 'orderflow', 'risk', 'sentiment', 'news', 'trader', 'masterchief']
  }
  const out: DeskAgentId[] = []
  if (/\b(tech|structure|s\/r|fib|bias|trend|bos|fvg|ob)\b/.test(q)) out.push('technical')
  if (/\b(flow|orderflow|tape|liquidit|imbalance|delta|cvd)\b/.test(q)) out.push('orderflow')
  if (/\b(risk|stop|sl|tp|rr|size|rischio)\b/.test(q)) out.push('risk')
  if (/\b(sent|macro|regime|sentiment)\b/.test(q)) out.push('sentiment')
  if (/\b(news|headline|calendar|evento|fomc|cpi)\b/.test(q)) out.push('news')
  if (/\b(analyst|analisi|picture|cross)\b/.test(q)) out.push('analyst')
  if (/\b(strateg|scenario|piano multi|timeframe plan)\b/.test(q)) out.push('strategist')
  if (/\b(quant|stat|volatil|expectancy|edge)\b/.test(q)) out.push('quant')
  if (/\b(chief|position|entry|exit|call|master)\b/.test(q)) out.push('masterchief')
  if (/\b(trade|setup|long|short|piano)\b/.test(q)) out.push('trader')
  if (out.length === 0) {
    return ['technical', 'orderflow', 'risk', 'trader', 'masterchief']
  }
  if (!out.includes('trader') && out.length >= 2) out.push('trader')
  if (!out.includes('masterchief') && /\b(long|short|entry|posizione)\b/.test(q)) out.push('masterchief')
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
      `User asked: ${userText}\n\nSpecialist ${report.agentId} draft:\n${reportToText(report)}\n\nPolish bullets only, keep facts, no invented prices.`,
      settings,
      mode
    )
    return text || reportToText(report)
  } catch {
    return reportToText(report)
  }
}

function bulletsFromPolish(polished: string, max: number): string[] {
  return String(polished || '')
    .split('\n')
    .map((l) => l.replace(/^[#*\-•\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, max)
}

export async function runDeskBriefing(
  userText: string,
  candles: Candle[],
  ctx: DeskMarketContext,
  onProgress?: (id: DeskAgentId, status: 'thinking' | 'ready' | 'error') => void
): Promise<DeskRunResult> {
  const settings = loadAiSettings()
  const specialists = planSpecialists(userText)
  const tasks = specialists.map((id) => task(`Brief · ${id}`, id))
  const messages: DeskMessage[] = [msg('sys', `Floor routing: ${specialists.join(' → ')}`)]
  const reports: AgentReport[] = []
  const bundle = buildAnalysis(candles || [], ctx)

  const runners = {
    technical: runTechnical,
    orderflow: runOrderflow,
    risk: runRisk,
    sentiment: runSentiment,
    news: runNews,
    analyst: runAnalyst,
    strategist: runStrategist,
    quant: runQuant,
    masterchief: runMasterChief,
  }

  try {
    const full = buildFullAssetReport(candles || [], ctx)
    messages.push(msg('agent', full, 'orchestrator'))
  } catch (e) {
    messages.push(msg('sys', `Full report skipped: ${e instanceof Error ? e.message : 'error'}`))
  }

  for (const id of specialists) {
    if (id === 'trader' || id === 'orchestrator' || id === 'masterchief') continue
    const t = tasks.find((x) => x.assignee === id)
    if (t) t.status = 'running'
    onProgress?.(id, 'thinking')
    try {
      const runner = runners[id as keyof typeof runners]
      if (!runner) continue
      const report = runner(bundle)
      const polished = await maybeLlmPolish(report, userText, settings, 'technical', bundle)
      report.bullets = bulletsFromPolish(polished, 14)
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
    try {
      const traderReport = runTrader(bundle, reports)
      const polished = await maybeLlmPolish(traderReport, userText, settings, 'risk', bundle)
      traderReport.bullets = bulletsFromPolish(polished, 14)
      reports.push(traderReport)
      if (t) {
        t.status = 'done'
        t.result = traderReport.bullets[0]
      }
      messages.push(msg('agent', reportToText(traderReport), 'trader'))
      onProgress?.('trader', 'ready')
    } catch (e) {
      if (t) t.status = 'failed'
      onProgress?.('trader', 'error')
      messages.push(msg('agent', `Trader error: ${e instanceof Error ? e.message : 'failed'}`, 'trader'))
    }
  }

  if (specialists.includes('masterchief')) {
    onProgress?.('masterchief', 'thinking')
    const t = tasks.find((x) => x.assignee === 'masterchief')
    if (t) t.status = 'running'
    try {
      const chiefReport = runMasterChief(bundle)
      const polished = await maybeLlmPolish(chiefReport, userText, settings, 'risk', bundle)
      chiefReport.bullets = bulletsFromPolish(polished, 16)
      reports.push(chiefReport)
      if (t) {
        t.status = 'done'
        t.result = chiefReport.bullets[0]
      }
      messages.push(msg('agent', reportToText(chiefReport), 'masterchief'))
      onProgress?.('masterchief', 'ready')
    } catch (e) {
      if (t) t.status = 'failed'
      onProgress?.('masterchief', 'error')
      messages.push(msg('agent', `Master Chief error: ${e instanceof Error ? e.message : 'failed'}`, 'masterchief'))
    }
  }

  onProgress?.('orchestrator', 'thinking')
  try {
    const floorBrief = synthesizeOrchestrator(bundle, reports)
    const floorText = await maybeLlmPolish(floorBrief, userText, settings, 'technical', bundle)
    floorBrief.bullets = bulletsFromPolish(floorText, 16)
    messages.push(msg('agent', reportToText(floorBrief), 'orchestrator'))
    onProgress?.('orchestrator', 'ready')
    return { messages, tasks, reports, floorBrief, bundle }
  } catch (e) {
    const fallback: AgentReport = {
      agentId: 'orchestrator',
      title: 'Orchestrator · floor',
      bullets: [`Floor brief error: ${e instanceof Error ? e.message : 'failed'}`],
      bias: 'neutral',
      confidence: 0,
    }
    messages.push(msg('agent', reportToText(fallback), 'orchestrator'))
    onProgress?.('orchestrator', 'error')
    return { messages, tasks, reports, floorBrief: fallback, bundle }
  }
}
