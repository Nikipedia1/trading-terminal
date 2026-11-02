/**
 * Autonomous desk loop: agents research assets, run local strategy checks, report to boss.
 * No real orders — analysis only.
 */

import type { Candle } from '@/types'
import { analyzeCandles } from '@/analysis/aiDesk/taEngine'
import { analyzeSmc } from '@/analysis/aiDesk/smcEngine'
import { analyzeLiquidity } from '@/analysis/aiDesk/liquidityEngine'
import type { DeskAgentId } from './types'
import { agentMeta } from './agents'

export const RESEARCH_UNIVERSE = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'NEARUSDT',
] as const

export type AutonomyActivity =
  | 'idle'
  | 'walking'
  | 'researching'
  | 'strategizing'
  | 'reporting'
  | 'meeting'

export interface AutonomyAgent {
  slotId: string
  agentId: DeskAgentId
  name: string
  role: string
  color: string
  x: number
  z: number
  targetX: number
  targetZ: number
  activity: AutonomyActivity
  asset: string
  screenLine: string
  lastReport: string
  strategyNote: string
  bias: 'bullish' | 'bearish' | 'neutral'
  nextThinkAt: number
}

export interface AutonomyReport {
  id: string
  fromSlot: string
  agentId: DeskAgentId
  name: string
  asset: string
  title: string
  body: string
  bias: 'bullish' | 'bearish' | 'neutral'
  ts: number
}

export interface DeskSlot {
  id: string
  agentId: DeskAgentId
  name: string
  role: string
  color: string
  homeX: number
  homeZ: number
  isBoss: boolean
}

const FLOOR_MIN = -5.2
const FLOOR_MAX = 5.2
function clampFloor(v: number) {
  return Math.max(FLOOR_MIN, Math.min(FLOOR_MAX, v))
}

const STRATEGY_LABELS = [
  'mean-reversion probe',
  'breakout watch',
  'liquidity sweep map',
  'structure BOS check',
  'range fade paper',
  'momentum continuation',
  'session VWAP lean',
]

function rnd<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function uid(p: string) {
  return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function defaultSlots(): DeskSlot[] {
  const roster: { id: DeskAgentId; boss?: boolean }[] = [
    { id: 'orchestrator', boss: true },
    { id: 'technical' },
    { id: 'orderflow' },
    { id: 'risk' },
    { id: 'sentiment' },
    { id: 'trader' },
  ]
  const slots: DeskSlot[] = []
  let i = 0
  for (const r of roster) {
    const m = agentMeta(r.id)
    const col = r.boss ? 0 : 1 + ((i - 1) % 3)
    const row = r.boss ? 0 : Math.floor((i - 1) / 3)
    slots.push({
      id: `slot-${r.id}`,
      agentId: r.id,
      name: m.name,
      role: m.role,
      color: m.color,
      homeX: clampFloor(r.boss ? -3.8 : -2.2 + col * 2.6),
      homeZ: clampFloor(r.boss ? -3.2 : -1.2 + row * 2.6),
      isBoss: !!r.boss,
    })
    i++
  }
  return slots
}

export function agentsFromSlots(slots: DeskSlot[], now = Date.now()): AutonomyAgent[] {
  return slots.map((s, idx) => ({
    slotId: s.id,
    agentId: s.agentId,
    name: s.name,
    role: s.role,
    color: s.color,
    x: s.homeX,
    z: s.homeZ,
    targetX: s.homeX,
    targetZ: s.homeZ,
    activity: 'idle' as AutonomyActivity,
    asset: RESEARCH_UNIVERSE[idx % RESEARCH_UNIVERSE.length]!,
    screenLine: 'boot…',
    lastReport: '',
    strategyNote: '',
    bias: 'neutral' as const,
    nextThinkAt: now + 800 + idx * 600 + Math.random() * 1200,
  }))
}

function pickStation(slots: DeskSlot[], self: AutonomyAgent): { x: number; z: number } {
  const roll = Math.random()
  if (roll < 0.35) return { x: clampFloor(0), z: clampFloor(4.2) }
  if (roll < 0.55) return { x: clampFloor(4.2), z: clampFloor(-1.8) }
  if (roll < 0.7) {
    const other = slots.filter((s) => s.id !== self.slotId)
    if (other.length) {
      const t = rnd(other)
      return { x: clampFloor(t.homeX + 0.6), z: clampFloor(t.homeZ) }
    }
  }
  const home = slots.find((s) => s.id === self.slotId)
  return { x: clampFloor(home?.homeX ?? self.x), z: clampFloor(home?.homeZ ?? self.z) }
}

export function probeStrategy(
  symbol: string,
  candles: Candle[] | undefined,
  role: string
): { bias: 'bullish' | 'bearish' | 'neutral'; note: string; screen: string } {
  if (!candles || candles.length < 12) {
    return {
      bias: 'neutral',
      note: `${symbol}: waiting for bars`,
      screen: `${symbol} · load`,
    }
  }
  const ta = analyzeCandles(candles, symbol, '15m')
  const smc = analyzeSmc(candles)
  const liq = analyzeLiquidity(candles, null, [])
  const strategy = rnd(STRATEGY_LABELS)
  const last = candles[candles.length - 1]!
  let bias: 'bullish' | 'bearish' | 'neutral' = ta.bias
  if (role.toLowerCase().includes('order') && liq?.bias === 'long') bias = 'bullish'
  if (role.toLowerCase().includes('order') && liq?.bias === 'short') bias = 'bearish'
  const bos = smc?.breaks?.length ? smc.breaks[smc.breaks.length - 1] : null
  const note = [
    `${strategy} on ${symbol}`,
    `last ${last.close.toFixed(last.close > 100 ? 1 : 4)} · TA ${ta.bias}`,
    bos ? `struct ${String(bos.kind)} ${bos.direction}` : `range ${ta.rangePos?.toFixed?.(0) ?? '—'}%`,
    liq ? `liq ${liq.bias}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return {
    bias,
    note,
    screen: `${symbol} ${bias.slice(0, 4)} · ${strategy.split(' ')[0]}`,
  }
}

export interface TickResult {
  agents: AutonomyAgent[]
  reports: AutonomyReport[]
}

export function tickAutonomy(
  agents: AutonomyAgent[],
  slots: DeskSlot[],
  now: number,
  dt: number,
  candleMap: Record<string, Candle[]>,
  autonomous: boolean
): TickResult {
  const reports: AutonomyReport[] = []
  if (!autonomous) {
    const next = agents.map((a) => stepMove({ ...a }, dt))
    return { agents: next, reports }
  }

  const next = agents.map((a) => {
    let ag = { ...a }
    ag = stepMove(ag, dt)

    if (now < ag.nextThinkAt) return ag

    const roll = Math.random()
    if (ag.activity === 'idle' || ag.activity === 'reporting') {
      if (roll < 0.45) {
        const dest = pickStation(slots, ag)
        ag.targetX = dest.x
        ag.targetZ = dest.z
        ag.activity = 'walking'
        ag.screenLine = 'moving…'
        ag.nextThinkAt = now + 900 + Math.random() * 800
      } else if (roll < 0.75) {
        ag.asset = rnd(RESEARCH_UNIVERSE)
        ag.activity = 'researching'
        ag.screenLine = `${ag.asset} scan…`
        ag.nextThinkAt = now + 1400 + Math.random() * 1000
      } else {
        ag.activity = 'strategizing'
        ag.screenLine = 'strategy…'
        ag.nextThinkAt = now + 1600 + Math.random() * 1200
      }
      return ag
    }

    if (ag.activity === 'walking') {
      const dx = ag.targetX - ag.x
      const dz = ag.targetZ - ag.z
      if (dx * dx + dz * dz < 0.12) {
        ag.activity = Math.random() < 0.5 ? 'researching' : 'strategizing'
        ag.asset = rnd(RESEARCH_UNIVERSE)
        ag.screenLine = `${ag.asset}…`
        ag.nextThinkAt = now + 1200
      } else {
        ag.nextThinkAt = now + 400
      }
      return ag
    }

    if (ag.activity === 'researching' || ag.activity === 'strategizing') {
      const series = candleMap[ag.asset] || candleMap[ag.asset.toUpperCase()]
      const probe = probeStrategy(ag.asset, series, ag.role)
      ag.bias = probe.bias
      ag.strategyNote = probe.note
      ag.screenLine = probe.screen
      ag.lastReport = probe.note
      ag.activity = 'reporting'
      const boss = slots.find((s) => s.isBoss)
      if (boss && ag.agentId !== 'orchestrator') {
        ag.targetX = clampFloor(boss.homeX + 1.0)
        ag.targetZ = clampFloor(boss.homeZ + 0.4)
      }
      reports.push({
        id: uid('rep'),
        fromSlot: ag.slotId,
        agentId: ag.agentId,
        name: ag.name,
        asset: ag.asset,
        title: `${ag.name} · ${ag.asset}`,
        body: probe.note,
        bias: probe.bias,
        ts: now,
      })
      ag.nextThinkAt = now + 2000 + Math.random() * 1500
      return ag
    }

    ag.activity = 'idle'
    const home = slots.find((s) => s.id === ag.slotId)
    if (home) {
      ag.targetX = home.homeX
      ag.targetZ = home.homeZ
    }
    ag.nextThinkAt = now + 1500 + Math.random() * 2000
    return ag
  })

  return { agents: next, reports }
}

function stepMove(ag: AutonomyAgent, dt: number): AutonomyAgent {
  const speed = ag.activity === 'walking' ? 0.0045 : 0.0025
  const maxStep = speed * dt
  const dx = ag.targetX - ag.x
  const dz = ag.targetZ - ag.z
  const dist = Math.hypot(dx, dz)
  if (dist < 0.02) {
    ag.x = clampFloor(ag.targetX)
    ag.z = clampFloor(ag.targetZ)
    return ag
  }
  const step = Math.min(maxStep, dist)
  ag.x = clampFloor(ag.x + (dx / dist) * step)
  ag.z = clampFloor(ag.z + (dz / dist) * step)
  ag.targetX = clampFloor(ag.targetX)
  ag.targetZ = clampFloor(ag.targetZ)
  return ag
}

export function addSeat(
  slots: DeskSlot[],
  agents: AutonomyAgent[],
  agentId: DeskAgentId = 'technical'
): { slots: DeskSlot[]; agents: AutonomyAgent[] } {
  const m = agentMeta(agentId)
  const n = slots.filter((s) => !s.isBoss).length
  const col = n % 3
  const row = Math.floor(n / 3)
  const id = `slot-${agentId}-${Date.now().toString(36)}`
  const slot: DeskSlot = {
    id,
    agentId,
    name: m.name,
    role: m.role,
    color: m.color,
    homeX: clampFloor(-2.2 + col * 2.6),
    homeZ: clampFloor(-1.2 + row * 2.6),
    isBoss: false,
  }
  const agent: AutonomyAgent = {
    slotId: id,
    agentId,
    name: m.name,
    role: m.role,
    color: m.color,
    x: slot.homeX,
    z: slot.homeZ,
    targetX: slot.homeX,
    targetZ: slot.homeZ,
    activity: 'idle',
    asset: rnd(RESEARCH_UNIVERSE),
    screenLine: 'hired',
    lastReport: '',
    strategyNote: '',
    bias: 'neutral',
    nextThinkAt: Date.now() + 1000,
  }
  return { slots: [...slots, slot], agents: [...agents, agent] }
}

export function removeSeat(
  slots: DeskSlot[],
  agents: AutonomyAgent[],
  slotId: string
): { slots: DeskSlot[]; agents: AutonomyAgent[] } {
  const slot = slots.find((s) => s.id === slotId)
  if (!slot || slot.isBoss) return { slots, agents }
  return {
    slots: slots.filter((s) => s.id !== slotId),
    agents: agents.filter((a) => a.slotId !== slotId),
  }
}
