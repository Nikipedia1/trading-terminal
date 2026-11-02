/**
 * Trading Desk — multi-agent office floor (Munder Difflin pixel style) for NACS Lab.
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
import { OfficeFloor } from './OfficeFloor'
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

function MsgBubble({ m }: { m: DeskMessage }) {
  if (m.role === 'sys') {
    return (
      <div
        className="text-[9px] text-center py-0.5"
        style={{ color: '#848e9c', fontFamily: 'ui-monospace, monospace' }}
      >
        {m.text}
      </div>
    )
  }
  const isUser = m.role === 'user'
  const meta = m.agentId ? agentMeta(m.agentId) : null
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        style={{
          maxWidth: '92%',
          borderRadius: 0,
          padding: '6px 8px',
          fontSize: 11,
          lineHeight: 1.35,
          whiteSpace: 'pre-wrap',
          fontFamily: 'ui-monospace, monospace',
          background: isUser ? '#F4D35E' : '#1e2329',
          color: isUser ? '#1a1a1a' : '#eaecef',
          boxShadow: '2px 2px 0 #1a1a1a, inset 0 0 0 1px #1a1a1a',
        }}
      >
        {!isUser && meta && (
          <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 2, color: meta.color }}>
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
      text: 'Floor online — chiedi un brief. Non è consiglio finanziario.',
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
    <div
      className="h-full min-h-0 flex flex-col"
      style={{ background: '#12161c', color: '#eaecef', fontFamily: 'ui-monospace, monospace' }}
    >
      <div
        className="shrink-0 flex items-center justify-between gap-2 px-2 py-1.5"
        style={{ background: '#6E1423', borderBottom: '3px solid #1a1a1a' }}
      >
        <div className="min-w-0">
          <div style={{ fontSize: 11, fontWeight: 800, color: '#F4D35E', letterSpacing: '0.06em' }}>
            MUNDER · TRADING DESK
          </div>
          <div style={{ fontSize: 9, color: '#f0c9c9' }}>
            {symbol} · {interval} · {exchange} · {candles.length} bars
            {ctx.lastPrice != null ? ` · ${ctx.lastPrice.toFixed(2)}` : ''}
          </div>
        </div>
        <button
          type="button"
          style={{
            fontSize: 10,
            padding: '3px 8px',
            background: '#F4D35E',
            color: '#1a1a1a',
            border: 'none',
            boxShadow: '2px 2px 0 #1a1a1a',
            fontWeight: 700,
            cursor: 'pointer',
          }}
          onClick={() => setSettingsOpen((v) => !v)}
        >
          AI API
        </button>
      </div>

      {settingsOpen && (
        <div
          className="shrink-0 p-2 space-y-1.5 text-[10px]"
          style={{ background: '#1a1214', borderBottom: '2px solid #1a1a1a' }}
        >
          <div style={{ color: '#848e9c' }}>
            Keys in sessionStorage. Local engine works without a key.
          </div>
          <div className="flex flex-wrap gap-1">
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                style={{
                  padding: '2px 6px',
                  border: 'none',
                  boxShadow: '1px 1px 0 #1a1a1a',
                  background: aiSettings.provider === p.id ? '#F4D35E' : '#2b3139',
                  color: aiSettings.provider === p.id ? '#1a1a1a' : '#eaecef',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
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
                className="w-full px-2 py-1 text-[11px]"
                style={{ background: '#0b0e11', border: '2px solid #1a1a1a', color: '#eaecef' }}
                placeholder="API key"
                type="password"
                value={aiSettings.apiKey}
                onChange={(e) => setAiSettings((s) => ({ ...s, apiKey: e.target.value }))}
              />
              <input
                className="w-full px-2 py-1 text-[11px]"
                style={{ background: '#0b0e11', border: '2px solid #1a1a1a', color: '#eaecef' }}
                placeholder="Model"
                value={aiSettings.model}
                onChange={(e) => setAiSettings((s) => ({ ...s, model: e.target.value }))}
              />
            </>
          )}
          <button
            type="button"
            style={{
              fontSize: 10,
              padding: '3px 8px',
              background: '#F4D35E',
              color: '#1a1a1a',
              border: 'none',
              boxShadow: '2px 2px 0 #1a1a1a',
              fontWeight: 700,
            }}
            onClick={saveSettings}
          >
            Save
          </button>
        </div>
      )}

      <div className="shrink-0" style={{ borderBottom: '2px solid #1a1a1a' }}>
        <OfficeFloor
          agentStatus={agentStatus}
          lastBrief={lastBrief}
          selected={selected}
          onSelect={setSelected}
        />
      </div>

      {tasks.length > 0 && (
        <div
          className="shrink-0 px-2 py-1 flex gap-1 overflow-x-auto"
          style={{ borderBottom: '2px solid #1a1a1a', background: '#0d1117' }}
        >
          {tasks.map((t) => {
            const m = agentMeta(t.assignee)
            return (
              <span
                key={t.id}
                style={{
                  flexShrink: 0,
                  fontSize: 9,
                  padding: '2px 6px',
                  background: '#1e2329',
                  color: '#848e9c',
                  boxShadow: '1px 1px 0 #1a1a1a',
                }}
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

      <div
        className="shrink-0 p-2 space-y-1.5"
        style={{ borderTop: '3px solid #1a1a1a', background: '#0d1117' }}
      >
        <div className="flex flex-wrap gap-1">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              style={{
                fontSize: 9,
                padding: '3px 6px',
                background: '#1e2329',
                color: '#eaecef',
                border: 'none',
                boxShadow: '2px 2px 0 #1a1a1a',
                cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.4 : 1,
              }}
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
            className="flex-1 min-w-0 px-2 py-1.5 text-[11px]"
            style={{
              background: '#0b0e11',
              border: '2px solid #1a1a1a',
              color: '#eaecef',
              outline: 'none',
            }}
            placeholder={`Ask ${agentMeta(selected).name} or the floor…`}
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 800,
              background: '#F4D35E',
              color: '#1a1a1a',
              border: 'none',
              boxShadow: '2px 2px 0 #1a1a1a',
              opacity: busy || !input.trim() ? 0.4 : 1,
              cursor: busy || !input.trim() ? 'default' : 'pointer',
            }}
          >
            {busy ? '…' : 'SEND'}
          </button>
        </form>
        <p style={{ fontSize: 8, color: '#5e6673', lineHeight: 1.3 }}>
          Interpretazione multi-agente, non consiglio finanziario. Nessun ordine dal desk.
        </p>
      </div>
    </div>
  )
}
