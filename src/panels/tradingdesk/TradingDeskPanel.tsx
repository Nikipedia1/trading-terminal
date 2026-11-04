/**
 * Trading Desk — each monitor shows real OHLC for that agent's asset.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { getExchangeClient } from '@/data/exchanges/registry'
import { fetchKlinesPage } from '@/data/klines/history'
import type { Interval, ExchangeId } from '@/types'
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
  renameSeat,
  tickAutonomy,
  type AutonomyAgent,
  type AutonomyReport,
  type DeskSlot,
  RESEARCH_UNIVERSE,
} from './autonomy'
import type { DeskAgentId, DeskAgentStatus, DeskMessage } from './types'

const QUICK = [
  'Report completo',
  'Position call',
  'Floor brief',
  'Technical bias',
  'Orderflow',
  'News risk',
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
      <div style={{ maxWidth: '88%', padding: '6px 10px', background: isUser ? '#1e2329' : '#0d1117', border: `1px solid ${meta?.color || '#2a3140'}`, boxShadow: '2px 2px 0 #1a1a1a' }}>
        {!isUser && meta && (
          <div style={{ fontSize: 10, color: meta.color, fontWeight: 700, marginBottom: 2 }}>
            {meta.name} · {meta.role}
          </div>
        )}
        <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#eaecef' }}>{m.text}</div>
      </div>
    </div>
  )
}

export function TradingDeskPanel({ panelId }: { panelId: string }) {
  const layoutPanel = useLayoutStore((s) => s.panels.find((p) => p.id === panelId))
  const { symbol: linkedSymbol, interval: linkedInterval, exchange: linkedExchange } = useResolvedChartLink(panelId)
  const market = usePanelMarket(panelId)
  const symbol = String(linkedSymbol || market?.symbol || 'BTCUSDT').toUpperCase()
  const interval = (linkedInterval || market?.interval || '15m') as Interval
  const exchange = (linkedExchange || market?.exchange || 'binance') as ExchangeId

  const marketCandles = useMarketStore((s) => s.candles)
  const marketSymbol = useMarketStore((s) => s.symbol)
  const [linkedCandles, setLinkedCandles] = useState(marketCandles)
  const candles =
    String(marketSymbol || '').toUpperCase() === symbol
      ? marketCandles
      : linkedCandles

  const [slots, setSlots] = useState<DeskSlot[]>(() => defaultSlots())
  const [agents3d, setAgents3d] = useState<AutonomyAgent[]>(() => agentsFromSlots(defaultSlots()))
  const agentsRef = useRef(agents3d)
  agentsRef.current = agents3d
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [selected, setSelected] = useState<DeskAgentId>('orchestrator')
  const [messages, setMessages] = useState<DeskMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [autonomous, setAutonomous] = useState(true)
  const [autoReports, setAutoReports] = useState<AutonomyReport[]>([])
  const [agentStatus, setAgentStatus] = useState<Record<string, DeskAgentStatus>>({})
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiSettings, setAiSettings] = useState<AiApiSettings>(() => loadAiSettings())
  const [monitorCandleMap, setMonitorCandleMap] = useState<Record<string, { o: number; h: number; l: number; c: number }[]>>({})
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    agentsRef.current = agentsFromSlots(slots)
    setAgents3d(agentsRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // multi-symbol klines for monitors
  useEffect(() => {
    let cancelled = false
    const assets = Array.from(new Set(
      [symbol, ...agentsRef.current.map((a) => a.asset), ...RESEARCH_UNIVERSE.slice(0, 6)]
        .filter((s): s is string => typeof s === 'string' && s.length > 0)
        .map((s) => s.toUpperCase())
    ))
    ;(async () => {
      const client = getExchangeClient(exchange)
      const map: Record<string, { o: number; h: number; l: number; c: number }[]> = {}
      await Promise.all(
        assets.map(async (sym) => {
          try {
            const page = await fetchKlinesPage(client, sym, interval, { limit: 48 })
            map[sym] = page.map((k: any) => ({
              o: Number(k.open ?? k.o),
              h: Number(k.high ?? k.h),
              l: Number(k.low ?? k.l),
              c: Number(k.close ?? k.c),
            })).filter((b) => Number.isFinite(b.c))
          } catch { /* */ }
        })
      )
      if (!cancelled) setMonitorCandleMap(map)
    })()
    return () => { cancelled = true }
  }, [symbol, interval, exchange, agents3d.length])

  useEffect(() => {
    if (String(marketSymbol || '').toUpperCase() === symbol) return
    let cancelled = false
    ;(async () => {
      try {
        const client = getExchangeClient(exchange)
        const page = await fetchKlinesPage(client, symbol, interval, { limit: 200 })
        if (!cancelled) setLinkedCandles(page as typeof marketCandles)
      } catch { /* */ }
    })()
    return () => { cancelled = true }
  }, [symbol, interval, exchange, marketSymbol])

  useEffect(() => {
    if (!autonomous) return
    const id = window.setInterval(() => {
      const candleMap: Record<string, typeof candles> = {}
      for (const a of agentsRef.current) {
        const key = String(a.asset || 'BTCUSDT').toUpperCase()
        if (monitorCandleMap[key]?.length) {
          candleMap[key] = monitorCandleMap[key]!.map((b, i) => ({
            time: i as never,
            open: b.o, high: b.h, low: b.l, close: b.c, volume: 0,
          })) as typeof candles
        }
      }
      if (candles?.length) candleMap[symbol] = candles
      const { agents, reports } = tickAutonomy(agentsRef.current, slots, candleMap)
      agentsRef.current = agents
      setAgents3d(agents)
      if (reports.length) setAutoReports((prev) => [...reports, ...prev].slice(0, 8))
    }, 900)
    return () => clearInterval(id)
  }, [autonomous, slots, candles, symbol, monitorCandleMap])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages, autoReports])

  const ctx = useMemo(() => ({
    symbol,
    interval: String(interval),
    exchange: String(exchange),
    lastPrice: candles?.length ? candles[candles.length - 1]!.close : null,
    candleCount: candles?.length ?? 0,
  }), [symbol, interval, exchange, candles])

  const run = useCallback(
    async (text: string) => {
      const q = text.trim()
      if (!q || busy) return
      setBusy(true)
      setInput('')
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: q, ts: Date.now() }])
      try {
        const result = await runDeskBriefing(q, candles || [], ctx, (id, status) => {
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
    setRenameDraft('')
  }

  const applyRename = () => {
    if (!selectedSlotId || !renameDraft.trim()) return
    const res = renameSeat(slots, agentsRef.current, selectedSlotId, renameDraft)
    setSlots(res.slots)
    agentsRef.current = res.agents
    setAgents3d(res.agents)
  }

  const onSelectSlot = useCallback((id: string) => {
    setSelectedSlotId(id)
    setSlots((cur) => {
      const s = cur.find((x) => x.id === id)
      if (s) {
        setSelected(s.agentId)
        setRenameDraft(s.name)
      }
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
            {symbol} · {interval} · {String(exchange).toUpperCase()} · {agents3d.length} agents · {autonomous ? 'AUTO ON' : 'AUTO OFF'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={{ fontSize: 11, padding: '4px 10px', background: autonomous ? '#0ecb81' : '#2b3139', color: autonomous ? '#0b0e11' : '#eaecef', border: 'none', boxShadow: '2px 2px 0 #1a1a1a', fontWeight: 700, cursor: 'pointer' }} onClick={() => setAutonomous((v) => !v)}>
            {autonomous ? 'AUTO' : 'PAUSE'}
          </button>
          <button type="button" style={{ fontSize: 11, padding: '4px 10px', background: '#2b3139', color: '#eaecef', border: 'none', boxShadow: '2px 2px 0 #1a1a1a', cursor: 'pointer' }} onClick={() => setSettingsOpen((v) => !v)}>
            AI
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div className="shrink-0 px-2 py-2 space-y-2" style={{ background: '#0d1117', borderBottom: '2px solid #1a1a1a' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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
        <Office3D
          slots={slots}
          agents={agents3d}
          agentsLiveRef={agentsRef}
          selectedSlotId={selectedSlotId}
          onSelectSlot={onSelectSlot}
          candleMap={monitorCandleMap}
          interval={String(interval)}
          exchange={String(exchange)}
        />
      </div>

      <div className="shrink-0 px-2 py-2 flex flex-wrap items-center gap-2" style={{ borderBottom: '2px solid #1a1a1a', background: '#0d1117' }}>
        <span style={{ fontSize: 10, color: '#848e9c' }}>POSTI</span>
        {([
          'masterchief', 'technical', 'orderflow', 'risk', 'sentiment', 'trader',
          'news', 'analyst', 'strategist', 'quant',
        ] as DeskAgentId[]).map((id) => (
          <button key={id} type="button" onClick={() => hire(id)} title={agentMeta(id).tagline} style={{ fontSize: 11, padding: '4px 8px', background: id === 'masterchief' ? '#0a2e24' : '#1e2329', color: agentMeta(id).color, border: id === 'masterchief' ? '1px solid #00e5a8' : 'none', boxShadow: '1px 1px 0 #1a1a1a', cursor: 'pointer', fontWeight: id === 'masterchief' ? 700 : 400 }}>
            + {agentMeta(id).name}
          </button>
        ))}
        <button type="button" disabled={!selectedSlotId || slots.find((s) => s.id === selectedSlotId)?.isBoss} onClick={fire} style={{ fontSize: 11, padding: '4px 8px', background: '#2e0a12', color: '#f6465d', border: 'none', boxShadow: '1px 1px 0 #1a1a1a', cursor: 'pointer', opacity: !selectedSlotId ? 0.4 : 1 }}>
          − Rimuovi posto
        </button>
        {selectedAgent && (
          <>
            <span style={{ fontSize: 11, color: '#F4D35E', marginLeft: 6 }}>
              {selectedAgent.name}: {selectedAgent.activity} · {selectedAgent.asset}
            </span>
            <input
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyRename() }}
              placeholder="Rinomina…"
              style={{ width: 110, fontSize: 11, padding: '3px 6px', background: '#0b0e11', border: '1px solid #2a3140', color: '#eaecef', marginLeft: 4 }}
            />
            <button type="button" onClick={applyRename} disabled={!renameDraft.trim()} style={{ fontSize: 11, padding: '3px 8px', background: '#F4D35E', color: '#1a1a1a', border: 'none', boxShadow: '1px 1px 0 #1a1a1a', cursor: 'pointer', fontWeight: 700, opacity: !renameDraft.trim() ? 0.4 : 1 }}>
              OK nome
            </button>
          </>
        )}
      </div>

      {autoReports[0] && (
        <div className="shrink-0 px-3 py-2.5" style={{ borderBottom: '2px solid #1a1a1a', background: '#0f1612', fontFamily: 'ui-monospace, monospace' }}>
          <div style={{ fontSize: 10, color: '#848e9c', marginBottom: 4 }}>
            CAPO · LIVE ·{' '}
            <span style={{ color: autoReports[0].bias === 'bullish' ? '#0ecb81' : autoReports[0].bias === 'bearish' ? '#f6465d' : '#848e9c' }}>
              {String(autoReports[0].bias || 'neutral').toUpperCase()}
            </span>
          </div>
          <div style={{ color: '#eaecef', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto' }}>
            {autoReports[0].body}
          </div>
        </div>
      )}

      <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
        {messages.map((m) => (
          <MsgBubble key={m.id} m={m} />
        ))}
      </div>

      <div className="shrink-0 px-2 py-1.5 flex flex-wrap gap-1" style={{ borderTop: '2px solid #1a1a1a', background: '#0d1117' }}>
        {QUICK.map((q) => (
          <button key={q} type="button" disabled={busy} style={{ fontSize: 11, padding: '4px 8px', background: q === 'Report completo' || q === 'Position call' ? '#0ecb81' : '#1e2329', color: q === 'Report completo' || q === 'Position call' ? '#0b0e11' : '#eaecef', border: 'none', boxShadow: '2px 2px 0 #1a1a1a', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1, fontWeight: q === 'Report completo' || q === 'Position call' ? 700 : 400 }} onClick={() => run(q)}>
            {q}
          </button>
        ))}
      </div>

      <form
        className="shrink-0 flex gap-2 px-2 py-2"
        style={{ borderTop: '2px solid #1a1a1a', background: '#0b0e11' }}
        onSubmit={(e) => {
          e.preventDefault()
          run(input)
        }}
      >
        <input
          className="flex-1 px-2 py-1.5 text-[12px]"
          style={{ background: '#12161c', border: '2px solid #1a1a1a', color: '#eaecef', outline: 'none' }}
          placeholder={`Ask ${agentMeta(selected).name} or Report completo…`}
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={busy || !input.trim()} style={{ fontSize: 11, padding: '4px 12px', background: '#F4D35E', color: '#1a1a1a', border: 'none', boxShadow: '2px 2px 0 #1a1a1a', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.4 : 1 }}>
          Send
        </button>
      </form>
    </div>
  )
}

export default TradingDeskPanel
