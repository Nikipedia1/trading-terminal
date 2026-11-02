/**
 * Trading Desk — multi-agent office floor (Munder Difflin-inspired) for NACS Lab.
 * UI: agent cards + chat + task feed. Pipeline: local TA/SMC/liquidity + optional LLM.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import {
  AI_PROVIDERS,
  loadAiSettings,
  saveAiSettings,
  type AiApiSettings,
  type AiProviderId,
} from '@/analysis/aiDesk/aiApi'
import { DESK_AGENTS, agentMeta } from './agents'
import { runDeskBriefing } from './orchestrator'
import type {
  DeskAgentId,
  DeskAgentStatus,
  DeskMessage,
  DeskTask,
} from './types'

const QUICK = [
  'Floor brief',
  'Technical bias',
  'Orderflow',
  'Risk frame',
  'Sentiment',
  'Setup summary',
]

const STATUS_DOT: Record<DeskAgentStatus, string> = {
  idle: 'bg-[#5e6673]',
  thinking: 'bg-[#f0b90b] animate-pulse',
  ready: 'bg-[#0ecb81]',
  error: 'bg-[#f6465d]',
}

function AgentCard({
  id,
  status,
  lastBrief,
  selected,
  onSelect,
}: {
  id: DeskAgentId
  status: DeskAgentStatus
  lastBrief: string
  selected: boolean
  onSelect: () => void
}) {
  const m = agentMeta(id)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-lg border p-2 transition-colors min-w-0 ${
        selected
          ? 'border-[#f0b90b]/70 bg-[#1e2329]'
          : 'border-[#2b3139] bg-[#0d1117] hover:border-[#3d4550]'
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className="h-8 w-8 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
          style={{ background: m.accent, color: m.color, border: `1px solid ${m.color}55` }}
        >
          {m.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#eaecef] truncate">{m.name}</span>
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
          </div>
          <div className="text-[9px] text-[#848e9c] truncate">{m.role}</div>
        </div>
      </div>
      <p className="mt-1.5 text-[9px] text-[#848e9c] leading-snug line-clamp-2">
        {lastBrief || m.tagline}
      </p>
    </button>
  )
}

function MsgBubble({ m }: { m: DeskMessage }) {
  if (m.role === 'sys') {
    return (
      <div className="text-[9px] text-[#5e6673] text-center py-0.5">{m.text}</div>
    )
  }
  const isUser = m.role === 'user'
  const meta = m.agentId ? agentMeta(m.agentId) : null
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] rounded-lg px-2.5 py-1.5 text-[11px] leading-snug whitespace-pre-wrap ${
          isUser
            ? 'bg-[#f0b90b]/15 border border-[#f0b90b]/35 text-[#eaecef]'
            : 'bg-[#1e2329] border border-[#2b3139] text-[#eaecef]'
        }`}
      >
        {!isUser && meta && (
          <div className="text-[9px] font-semibold mb-0.5" style={{ color: meta.color }}>
            {meta.name} · {meta.role}
          </div>
        )}
        {m.text}
      </div>
    </div>
  )
}

export function TradingDeskPanel() {
  const link = useResolvedChartLink('follow')
  const panels = useLayoutStore((s) => s.panels)
  const storePrimary = useLayoutStore((s) => s.primaryPanelId)
  const targetPanelId =
    (link.linkedPanelId && panels.some((p) => p.id === link.linkedPanelId)
      ? link.linkedPanelId
      : null) ||
    storePrimary ||
    panels[0]?.id ||
    ''
  const targetPanel = panels.find((p) => p.id === targetPanelId) ?? panels[0]
  const symbol = (targetPanel?.symbol || link.symbol || 'BTCUSDT').toUpperCase()
  const interval = targetPanel?.interval || link.interval || '15m'
  const exchange = targetPanel?.exchange || link.exchange || 'binance'

  const { candles: linkedCandles } = usePanelMarket(symbol, interval, exchange)
  const marketCandles = useMarketStore((s) => s.candles)
  const marketSymbol = useMarketStore((s) => s.symbol)
  const candles =
    linkedCandles.length >= 8
      ? linkedCandles
      : marketSymbol.toUpperCase() === symbol
        ? marketCandles
        : linkedCandles

  const [agentStatus, setAgentStatus] = useState<Record<DeskAgentId, DeskAgentStatus>>(() => {
    const init = {} as Record<DeskAgentId, DeskAgentStatus>
    for (const a of DESK_AGENTS) init[a.id] = 'idle'
    return init
  })
  const [lastBrief, setLastBrief] = useState<Record<DeskAgentId, string>>(() => {
    const init = {} as Record<DeskAgentId, string>
    for (const a of DESK_AGENTS) init[a.id] = ''
    return init
  })
  const [messages, setMessages] = useState<DeskMessage[]>([
    {
      id: 'welcome',
      role: 'sys',
      text: 'Trading Desk online — chiedi un floor brief o seleziona un agente. Non è consiglio finanziario.',
      ts: Date.now(),
    },
  ])
  const [tasks, setTasks] = useState<DeskTask[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<DeskAgentId>('orchestrator')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiSettings, setAiSettings] = useState<AiApiSettings>(() => loadAiSettings())
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const ctx = useMemo(
    () => ({
      symbol,
      interval: String(interval),
      exchange: String(exchange),
      lastPrice: candles.length ? candles[candles.length - 1]!.close : null,
      candleCount: candles.length,
    }),
    [symbol, interval, exchange, candles]
  )

  const run = useCallback(
    async (text: string) => {
      const q = text.trim()
      if (!q || busy) return
      setBusy(true)
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: 'user', text: q, ts: Date.now() },
      ])
      setInput('')
      try {
        const result = await runDeskBriefing(q, candles, ctx, (id, status) => {
          setAgentStatus((s) => ({ ...s, [id]: status }))
        })
        setTasks(result.tasks)
        setMessages((prev) => [...prev, ...result.messages])
        setLastBrief((prev) => {
          const next = { ...prev }
          for (const r of result.reports) {
            next[r.agentId] = r.bullets[0] ?? r.title
          }
          next.orchestrator = result.floorBrief.bullets[0] ?? result.floorBrief.title
          return next
        })
        setAgentStatus((s) => {
          const next = { ...s }
          for (const a of DESK_AGENTS) {
            if (next[a.id] === 'thinking') next[a.id] = 'ready'
          }
          return next
        })
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'sys',
            text: `Desk error: ${e instanceof Error ? e.message : 'unknown'}`,
            ts: Date.now(),
          },
        ])
      } finally {
        setBusy(false)
      }
    },
    [busy, candles, ctx]
  )

  const saveSettings = () => {
    saveAiSettings(aiSettings)
    setSettingsOpen(false)
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#0b0e11] text-[#eaecef]">
      <div className="shrink-0 flex items-center justify-between gap-2 px-2 py-1.5 border-b border-[#2b3139]">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-[#f0b90b] tracking-wide">
            TRADING DESK
          </div>
          <div className="text-[9px] text-[#848e9c] truncate">
            {symbol} · {interval} · {exchange} · {candles.length} bars
            {ctx.lastPrice != null ? ` · ${ctx.lastPrice.toFixed(2)}` : ''}
          </div>
        </div>
        <button
          type="button"
          className="text-[10px] px-2 py-0.5 rounded border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] hover:border-[#f0b90b]/40"
          onClick={() => setSettingsOpen((v) => !v)}
        >
          AI API
        </button>
      </div>

      {settingsOpen && (
        <div className="shrink-0 border-b border-[#2b3139] bg-[#0d1117] p-2 space-y-1.5 text-[10px]">
          <div className="text-[#848e9c]">
            Keys stay in sessionStorage. Local rule engine works without a key.
          </div>
          <div className="flex flex-wrap gap-1">
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`px-1.5 py-0.5 rounded border ${
                  aiSettings.provider === p.id
                    ? 'border-[#f0b90b] text-[#f0b90b]'
                    : 'border-[#2b3139] text-[#848e9c]'
                }`}
                onClick={() =>
                  setAiSettings((s) => ({
                    ...s,
                    provider: p.id as AiProviderId,
                    model: p.defaultModel,
                  }))
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          {aiSettings.provider !== 'local' && (
            <>
              <input
                className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-2 py-1 text-[11px]"
                placeholder="API key"
                type="password"
                value={aiSettings.apiKey}
                onChange={(e) => setAiSettings((s) => ({ ...s, apiKey: e.target.value }))}
              />
              <input
                className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-2 py-1 text-[11px]"
                placeholder="Model"
                value={aiSettings.model}
                onChange={(e) => setAiSettings((s) => ({ ...s, model: e.target.value }))}
              />
            </>
          )}
          <button
            type="button"
            className="text-[10px] px-2 py-0.5 rounded bg-[#f0b90b]/20 text-[#f0b90b] border border-[#f0b90b]/40"
            onClick={saveSettings}
          >
            Save
          </button>
        </div>
      )}

      <div className="shrink-0 p-2 border-b border-[#2b3139]">
        <div className="text-[9px] uppercase tracking-wide text-[#5e6673] mb-1.5">
          Office floor
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {DESK_AGENTS.map((a) => (
            <AgentCard
              key={a.id}
              id={a.id}
              status={agentStatus[a.id]}
              lastBrief={lastBrief[a.id]}
              selected={selected === a.id}
              onSelect={() => setSelected(a.id)}
            />
          ))}
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="shrink-0 px-2 py-1 border-b border-[#2b3139] flex gap-1 overflow-x-auto">
          {tasks.map((t) => {
            const m = agentMeta(t.assignee)
            return (
              <span
                key={t.id}
                className="shrink-0 text-[9px] px-1.5 py-0.5 rounded border border-[#2b3139] text-[#848e9c]"
              >
                <span style={{ color: m.color }}>{m.name}</span> · {t.status}
              </span>
            )
          })}
        </div>
      )}

      <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-2">
        {messages.map((m) => (
          <MsgBubble key={m.id} m={m} />
        ))}
      </div>

      <div className="shrink-0 border-t border-[#2b3139] p-2 space-y-1.5">
        <div className="flex flex-wrap gap-1">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              className="text-[9px] px-1.5 py-0.5 rounded border border-[#2b3139] text-[#848e9c] hover:border-[#f0b90b]/40 hover:text-[#eaecef] disabled:opacity-40"
              onClick={() => run(q)}
            >
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            void run(input)
          }}
        >
          <input
            className="flex-1 min-w-0 bg-[#0d1117] border border-[#2b3139] rounded px-2 py-1.5 text-[11px] text-[#eaecef] placeholder:text-[#5e6673]"
            placeholder={`Ask ${agentMeta(selected).name} or the floor…`}
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="shrink-0 px-3 py-1.5 rounded text-[11px] font-semibold bg-[#f0b90b]/20 text-[#f0b90b] border border-[#f0b90b]/50 disabled:opacity-40"
          >
            {busy ? '…' : 'Send'}
          </button>
        </form>
        <p className="text-[8px] text-[#5e6673] leading-snug">
          Interpretazione multi-agente, non consiglio finanziario. Nessun ordine inviato dal desk.
        </p>
      </div>
    </div>
  )
}
