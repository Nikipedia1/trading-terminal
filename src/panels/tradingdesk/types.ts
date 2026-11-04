/** Trading Desk multi-agent types — Munder Difflin-style office for markets. */

export type DeskAgentId =
  | 'orchestrator'
  | 'masterchief'
  | 'technical'
  | 'orderflow'
  | 'risk'
  | 'sentiment'
  | 'trader'
  | 'news'
  | 'analyst'
  | 'strategist'
  | 'quant'

export type DeskAgentStatus = 'idle' | 'thinking' | 'ready' | 'error'

export interface DeskAgentMeta {
  id: DeskAgentId
  name: string
  role: string
  color: string
  accent: string
  /** Short one-liner shown on the floor card */
  tagline: string
}

export interface DeskAgentState {
  id: DeskAgentId
  status: DeskAgentStatus
  lastBrief: string
  updatedAt: number
}

export type DeskMsgRole = 'user' | 'agent' | 'sys'

export interface DeskMessage {
  id: string
  role: DeskMsgRole
  agentId?: DeskAgentId
  text: string
  ts: number
}

export interface DeskTask {
  id: string
  title: string
  assignee: DeskAgentId
  status: 'queued' | 'running' | 'done' | 'failed'
  result?: string
}

export interface DeskMarketContext {
  symbol: string
  interval: string
  exchange: string
  lastPrice: number | null
  candleCount: number
}

export interface AgentReport {
  agentId: DeskAgentId
  title: string
  bullets: string[]
  bias?: 'bullish' | 'bearish' | 'neutral'
  confidence?: number
}
