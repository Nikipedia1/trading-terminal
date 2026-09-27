/**
 * Lightweight alert engine – polls shared feeds / last price.
 * Cooldown per rule. Never fabricates events.
 */

import { create } from 'zustand'
import type { AlertEvent, AlertRule } from './types'
import { DEFAULT_RULES } from './types'
import { dispatchChannels } from './notify'
import { useMarketStore } from '@/stores/marketStore'
import { queryTradesInRange, retainTradeBuffer } from '@/analysis/deepPrint/tradeBuffer'
import { stackedImbalanceRuns } from '@/analysis/metrics/stackedImbalance'
import { buildDeepPrint } from '@/analysis/deepPrint/aggregate'
import { intervalToSeconds } from '@/analysis/deepPrint/interval'
import type { Interval } from '@/types'

const RULES_KEY = 'tt-alert-rules:v1'
const EVENTS_KEY = 'tt-alert-events:v1'
const MAX_EVENTS = 100

function loadRules(): AlertRule[] {
  try {
    const raw = localStorage.getItem(RULES_KEY)
    if (!raw) return DEFAULT_RULES.map((r) => ({ ...r }))
    const parsed = JSON.parse(raw) as AlertRule[]
    if (!Array.isArray(parsed)) return DEFAULT_RULES.map((r) => ({ ...r }))
    // merge defaults for new kinds
    const byId = new Map(parsed.map((r) => [r.id, r]))
    for (const d of DEFAULT_RULES) {
      if (!byId.has(d.id)) byId.set(d.id, { ...d })
    }
    return Array.from(byId.values())
  } catch {
    return DEFAULT_RULES.map((r) => ({ ...r }))
  }
}

function saveRules(rules: AlertRule[]) {
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify(rules))
  } catch {
    /* */
  }
}

function loadEvents(): AlertEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY)
    if (!raw) return []
    const a = JSON.parse(raw)
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

function saveEvents(events: AlertEvent[]) {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)))
  } catch {
    /* */
  }
}

interface AlertState {
  rules: AlertRule[]
  events: AlertEvent[]
  lastFire: Record<string, number>
  running: boolean
  setRule: (id: string, patch: Partial<AlertRule>) => void
  clearEvents: () => void
  start: () => void
  stop: () => void
}

let timer: ReturnType<typeof setInterval> | null = null
let releaseBuf: (() => void) | null = null

function fire(rule: AlertRule, symbol: string, message: string, price?: number) {
  const st = useAlertStore.getState()
  const now = Date.now()
  const last = st.lastFire[rule.id] ?? 0
  if (now - last < rule.cooldownSec * 1000) return

  const ev: AlertEvent = {
    id: `ae-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ruleId: rule.id,
    kind: rule.kind,
    symbol,
    message,
    price,
    ts: now,
  }

  const events = [ev, ...st.events].slice(0, MAX_EVENTS)
  saveEvents(events)
  useAlertStore.setState({
    events,
    lastFire: { ...st.lastFire, [rule.id]: now },
  })

  void dispatchChannels(
    { sound: rule.sound, desktop: rule.desktop, webhook: rule.webhook },
    `[${rule.kind}] ${symbol}`,
    message
  )
}

function tick() {
  const { rules } = useAlertStore.getState()
  const m = useMarketStore.getState()
  const symbol = m.symbol.toUpperCase()
  const exchange = m.exchange
  const last = m.ticker?.lastPrice ?? 0
  const interval = (m.interval || '1m') as Interval

  if (!(last > 0)) return

  // ensure trade buffer
  if (!releaseBuf) {
    releaseBuf = retainTradeBuffer(exchange, symbol)
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const trades = queryTradesInRange(exchange, symbol, nowSec - 600, nowSec + 5)

  for (const rule of rules) {
    if (!rule.enabled) continue
    const sym = (rule.symbol || symbol).toUpperCase()
    if (sym !== symbol) continue

    try {
      switch (rule.kind) {
        case 'large_print': {
          const thr = rule.threshold ?? 50000
          for (const t of trades.slice(-30)) {
            const notional = t.price * t.qty
            if (notional >= thr) {
              fire(
                rule,
                sym,
                `${t.aggressor.toUpperCase()} ${notional.toFixed(0)} USDT @ ${t.price}`,
                t.price
              )
              break
            }
          }
          break
        }
        case 'stacked_imbalance': {
          const sec = intervalToSeconds(interval)
          const candleOpen = Math.floor(nowSec / sec) * sec
          const model = buildDeepPrint(
            trades.filter((t) => {
              const ts = Math.floor(t.time / 1000)
              return ts >= candleOpen && ts < candleOpen + sec
            }),
            candleOpen,
            sec
          )
          if (model && model.levels.length >= 3) {
            const runs = stackedImbalanceRuns(
              model.levels,
              0.7,
              0.3,
              Math.max(2, Math.floor(rule.threshold ?? 3))
            )
            if (runs.length > 0) {
              const r = runs[0]
              fire(
                rule,
                sym,
                `Stacked ${r.side} ×${r.length} [${r.startPrice}–${r.endPrice}]`,
                last
              )
            }
          }
          break
        }
        case 'book_pull': {
          const book = m.orderBook
          if (!book) break
          // simple: compare top bid size drop vs previous sample stored on window
          const w = window as any
          const prev = w.__ttBookTop as { bid: number; qty: number } | undefined
          const top = book.bids[0]
          if (top && prev && prev.bid === top.price && prev.qty > 0) {
            const factor = rule.threshold ?? 3
            if (top.qty <= prev.qty / factor) {
              fire(rule, sym, `Bid pull ${prev.qty.toFixed(4)}→${top.qty.toFixed(4)} @ ${top.price}`, top.price)
            }
          }
          if (top) w.__ttBookTop = { bid: top.price, qty: top.qty }
          break
        }
        case 'funding_spike': {
          // funding from futures panel is optional; use session flag if present
          const w = window as any
          const fr = w.__ttLastFunding as number | undefined
          const thr = rule.threshold ?? 0.001
          if (fr != null && Math.abs(fr) >= thr) {
            fire(rule, sym, `Funding ${((fr) * 100).toFixed(4)}%`, last)
          }
          break
        }
        // price_poc / vah / val need profile model – fired when levels exposed on window
        case 'price_poc':
        case 'price_vah':
        case 'price_val': {
          const w = window as any
          const levels = w.__ttProfileLevels as
            | { poc?: number; vah?: number; val?: number }
            | undefined
          if (!levels) break
          const level =
            rule.kind === 'price_poc'
              ? levels.poc
              : rule.kind === 'price_vah'
                ? levels.vah
                : levels.val
          if (level == null || !(level > 0)) break
          const rel = Math.abs(last - level) / level
          if (rel <= (rule.threshold ?? 0.0005)) {
            fire(rule, sym, `Price near ${rule.kind.replace('price_', '').toUpperCase()} ${level}`, last)
          }
          break
        }
        case 'delta_divergence': {
          // lightweight: last closed candle delta vs price direction via window hook
          const w = window as any
          const flag = w.__ttDeltaDiv as { symbol: string; ts: number } | undefined
          if (flag && flag.symbol === sym && Date.now() - flag.ts < 5000) {
            fire(rule, sym, 'Delta divergence flag', last)
          }
          break
        }
        default:
          break
      }
    } catch {
      /* never break the UI loop */
    }
  }
}

export const useAlertStore = create<AlertState>((set, get) => ({
  rules: loadRules(),
  events: loadEvents(),
  lastFire: {},
  running: false,

  setRule: (id, patch) => {
    const rules = get().rules.map((r) => (r.id === id ? { ...r, ...patch } : r))
    saveRules(rules)
    set({ rules })
  },

  clearEvents: () => {
    saveEvents([])
    set({ events: [] })
  },

  start: () => {
    if (timer) return
    timer = setInterval(tick, 2000)
    set({ running: true })
    tick()
  },

  stop: () => {
    if (timer) clearInterval(timer)
    timer = null
    releaseBuf?.()
    releaseBuf = null
    set({ running: false })
  },
}))

/** Call once from App mount */
export function startAlertEngine() {
  useAlertStore.getState().start()
}
