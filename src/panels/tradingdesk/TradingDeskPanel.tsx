/**
 * Trading Desk — 3D autonomous office.
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
import { Office3D } from './Office3D'
import {
  addSeat,
  agentsFromSlots,
  defaultSlots,
  removeSeat,
  tickAutonomy,
  type AutonomyAgent,
  type AutonomyReport,
  type DeskSlot,
  RESEARCH_UNIVERSE,
} from './autonomy'
import type { DeskAgentId, DeskAgentStatus, DeskMessage, DeskTask } from './types'

const QUICK = [
  'Report completo',
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
      <div style={{ fontSize: 10, textAlign: 'center', color: '#848e9c', fontFamily: 'monospace', padding: '4px 0' }}>
        {m.text}
      </div>
    )
  }
  const isUser = m.role === 'user'
  const meta = m.agentId ? agentMeta(m.agentId) : null
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
      <div
        style={{
          maxWidth: '94%',
          padding: '8px 10px',
          fontSize: 12,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          fontFamily: 'ui-monospace, monospace',
          background: isUser ? '#F4D35E' : '#1e2329',
          color: isUser ? '#1a1a1a' : '#eaecef',
          boxShadow: '2px 2px 0 #1a1a1a',
        }}
      >
        {!isUser && meta && (
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: meta.color }}>
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
    (link.linkedPanelId && panels.some((p) => p.id === link.linkedPanelId) ? link.linkedPanelId : null) ||
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

  const [slots, setSlots] = useState<DeskSlot[]>(() => defaultSlots())
  const [agents3d, setAgents3d] = useState<AutonomyAgent[]>(() => agentsFromSlots(defaultSlots()))
  const [autonomous, setAutonomous] = useState(true)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [autoReports, setAutoReports] = useState<AutonomyReport[]>([])
  const [agentStatus, setAgentStatus] = useState<Record<DeskAgentId, DeskAgentStatus>>(() => {
    const init = {} as Record<DeskAgentId, DeskAgentStatus>
    for (const a of DESK_AGENTS) init[a.id] = 'idle'
    return init
  })
  const [messages, setMessages] = useState<DeskMessage[]>([
    {
      id: 'welcome',
      role: 'sys',
      text: '3D Desk — premi “Report completo” per analisi dettagliata sull\'asset del chart.',
      ts: Date.now(),
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<DeskAgentId>('orchestrator')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiSettings, setAiSettings] = useState<AiApiSettings>(() => loadAiSettings())
  const scroller = useRef<HTMLDivElement>(null)
  const agentsRef = useRef(agents3d)
  const slotsRef = useRef(slots)
  agentsRef.current = agents3d
  slotsRef.current = slots

  const candleMap = useMemo(() => {
    const map: Record<string, typeof candles> = {}
    map[symbol] = candles
    for (const s of RESEARCH_UNIVERSE) if (!map[s]) map[s] = candles
    return map
  }, [symbol, candles])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastUi = 0
    const loop = (t: number) => {
      const dt = Math.min(50, t - last)
      last = t
      const res = tickAutonomy(
        agentsRef.current,
        slotsRef.current,
        Date.now(),
        dt,
        candleMap as Record<string, typeof candles>,
        autonomous
      )
      agentsRef.current = res.agents
      if (t - lastUi > 120) {
        lastUi = t
        setAgents3d(res.agents)
      }
      if (res.reports.length) {
        setAutoReports((prev) => [...res.reports, ...prev].slice(0, 40))
        setMessages((prev) => [
          ...prev,
          ...res.reports.map((r) => ({
            id: r.id,
            role: 'agent' as const,
            agentId: r.agentId,
            text: r.body,
            ts: r.ts,
          })),
        ])
        for (const r of res.reports) {
          setAgentStatus((st) => ({ ...st, [r.agentId]: 'ready' }))
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [autonomous, candleMap])

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
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: q, ts: Date.now() }])
      setInput('')
      try {
        const result = await runDeskBriefing(q, candles, ctx, (id, status) => {
          setAgentStatus((s) => ({ ...s, [id]: status }))
        })
        setMessages((prev) => [...prev, ...result.messages])
        setAgentStatus((s) => {
          const next = { ...s }
          for (const a of DESK_AGENTS) if (next[a.id] === 'thinking') next[a.id] = 'ready'
          return next
        })
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, role: 'sys', text: `Desk error: ${e instanceof Error ? e.message : 'unknown'}`, ts: Date.now() },
        ])
      } finally {
        setBusy(false)
      }
    },
    [busy, candles, ctx]
  )

  const hire = (id: DeskAgentId) => {
    const res = addSeat(slots, agentsRef.current, id)
    setSlots(res.slots)
    agentsRef.current = res.agents
    setAgents3d(res.agents)
  }

  const fire = () => {
    if (!selectedSlotId) return
    const res = removeSeat(slots, agentsRef.current, selectedSlotId)
    setSlots(res.slots)
    agentsRef.current = res.agents
    setAgents3d(res.agents)
    setSelectedSlotId(null)
  }

  const onSelectSlot = useCallback((id: string) => {
    setSelectedSlotId(id)
    setSlots((cur) => {
      const s = cur.find((x) => x.id === id)
      if (s) setSelected(s.agentId)
      return cur
    })
  }, [])

  const selectedAgent = agents3d.find((a) => a.slotId === selectedSlotId)

  return (
    <div className="h-full min-h-0 flex flex-col" style={{ background: '#12161c', color: '#eaecef', fontFamily: 'ui-monospace, monospace' }}>
      <div className="shrink-0 flex items-center justify-between gap-2 px-2 py-1.5" style={{ background: '#6E1423', borderBottom: '3px solid #1a1a1a' }}>
        <div className="min-w-0">
          <div style={{ fontSize: 12, fontWeight: 800, color: '#F4D35E', letterSpacing: '0.06em' }}>MUNDER · 3D TRADING DESK</div>
          <div style={{ fontSize: 10, color: '#f0c9c9' }}>
            {symbol} · {interval} · {agents3d.length} agents · {autonomous ? 'AUTO ON' : 'AUTO OFF'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={{ fontSize: 11, padding: '4px 10px', background: autonomous ? '#0ecb81' : '#2b3139', color: autonomous ? '#0b0e11' : '#eaecef', border: 'none', boxShadow: '2px 2px 0 #1a1a1a', fontWeight: 700, cursor: 'pointer' }} onClick={() => setAutonomous((v) => !v)}>
            {autonomous ? 'AUTO' : 'PAUSE'}
          </button>
          <button type="button" style={{ fontSize: 11, padding: '4px 10px', background: '#F4D35E', color: '#1a1a1a', border: 'none', boxShadow: '2px 2px 0 #1a1a1a', fontWeight: 700, cursor: 'pointer' }} onClick={() => setSettingsOpen((v) => !v)}>
            AI API
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div className="shrink-0 p-2 space-y-1.5 text-[11px]" style={{ background: '#1a1214', borderBottom: '2px solid #1a1a1a' }}>
          <div style={{ color: '#848e9c' }}>Keys in sessionStorage. Local engine works without key.</div>
          <div className="flex flex-wrap gap-1">
            {AI_PROVIDERS.map((p) => (
              <button key={p.id} type="button" style={{ padding: '3px 8px', border: 'none', boxShadow: '1px 1px 0 #1a1a1a', background: aiSettings.provider === p.id ? '#F4D35E' : '#2b3139', color: aiSettings.provider === p.id ? '#1a1a1a' : '#eaecef', fontSize: 11, cursor: 'pointer' }} onClick={() => setAiSettings((s) => ({ ...s, provider: p.id as AiProviderId, model: p.defaultModel }))}>
                {p.label}
              </button>
            ))}
          </div>
          {aiSettings.provider !== 'local' && (
            <>
              <input className="w-full px-2 py-1.5 text-[12px]" style={{ background: '#0b0e11', border: '2px solid #1a1a1a', color: '#eaecef' }} placeholder="API key" type="password" value={aiSettings.apiKey} onChange={(e) => setAiSettings((s) => ({ ...s, apiKey: e.target.value }))} />
              <input className="w-full px-2 py-1.5 text-[12px]" style={{ background: '#0b0e11', border: '2px solid #1a1a1a', color: '#eaecef' }} placeholder="Model" value={aiSettings.model} onChange={(e) => setAiSettings((s) => ({ ...s, model: e.target.value }))} />
            </>
          )}
          <button type="button" style={{ fontSize: 11, padding: '4px 10px', background: '#F4D35E', color: '#1a1a1a', border: 'none', boxShadow: '2px 2px 0 #1a1a1a', fontWeight: 700 }} onClick={() => { saveAiSettings(aiSettings); setSettingsOpen(false) }}>
            Save
          </button>
        </div>
      )}

      <div className="shrink-0" style={{ borderBottom: '2px solid #1a1a1a' }}>
        <Office3D slots={slots} agents={agents3d} agentsLiveRef={agentsRef} selectedSlotId={selectedSlotId} onSelectSlot={onSelectSlot} />
      </div>

      <div className="shrink-0 px-2 py-2 flex flex-wrap items-center gap-2" style={{ borderBottom: '2px solid #1a1a1a', background: '#0d1117' }}>
        <span style={{ fontSize: 10, color: '#848e9c' }}>POSTI</span>
        {(['technical', 'orderflow', 'risk', 'sentiment', 'trader'] as DeskAgentId[]).map((id) => (
          <button key={id} type="button" onClick={() => hire(id)} style={{ fontSize: 11, padding: '4px 8px', background: '#1e2329', color: agentMeta(id).color, border: 'none', boxShadow: '1px 1px 0 #1a1a1a', cursor: 'pointer' }}>
            + {agentMeta(id).name}
          </button>
        ))}
        <button type="button" disabled={!selectedSlotId || slots.find((s) => s.id === selectedSlotId)?.isBoss} onClick={fire} style={{ fontSize: 11, padding: '4px 8px', background: '#2e0a12', color: '#f6465d', border: 'none', boxShadow: '1px 1px 0 #1a1a1a', cursor: 'pointer', opacity: !selectedSlotId ? 0.4 : 1 }}>
          − Rimuovi posto
        </button>
        {selectedAgent && (
          <span style={{ fontSize: 11, color: '#F4D35E', marginLeft: 6 }}>
            {selectedAgent.name}: {selectedAgent.activity} · {selectedAgent.asset}
          </span>
        )}
      </div>

      {autoReports[0] && (
        <div className="shrink-0 px-3 py-2.5" style={{ borderBottom: '2px solid #1a1a1a', background: '#0f1612', fontFamily: 'ui-monospace, monospace' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#0b0e11', background: '#0ecb81', fontWeight: 800, fontSize: 11, padding: '4px 10px', letterSpacing: '0.06em' }}>
              CAPO
            </span>
            <span style={{ color: '#F4D35E', fontWeight: 700, fontSize: 14 }}>{autoReports[0].name}</span>
            <span style={{ color: '#848e9c', fontSize: 13 }}>{autoReports[0].asset}</span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                fontWeight: 700,
                color:
                  autoReports[0].bias === 'bullish'
                    ? '#0ecb81'
                    : autoReports[0].bias === 'bearish'
                      ? '#f6465d'
                      : '#848e9c',
              }}
            >
              {autoReports[0].bias.toUpperCase()}
            </span>
          </div>
          <div style={{ color: '#eaecef', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto' }}>
            {autoReports[0].body}
          </div>
        </div>
      )}

      <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
        {messages.map((m) => (
          <MsgBubble key={m.id} m={m} />
        ))}
      </div>

      <div className="shrink-0 p-2 space-y-2" style={{ borderTop: '3px solid #1a1a1a', background: '#0d1117' }}>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button key={q} type="button" disabled={busy} style={{ fontSize: 11, padding: '4px 8px', background: q === 'Report completo' ? '#0ecb81' : '#1e2329', color: q === 'Report completo' ? '#0b0e11' : '#eaecef', border: 'none', boxShadow: '2px 2px 0 #1a1a1a', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1, fontWeight: q === 'Report completo' ? 700 : 400 }} onClick={() => run(q)}>
              {q}
            </button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(input) }}>
          <input className="flex-1 min-w-0 px-2 py-2 text-[12px]" style={{ background: '#0b0e11', border: '2px solid #1a1a1a', color: '#eaecef', outline: 'none' }} placeholder={`Ask ${agentMeta(selected).name} or Report completo…`} value={input} disabled={busy} onChange={(e) => setInput(e.target.value)} />
          <button type="submit" disabled={busy || !input.trim()} style={{ flexShrink: 0, padding: '8px 14px', fontSize: 12, fontWeight: 800, background: '#F4D35E', color: '#1a1a1a', border: 'none', boxShadow: '2px 2px 0 #1a1a1a', opacity: busy || !input.trim() ? 0.4 : 1, cursor: busy || !input.trim() ? 'default' : 'pointer' }}>
            {busy ? '…' : 'SEND'}
          </button>
        </form>
        <p style={{ fontSize: 9, color: '#5e6673', lineHeight: 1.35 }}>
          Report completo = TA + SMC + liquidità + risk + setup sull\'asset del chart. Solo analisi.
        </p>
      </div>
    </div>
  )
}
