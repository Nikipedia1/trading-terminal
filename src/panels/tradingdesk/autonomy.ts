/**
 * Autonomous desk: research, coffee/water breaks, chat, sit/stand.
 */
import type { Candle } from '@/types'
import { analyzeCandles } from '@/analysis/aiDesk/taEngine'
import { analyzeSmc } from '@/analysis/aiDesk/smcEngine'
import { analyzeLiquidity } from '@/analysis/aiDesk/liquidityEngine'
import type { DeskAgentId } from './types'
import { agentMeta } from './agents'

export const RESEARCH_UNIVERSE = [
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT','LINKUSDT','NEARUSDT',
] as const

export const POI_COFFEE = { x: -4.2, z: 3.8 }
export const POI_WATER = { x: 4.0, z: 3.6 }
export const POI_DOOR = { x: 0, z: -5.0 }

export type AutonomyActivity =
  | 'idle' | 'walking' | 'sitting' | 'researching' | 'strategizing'
  | 'reporting' | 'meeting' | 'coffee' | 'water' | 'chatting'

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
  seated: boolean
  asset: string
  bias: 'bullish' | 'bearish' | 'neutral'
  strategy: string
  chatLine: string
  nextThinkAt: number
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

export interface AutonomyReport {
  agentId: DeskAgentId
  slotId: string
  asset: string
  title: string
  body: string
  bias: 'bullish' | 'bearish' | 'neutral'
  ts: number
}

const FLOOR_MIN = -5.2
const FLOOR_MAX = 5.2
function clampFloor(v: number) {
  return Math.max(FLOOR_MIN, Math.min(FLOOR_MAX, v))
}

const STRATEGY_LABELS = [
  'mean-reversion probe','breakout watch','liquidity sweep map',
  'structure BOS check','range fade paper','momentum continuation','session VWAP lean',
]

const CHAT_LINES = [
  'Hai visto il volume su questo livello?',
  'Aspetto conferma sul TF superiore.',
  'Rischio eventi — size ridotta.',
  'Supporto tiene, resto in plan.',
  'Breakout falso, torno flat.',
  'Coffee break e ricalcolo bias.',
]

export function defaultSlots(): DeskSlot[] {
  const roster: { id: DeskAgentId; boss?: boolean }[] = [
    { id: 'orchestrator', boss: true },
    { id: 'technical' }, { id: 'orderflow' }, { id: 'risk' },
    { id: 'sentiment' }, { id: 'trader' },
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
      homeX: clampFloor(r.boss ? 0 : -2.2 + col * 2.2),
      homeZ: clampFloor(r.boss ? -2.8 : -1.2 + row * 2.6),
      isBoss: !!r.boss,
    })
    i++
  }
  return slots
}

export function agentsFromSlots(slots: DeskSlot[]): AutonomyAgent[] {
  const now = Date.now()
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
    seated: true,
    asset: String(RESEARCH_UNIVERSE[idx % RESEARCH_UNIVERSE.length] || 'BTCUSDT'),
    bias: 'neutral' as const,
    strategy: STRATEGY_LABELS[idx % STRATEGY_LABELS.length]!,
    chatLine: '',
    nextThinkAt: now + 800 + idx * 400,
  }))
}

function dist(ax: number, az: number, bx: number, bz: number) {
  return Math.hypot(ax - bx, az - bz)
}

function pickAsset(prev: string) {
  const pool = RESEARCH_UNIVERSE.filter((s) => s !== prev)
  return pool[Math.floor(Math.random() * pool.length)] || prev || 'BTCUSDT'
}

function probeStrategy(asset: string, candles: Candle[] | undefined): {
  bias: 'bullish' | 'bearish' | 'neutral'
  strategy: string
  body: string
} {
  const sym = asset || 'BTCUSDT'
  if (!candles || candles.length < 8) {
    return {
      bias: 'neutral',
      strategy: 'data warmup',
      body: `${sym}: waiting for enough bars to frame a plan.`,
    }
  }
  try {
    const ta = analyzeCandles(candles, sym, '15m')
    const smc = analyzeSmc(candles)
    const liq = analyzeLiquidity(candles, null, [])
    const last = candles[candles.length - 1]!
    const strategy = STRATEGY_LABELS[Math.floor(Math.random() * STRATEGY_LABELS.length)]!
    const bias = (ta?.bias ?? 'neutral') as 'bullish' | 'bearish' | 'neutral'
    const body = [
      `${sym} @ ${last.close.toFixed(last.close >= 100 ? 1 : 4)} · bias ${bias}`,
      ta?.summary?.[0] ?? 'Structure scan complete',
      liq ? `Liq ${liq.bias}` : '',
      smc?.breaks?.length ? `Last break ${smc.breaks[smc.breaks.length - 1]!.direction}` : '',
      `Plan: ${strategy}`,
    ].filter(Boolean).join(' · ')
    return { bias, strategy, body }
  } catch (e) {
    return {
      bias: 'neutral',
      strategy: 'probe error',
      body: `${sym}: analysis skipped (${e instanceof Error ? e.message : 'error'})`,
    }
  }
}

export function tickAutonomy(
  agents: AutonomyAgent[],
  slots: DeskSlot[],
  candleMap: Record<string, Candle[]>,
  now = Date.now()
): { agents: AutonomyAgent[]; reports: AutonomyReport[] } {
  const reports: AutonomyReport[] = []
  const next = agents.map((a) => ({ ...a, asset: a.asset || 'BTCUSDT' }))
  const slotById = new Map(slots.map((s) => [s.id, s]))

  for (const a of next) {
    const slot = slotById.get(a.slotId)
    if (!slot) continue

    const dx = a.targetX - a.x
    const dz = a.targetZ - a.z
    const d = Math.hypot(dx, dz)
    if (d > 0.04) {
      const sp = a.activity === 'walking' ? 0.055 : 0.03
      a.x = clampFloor(a.x + (dx / d) * Math.min(sp, d))
      a.z = clampFloor(a.z + (dz / d) * Math.min(sp, d))
      a.activity = 'walking'
      a.seated = false
      continue
    }

    a.x = clampFloor(a.targetX)
    a.z = clampFloor(a.targetZ)

    const atHome = dist(a.x, a.z, slot.homeX, slot.homeZ) < 0.2
    const atCoffee = dist(a.x, a.z, POI_COFFEE.x, POI_COFFEE.z) < 0.35
    const atWater = dist(a.x, a.z, POI_WATER.x, POI_WATER.z) < 0.35

    if (atCoffee) {
      a.activity = 'coffee'
      a.seated = false
      if (now > a.nextThinkAt) {
        a.nextThinkAt = now + 4000 + Math.random() * 3000
        a.targetX = slot.homeX
        a.targetZ = slot.homeZ
        a.chatLine = 'Caffè fatto. Di nuovo al desk.'
      }
      continue
    }
    if (atWater) {
      a.activity = 'water'
      a.seated = false
      if (now > a.nextThinkAt) {
        a.nextThinkAt = now + 3500 + Math.random() * 2500
        a.targetX = slot.homeX
        a.targetZ = slot.homeZ
        a.chatLine = 'Idratato. Riparto con il plan.'
      }
      continue
    }

    if (atHome) {
      a.seated = true
      if (now > a.nextThinkAt) {
        const roll = Math.random()
        a.nextThinkAt = now + 5000 + Math.random() * 8000
        if (roll < 0.12) {
          a.targetX = POI_COFFEE.x + (Math.random() - 0.5) * 0.3
          a.targetZ = POI_COFFEE.z + (Math.random() - 0.5) * 0.3
          a.activity = 'walking'
          a.seated = false
          a.chatLine = 'Vado al caffè.'
        } else if (roll < 0.2) {
          a.targetX = POI_WATER.x + (Math.random() - 0.5) * 0.3
          a.targetZ = POI_WATER.z + (Math.random() - 0.5) * 0.3
          a.activity = 'walking'
          a.seated = false
          a.chatLine = 'Acqua e torno.'
        } else if (roll < 0.35) {
          a.asset = pickAsset(a.asset)
          a.activity = 'researching'
          a.chatLine = `Research su ${a.asset}`
        } else if (roll < 0.55) {
          const assetKey = String(a.asset || 'BTCUSDT')
          const probe = probeStrategy(assetKey, candleMap[assetKey] || candleMap[assetKey.toUpperCase()])
          a.bias = probe.bias
          a.strategy = probe.strategy
          a.activity = 'strategizing'
          a.chatLine = String(probe.body || '').slice(0, 48)
          reports.push({
            agentId: a.agentId,
            slotId: a.slotId,
            asset: assetKey,
            title: `${a.name} · ${assetKey}`,
            body: probe.body,
            bias: probe.bias,
            ts: now,
          })
        } else if (roll < 0.7) {
          a.activity = 'reporting'
          a.chatLine = CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)]!
        } else if (roll < 0.82) {
          a.activity = 'chatting'
          a.chatLine = CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)]!
        } else {
          a.activity = 'idle'
          a.chatLine = ''
        }
      } else if (!a.activity || a.activity === 'walking') {
        a.activity = 'sitting'
      }
    }
  }

  return { agents: next, reports }
}

export function addSeat(slots: DeskSlot[], agents: AutonomyAgent[], agentId: DeskAgentId = 'technical') {
  const m = agentMeta(agentId)
  const n = slots.filter((s) => !s.isBoss).length
  const col = n % 3; const row = Math.floor(n / 3)
  const id = `slot-${agentId}-${Date.now().toString(36)}`
  const isChief = agentId === 'masterchief'
  const slot: DeskSlot = {
    id, agentId, name: m.name, role: m.role, color: m.color,
    homeX: clampFloor(isChief ? 0 : -2.2 + col * 2.6),
    homeZ: clampFloor(isChief ? 2.2 : -1.2 + row * 2.6),
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
    seated: true,
    asset: String(RESEARCH_UNIVERSE[n % RESEARCH_UNIVERSE.length] || 'BTCUSDT'),
    bias: 'neutral',
    strategy: STRATEGY_LABELS[n % STRATEGY_LABELS.length]!,
    chatLine: isChief ? 'Master Chief online. Position desk ready.' : '',
    nextThinkAt: Date.now() + 1000,
  }
  return { slots: [...slots, slot], agents: [...agents, agent] }
}

export function removeSeat(slots: DeskSlot[], agents: AutonomyAgent[], slotId: string) {
  const slot = slots.find((s) => s.id === slotId)
  if (!slot || slot.isBoss) return { slots, agents }
  return { slots: slots.filter((s) => s.id !== slotId), agents: agents.filter((a) => a.slotId !== slotId) }
}

export function renameSeat(
  slots: DeskSlot[],
  agents: AutonomyAgent[],
  slotId: string,
  name: string
) {
  const n = name.trim().slice(0, 24)
  if (!n) return { slots, agents }
  return {
    slots: slots.map((s) => (s.id === slotId ? { ...s, name: n } : s)),
    agents: agents.map((a) => (a.slotId === slotId ? { ...a, name: n } : a)),
  }
}
