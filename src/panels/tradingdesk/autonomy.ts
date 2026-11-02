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
  asset: string
  screenLine: string
  lastReport: string
  strategyNote: string
  bias: 'bullish' | 'bearish' | 'neutral'
  nextThinkAt: number
  chatLine: string
  seated: boolean
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
  'mean-reversion probe','breakout watch','liquidity sweep map',
  'structure BOS check','range fade paper','momentum continuation','session VWAP lean',
]

const CHAT_LINES = [
  'Hai visto il break su BTC?',
  'Range stretto, aspetto volume.',
  'Liquidità sotto il minimo di ieri.',
  'Bias ancora neutrale sul 15m.',
  'Prendo un caffè e ricontrollo.',
  'Report pronto per Michael.',
  'SOL si muove con beta alta.',
  'Attento al sweep del buy-side.',
  'Rischio: non chaseare la candela.',
  'Meeting in 5, porta i livelli.',
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
    chatLine: '',
    seated: true,
  }))
}

function pickStation(slots: DeskSlot[], self: AutonomyAgent): { x: number; z: number; intent: AutonomyActivity } {
  const roll = Math.random()
  if (roll < 0.18) return { x: clampFloor(POI_COFFEE.x), z: clampFloor(POI_COFFEE.z), intent: 'coffee' }
  if (roll < 0.32) return { x: clampFloor(POI_WATER.x), z: clampFloor(POI_WATER.z), intent: 'water' }
  if (roll < 0.48) return { x: clampFloor(0), z: clampFloor(4.2), intent: 'researching' }
  if (roll < 0.62) return { x: clampFloor(4.2), z: clampFloor(-1.8), intent: 'strategizing' }
  if (roll < 0.78) {
    const other = slots.filter((s) => s.id !== self.slotId)
    if (other.length) {
      const t = rnd(other)
      return { x: clampFloor(t.homeX + 0.7), z: clampFloor(t.homeZ + 0.3), intent: 'chatting' }
    }
  }
  const home = slots.find((s) => s.id === self.slotId)
  return { x: clampFloor(home?.homeX ?? self.x), z: clampFloor(home?.homeZ ?? self.z), intent: 'sitting' }
}

export function probeStrategy(
  symbol: string,
  candles: Candle[] | undefined,
  role: string
): { bias: 'bullish' | 'bearish' | 'neutral'; note: string; screen: string } {
  if (!candles || candles.length < 12) {
    return { bias: 'neutral', note: `REPORT COMPLETO · ${symbol}\n\nDati insufficienti.`, screen: `${symbol} · load` }
  }
  const ta = analyzeCandles(candles, symbol, '15m')
  const smc = analyzeSmc(candles)
  const liq = analyzeLiquidity(candles, null, [])
  const strategy = rnd(STRATEGY_LABELS)
  const last = candles[candles.length - 1]!
  const prev = candles[candles.length - 2] ?? last
  const highs = candles.slice(-20).map((c) => c.high)
  const lows = candles.slice(-20).map((c) => c.low)
  const hi20 = Math.max(...highs)
  const lo20 = Math.min(...lows)
  const chg = prev.close !== 0 ? ((last.close - prev.close) / prev.close) * 100 : 0
  const rangePct = last.close !== 0 ? ((hi20 - lo20) / last.close) * 100 : 0
  const dec = last.close > 1000 ? 1 : last.close > 10 ? 2 : 4
  let bias: 'bullish' | 'bearish' | 'neutral' = ta.bias
  if (role.toLowerCase().includes('order') && liq?.bias === 'long') bias = 'bullish'
  if (role.toLowerCase().includes('order') && liq?.bias === 'short') bias = 'bearish'
  const bos = smc?.breaks?.length ? smc.breaks[smc.breaks.length - 1] : null
  const support = ta.supports?.[0]
  const resist = ta.resistances?.[0]
  const conf = bias === 'neutral' ? 0.4 : 0.55 + Math.min(0.3, Math.abs(chg) * 0.05)
  const L: string[] = [
    `REPORT COMPLETO · ${symbol}`,
    `Strategia: ${strategy} · Ruolo: ${role}`,
    '',
    '— PREZZO —',
    `Ultimo: ${last.close.toFixed(dec)} | O ${last.open.toFixed(dec)} H ${last.high.toFixed(dec)} L ${last.low.toFixed(dec)}`,
    `Var barra: ${chg >= 0 ? '+' : ''}${chg.toFixed(3)}% · Range20: ${lo20.toFixed(dec)}→${hi20.toFixed(dec)} (${rangePct.toFixed(2)}%)`,
    '',
    '— TECNICO —',
    `Bias TA: ${String(ta.bias).toUpperCase()} · range pos: ${ta.rangePos != null ? Math.round(ta.rangePos) + '%' : '—'}`,
  ]
  if (ta.summary?.length) for (const s of ta.summary.slice(0, 4)) L.push(`  • ${s}`)
  if (support != null) L.push(`Supporto ~ ${Number(support).toFixed(dec)}`)
  if (resist != null) L.push(`Resistenza ~ ${Number(resist).toFixed(dec)}`)
  L.push('', '— SMC —')
  if (bos) L.push(`Ultimo: ${String(bos.kind).toUpperCase()} ${bos.direction} @ ${Number(bos.price).toFixed(dec)}`)
  else L.push('Nessun BOS/CHOCH recente.')
  L.push('', '— LIQUIDITÀ —')
  if (liq) {
    L.push(`Bias: ${liq.bias} · score ${Number(liq.score ?? 0).toFixed(2)}`)
    for (const s of (liq.summary ?? []).slice(0, 3)) L.push(`  • ${s}`)
  } else L.push('N/D')
  L.push('', '— RISK (paper) —')
  if (support != null && resist != null) {
    L.push(`Zona S/R: ${Number(support).toFixed(dec)} — ${Number(resist).toFixed(dec)}`)
  }
  L.push('', '— CONCLUSIONE —')
  L.push(`Bias: ${bias.toUpperCase()} · conf ~ ${(conf * 100).toFixed(0)}%`)
  L.push('Analisi automatica locale — nessun ordine reale.')
  return { bias, note: L.join('\n'), screen: `${symbol} ${bias.slice(0, 4)} · ${strategy.split(' ')[0]}` }
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
    return { agents: agents.map((a) => stepMove({ ...a, chatLine: a.chatLine ?? '', seated: a.seated ?? false }, dt)), reports }
  }
  const next = agents.map((a) => {
    let ag = stepMove({ ...a, chatLine: a.chatLine ?? '', seated: a.seated ?? false }, dt)
    if (now < ag.nextThinkAt) return ag
    const roll = Math.random()
    if (ag.activity === 'idle' || ag.activity === 'reporting') {
      if (roll < 0.5) {
        const dest = pickStation(slots, ag)
        ag.targetX = dest.x; ag.targetZ = dest.z; ag.activity = 'walking'; ag.seated = false
        ag.screenLine = dest.intent === 'coffee' ? 'caffè…' : dest.intent === 'water' ? 'acqua…' : 'moving…'
        ag.chatLine = dest.intent === 'chatting' ? rnd(CHAT_LINES) : ''
        ag.strategyNote = `intent:${dest.intent}`
        ag.nextThinkAt = now + 900 + Math.random() * 800
      } else if (roll < 0.78) {
        ag.asset = rnd(RESEARCH_UNIVERSE); ag.activity = 'researching'; ag.seated = true
        ag.screenLine = `${ag.asset} scan…`; ag.chatLine = ''
        ag.nextThinkAt = now + 1400 + Math.random() * 1000
      } else {
        ag.activity = 'strategizing'; ag.seated = true; ag.screenLine = 'strategy…'; ag.chatLine = ''
        ag.nextThinkAt = now + 1600 + Math.random() * 1200
      }
      return ag
    }
    if (ag.activity === 'walking') {
      const dx = ag.targetX - ag.x; const dz = ag.targetZ - ag.z
      if (dx * dx + dz * dz < 0.14) {
        const intent = ag.strategyNote.startsWith('intent:') ? (ag.strategyNote.slice(7) as AutonomyActivity) : null
        if (intent === 'coffee') {
          ag.activity = 'coffee'; ag.seated = false; ag.screenLine = '☕ caffè'
          ag.chatLine = rnd(['Espresso doppio.', 'Senza zucchero.', 'Caffè e poi livelli.'])
          ag.nextThinkAt = now + 1800
        } else if (intent === 'water') {
          ag.activity = 'water'; ag.seated = false; ag.screenLine = '💧 acqua'
          ag.chatLine = rnd(['Pausa idratazione.', 'Acqua e focus.', 'Back to desk soon.'])
          ag.nextThinkAt = now + 1600
        } else if (intent === 'chatting') {
          ag.activity = 'chatting'; ag.seated = false
          ag.chatLine = ag.chatLine || rnd(CHAT_LINES); ag.screenLine = 'chat'
          ag.nextThinkAt = now + 2200
        } else if (intent === 'sitting') {
          ag.activity = 'sitting'; ag.seated = true; ag.screenLine = 'desk'; ag.chatLine = ''
          ag.nextThinkAt = now + 1000
        } else {
          ag.activity = Math.random() < 0.5 ? 'researching' : 'strategizing'
          ag.seated = true; ag.asset = rnd(RESEARCH_UNIVERSE)
          ag.screenLine = `${ag.asset}…`; ag.chatLine = ''
          ag.nextThinkAt = now + 1200
        }
        if (ag.strategyNote.startsWith('intent:')) ag.strategyNote = ''
      } else ag.nextThinkAt = now + 400
      return ag
    }
    if (ag.activity === 'coffee' || ag.activity === 'water' || ag.activity === 'chatting' || ag.activity === 'sitting') {
      const home = slots.find((s) => s.id === ag.slotId)
      const wasChat = ag.activity === 'chatting'
      if (home) {
        ag.targetX = home.homeX; ag.targetZ = home.homeZ
        ag.activity = 'walking'; ag.seated = false
        ag.strategyNote = 'intent:sitting'; ag.screenLine = 'back to desk'
        if (wasChat) ag.chatLine = ''
      }
      ag.nextThinkAt = now + 800
      return ag
    }
    if (ag.activity === 'researching' || ag.activity === 'strategizing') {
      const series = candleMap[ag.asset] || candleMap[ag.asset.toUpperCase()]
      const probe = probeStrategy(ag.asset, series, ag.role)
      ag.bias = probe.bias; ag.strategyNote = probe.note; ag.screenLine = probe.screen
      ag.lastReport = probe.note; ag.activity = 'reporting'; ag.seated = true
      reports.push({
        id: uid('rep'), fromSlot: ag.slotId, agentId: ag.agentId, name: ag.name,
        asset: ag.asset, title: `${ag.name} · ${ag.asset}`, body: probe.note, bias: probe.bias, ts: now,
      })
      ag.nextThinkAt = now + 2000 + Math.random() * 1500
      return ag
    }
    ag.activity = 'idle'; ag.seated = true
    const home = slots.find((s) => s.id === ag.slotId)
    if (home) { ag.targetX = home.homeX; ag.targetZ = home.homeZ }
    ag.nextThinkAt = now + 1500 + Math.random() * 2000
    return ag
  })
  return { agents: next, reports }
}

function stepMove(ag: AutonomyAgent, dt: number): AutonomyAgent {
  const speed = ag.activity === 'walking' ? 0.0045 : 0.0025
  const maxStep = speed * dt
  const dx = ag.targetX - ag.x; const dz = ag.targetZ - ag.z
  const dist = Math.hypot(dx, dz)
  if (dist < 0.02) { ag.x = clampFloor(ag.targetX); ag.z = clampFloor(ag.targetZ); return ag }
  const step = Math.min(maxStep, dist)
  ag.x = clampFloor(ag.x + (dx / dist) * step)
  ag.z = clampFloor(ag.z + (dz / dist) * step)
  ag.targetX = clampFloor(ag.targetX); ag.targetZ = clampFloor(ag.targetZ)
  return ag
}

export function addSeat(slots: DeskSlot[], agents: AutonomyAgent[], agentId: DeskAgentId = 'technical') {
  const m = agentMeta(agentId)
  const n = slots.filter((s) => !s.isBoss).length
  const col = n % 3; const row = Math.floor(n / 3)
  const id = `slot-${agentId}-${Date.now().toString(36)}`
  const slot: DeskSlot = {
    id, agentId, name: m.name, role: m.role, color: m.color,
    homeX: clampFloor(-2.2 + col * 2.6), homeZ: clampFloor(-1.2 + row * 2.6), isBoss: false,
  }
  const agent: AutonomyAgent = {
    slotId: id, agentId, name: m.name, role: m.role, color: m.color,
    x: slot.homeX, z: slot.homeZ, targetX: slot.homeX, targetZ: slot.homeZ,
    activity: 'idle', asset: rnd(RESEARCH_UNIVERSE), screenLine: 'hired',
    lastReport: '', strategyNote: '', bias: 'neutral', nextThinkAt: Date.now() + 1000,
    chatLine: '', seated: true,
  }
  return { slots: [...slots, slot], agents: [...agents, agent] }
}

export function removeSeat(slots: DeskSlot[], agents: AutonomyAgent[], slotId: string) {
  const slot = slots.find((s) => s.id === slotId)
  if (!slot || slot.isBoss) return { slots, agents }
  return { slots: slots.filter((s) => s.id !== slotId), agents: agents.filter((a) => a.slotId !== slotId) }
}
