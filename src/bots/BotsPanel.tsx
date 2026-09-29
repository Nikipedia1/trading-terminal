/**
 * Trading Bots desk – strategies + risk + market sentiment.
 */

import { useMemo, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { useBotStore } from './botStore'
import { useBotRunner } from './useBotRunner'
import {
  BOT_KIND_META,
  ensureRisk,
  type BotInstance,
  type BotKind,
  type BotParams,
  type BotRiskConfig,
  type SentimentMode,
  type SizingMode,
} from './types'
import { botKindList } from './engine'
import type { SentimentSnapshot } from './sentiment'

function fmt(n: number, d = 2) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

function sentimentColor(label: string) {
  if (label.includes('extreme_fear') || label === 'fear') return 'text-[#f6465d]'
  if (label.includes('extreme_greed') || label === 'greed') return 'text-[#0ecb81]'
  return 'text-[#848e9c]'
}

export function BotsPanel() {
  const sentiment = useBotRunner()
  const bots = useBotStore((s) => s.bots)
  const addBot = useBotStore((s) => s.addBot)
  const removeBot = useBotStore((s) => s.removeBot)
  const setEnabled = useBotStore((s) => s.setEnabled)
  const patchConfig = useBotStore((s) => s.patchConfig)
  const patchParams = useBotStore((s) => s.patchParams)
  const resetStats = useBotStore((s) => s.resetStats)
  const updateBot = useBotStore((s) => s.updateBot)
  const symbol = useMarketStore((s) => s.symbol)
  const ticker = useMarketStore((s) => s.ticker)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newKind, setNewKind] = useState<BotKind>('rsi')
  const [tab, setTab] = useState<'setup' | 'risk'>('setup')
  const selected = useMemo(
    () => bots.find((b) => b.id === selectedId) ?? bots[0] ?? null,
    [bots, selectedId]
  )
  const running = bots.filter((b) => b.enabled).length
  const onCreate = () => {
    const id = addBot(newKind, undefined, symbol)
    setSelectedId(id)
  }
  const patchRisk = (partial: Partial<BotRiskConfig>) => {
    if (!selected) return
    const cfg = ensureRisk(selected.config)
    patchConfig(selected.id, { risk: { ...cfg.risk, ...partial } })
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[11px] text-[#eaecef]">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex items-center gap-2 flex-wrap">
        <span className="text-[9px] text-[#848e9c] uppercase tracking-wider">Bots</span>
        <span className="text-[10px] text-[#5e6673]">
          {running} running · {bots.length} total
        </span>
        {ticker && (
          <span className="text-[10px] font-mono text-[#848e9c]">
            {symbol} {fmt(ticker.lastPrice, 2)}
          </span>
        )}
        {sentiment && <SentimentBadge s={sentiment} />}
      </div>

      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex gap-1.5 flex-wrap items-center">
        <select
          value={newKind}
          onChange={(e) => setNewKind(e.target.value as BotKind)}
          className="bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1 text-[11px]"
        >
          {botKindList().map((k) => (
            <option key={k} value={k}>
              {BOT_KIND_META[k].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onCreate}
          className="px-2 py-1 rounded bg-[#0ecb81]/20 text-[#0ecb81] border border-[#0ecb81]/40 font-semibold"
        >
          + Create
        </button>
        <span className="text-[9px] text-[#5e6673]">{BOT_KIND_META[newKind].hint}</span>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="w-[38%] min-w-[7.5rem] border-r border-[#1e2329] overflow-y-auto">
          {bots.length === 0 ? (
            <p className="p-3 text-[10px] text-[#5e6673]">
              Create a bot, set risk + sentiment, then Start with live chart data.
            </p>
          ) : (
            bots.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                className={`w-full text-left px-2 py-1.5 border-b border-[#1e2329] hover:bg-[#12161c] ${
                  selected?.id === b.id ? 'bg-[#12161c]' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium truncate">{b.name}</span>
                  <span className={`text-[9px] ${b.enabled ? 'text-[#0ecb81]' : 'text-[#5e6673]'}`}>
                    {b.enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="text-[9px] text-[#848e9c]">
                  {BOT_KIND_META[b.kind].label} · {b.config.symbol}
                </div>
                {b.lastSignal && (
                  <div className="text-[9px] text-[#5e6673] truncate">{b.lastSignal}</div>
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto p-2 space-y-2">
          {!selected ? (
            <p className="text-[10px] text-[#5e6673]">Select or create a bot</p>
          ) : (
            <>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setTab('setup')}
                  className={`px-2 py-0.5 rounded text-[10px] border ${
                    tab === 'setup'
                      ? 'border-[#f0b90b]/50 text-[#f0b90b]'
                      : 'border-[#2b3139] text-[#848e9c]'
                  }`}
                >
                  Setup
                </button>
                <button
                  type="button"
                  onClick={() => setTab('risk')}
                  className={`px-2 py-0.5 rounded text-[10px] border ${
                    tab === 'risk'
                      ? 'border-[#f0b90b]/50 text-[#f0b90b]'
                      : 'border-[#2b3139] text-[#848e9c]'
                  }`}
                >
                  Risk & Sentiment
                </button>
              </div>
              {tab === 'setup' ? (
                <BotSetup
                  bot={selected}
                  onEnable={(v) => setEnabled(selected.id, v)}
                  onRemove={() => {
                    removeBot(selected.id)
                    setSelectedId(null)
                  }}
                  onPatchConfig={(c) => patchConfig(selected.id, c)}
                  onPatchParams={(p) => patchParams(selected.id, p)}
                  onRename={(n) => updateBot(selected.id, { name: n })}
                  onResetStats={() => resetStats(selected.id)}
                  chartSymbol={symbol}
                />
              ) : (
                <RiskEditor
                  bot={selected}
                  sentiment={sentiment}
                  patchRisk={patchRisk}
                  onPatchConfig={(c) => patchConfig(selected.id, c)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SentimentBadge({ s }: { s: SentimentSnapshot }) {
  return (
    <span
      className={`ml-auto text-[10px] font-medium ${sentimentColor(s.label)}`}
      title={`mom ${s.components.momentum.toFixed(2)} · rsi ${s.components.rsi.toFixed(2)} · vol ${s.components.volume.toFixed(2)}`}
    >
      {s.label.replace('_', ' ')} {s.score >= 0 ? '+' : ''}
      {s.score.toFixed(2)}
    </span>
  )
}

function BotSetup({
  bot,
  onEnable,
  onRemove,
  onPatchConfig,
  onPatchParams,
  onRename,
  onResetStats,
  chartSymbol,
}: {
  bot: BotInstance
  onEnable: (v: boolean) => void
  onRemove: () => void
  onPatchConfig: (c: Partial<BotInstance['config']>) => void
  onPatchParams: (p: BotParams) => void
  onRename: (n: string) => void
  onResetStats: () => void
  chartSymbol: string
}) {
  const cfg = bot.config
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 items-center">
        <input
          className="flex-1 min-w-[6rem] bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1"
          value={bot.name}
          onChange={(e) => onRename(e.target.value)}
        />
        <button
          type="button"
          onClick={() => onEnable(!bot.enabled)}
          className={`px-2 py-1 rounded font-semibold border ${
            bot.enabled
              ? 'bg-[#0ecb81]/20 text-[#0ecb81] border-[#0ecb81]/40'
              : 'bg-[#1e2329] text-[#848e9c] border-[#2b3139]'
          }`}
        >
          {bot.enabled ? 'Stop' : 'Start'}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="px-2 py-1 rounded text-[#f6465d] border border-[#f6465d]/30"
        >
          Delete
        </button>
      </div>
      {bot.lastError && <p className="text-[10px] text-[#f6465d]">{bot.lastError}</p>}
      {bot.lastSignal && <p className="text-[10px] text-[#5b8def]">Last: {bot.lastSignal}</p>}
      <div className="grid grid-cols-2 gap-1.5">
        <Field label="Symbol" value={cfg.symbol} onChange={(v) => onPatchConfig({ symbol: v.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
        <Field label="Qty (fixed)" value={String(cfg.qty)} onChange={(v) => onPatchConfig({ qty: Number(v) })} />
        <Field label="Leverage" value={String(cfg.leverage)} onChange={(v) => onPatchConfig({ leverage: Number(v) })} />
        <Field label="Cooldown (s)" value={String(cfg.cooldownSec)} onChange={(v) => onPatchConfig({ cooldownSec: Number(v) })} />
        <Field label="TP %" value={cfg.takeProfitPct == null ? '' : String(cfg.takeProfitPct)} onChange={(v) => onPatchConfig({ takeProfitPct: v === '' ? null : Number(v) })} />
        <Field label="SL %" value={cfg.stopLossPct == null ? '' : String(cfg.stopLossPct)} onChange={(v) => onPatchConfig({ stopLossPct: v === '' ? null : Number(v) })} />
      </div>
      <div className="text-[9px] text-[#848e9c] uppercase tracking-wider pt-1">Strategy</div>
      <StrategyFields params={bot.params} onChange={onPatchParams} />
      <div className="flex items-center justify-between text-[10px] text-[#5e6673] pt-1 border-t border-[#1e2329]">
        <span>
          Trades {bot.stats.trades} · day {bot.runtime?.dayTrades ?? 0}
        </span>
        <button type="button" onClick={onResetStats} className="text-[#848e9c] hover:text-[#eaecef]">
          Reset stats
        </button>
      </div>
      {bot.enabled && bot.config.symbol !== chartSymbol && (
        <p className="text-[9px] text-[#f0b90b]">Switch chart to {bot.config.symbol}</p>
      )}
    </div>
  )
}

function RiskEditor({
  bot,
  sentiment,
  patchRisk,
  onPatchConfig,
}: {
  bot: BotInstance
  sentiment: SentimentSnapshot | null
  patchRisk: (p: Partial<BotRiskConfig>) => void
  onPatchConfig: (c: Partial<BotInstance['config']>) => void
}) {
  const risk = ensureRisk(bot.config).risk
  return (
    <div className="space-y-2">
      <p className="text-[9px] text-[#5e6673] leading-snug">
        Risk gates run before every paper order. Sentiment = momentum + RSI + volume (+ Fear&Greed).
      </p>
      {sentiment && (
        <div className="rounded border border-[#2b3139] bg-[#12161c] px-2 py-1.5 space-y-1">
          <div className="flex justify-between">
            <span className="text-[9px] text-[#848e9c] uppercase">Market sentiment</span>
            <span className={sentimentColor(sentiment.label)}>
              {sentiment.label.replace('_', ' ')} ({sentiment.score >= 0 ? '+' : ''}
              {sentiment.score.toFixed(2)})
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-[9px] text-[#5e6673]">
            <span>Mom {sentiment.components.momentum.toFixed(2)}</span>
            <span>RSI {sentiment.components.rsi.toFixed(2)}</span>
            <span>Vol {sentiment.components.volume.toFixed(2)}</span>
            <span>
              F&G{' '}
              {sentiment.components.fearGreed != null
                ? sentiment.components.fearGreed.toFixed(2)
                : '—'}
            </span>
          </div>
        </div>
      )}
      <div className="text-[9px] text-[#848e9c] uppercase">Position sizing</div>
      <div className="grid grid-cols-2 gap-1.5">
        <label className="space-y-0.5">
          <span className="text-[9px] text-[#848e9c]">Mode</span>
          <select
            className="w-full bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1"
            value={risk.sizingMode}
            onChange={(e) => patchRisk({ sizingMode: e.target.value as SizingMode })}
          >
            <option value="fixed">Fixed qty</option>
            <option value="risk_pct">Risk % of equity</option>
          </select>
        </label>
        <Field label="Risk / trade %" value={String(risk.riskPerTradePct)} onChange={(v) => patchRisk({ riskPerTradePct: Number(v) })} />
        <Field label="Max leverage" value={risk.maxLeverage == null ? '' : String(risk.maxLeverage)} onChange={(v) => patchRisk({ maxLeverage: v === '' ? null : Number(v) })} />
        <Field label="Max qty" value={risk.maxQty == null ? '' : String(risk.maxQty)} onChange={(v) => patchRisk({ maxQty: v === '' ? null : Number(v) })} />
      </div>
      <div className="text-[9px] text-[#848e9c] uppercase pt-1">Limits</div>
      <div className="grid grid-cols-2 gap-1.5">
        <Field label="Max daily loss %" value={risk.maxDailyLossPct == null ? '' : String(risk.maxDailyLossPct)} onChange={(v) => patchRisk({ maxDailyLossPct: v === '' ? null : Number(v) })} />
        <Field label="Max exposure %" value={risk.maxExposurePct == null ? '' : String(risk.maxExposurePct)} onChange={(v) => patchRisk({ maxExposurePct: v === '' ? null : Number(v) })} />
        <Field label="Max open positions" value={risk.maxOpenPositions == null ? '' : String(risk.maxOpenPositions)} onChange={(v) => patchRisk({ maxOpenPositions: v === '' ? null : Number(v) })} />
        <label className="flex items-center gap-2 pt-4">
          <input type="checkbox" checked={risk.requireStopLoss} onChange={(e) => patchRisk({ requireStopLoss: e.target.checked })} />
          <span className="text-[10px] text-[#848e9c]">Require SL</span>
        </label>
      </div>
      <div className="text-[9px] text-[#848e9c] uppercase pt-1">Sentiment filter</div>
      <div className="grid grid-cols-2 gap-1.5">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={risk.useSentiment} onChange={(e) => patchRisk({ useSentiment: e.target.checked })} />
          <span className="text-[10px] text-[#848e9c]">Use sentiment</span>
        </label>
        <label className="space-y-0.5">
          <span className="text-[9px] text-[#848e9c]">Mode</span>
          <select
            className="w-full bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1"
            value={risk.sentimentMode}
            onChange={(e) => patchRisk({ sentimentMode: e.target.value as SentimentMode })}
            disabled={!risk.useSentiment}
          >
            <option value="filter">Filter (block against)</option>
            <option value="align">Align</option>
            <option value="scale">Scale size by score</option>
            <option value="off">Off</option>
          </select>
        </label>
        <Field label="Min score (long)" value={String(risk.sentimentMinScore)} onChange={(v) => patchRisk({ sentimentMinScore: Number(v) })} />
      </div>
      <p className="text-[9px] text-[#5e6673] leading-snug">
        Risk % sizing needs SL % in Setup. Daily loss pauses entries until UTC day reset.
      </p>
      <button
        type="button"
        className="text-[10px] text-[#848e9c] underline"
        onClick={() =>
          onPatchConfig({
            risk: {
              sizingMode: 'risk_pct',
              riskPerTradePct: 1,
              maxDailyLossPct: 5,
              maxExposurePct: 50,
              maxOpenPositions: 3,
              maxLeverage: 20,
              maxQty: null,
              requireStopLoss: true,
              useSentiment: true,
              sentimentMode: 'filter',
              sentimentMinScore: -0.15,
            },
          })
        }
      >
        Reset risk defaults
      </button>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="space-y-0.5">
      <span className="text-[9px] text-[#848e9c]">{label}</span>
      <input
        className="w-full bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1 font-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function StrategyFields({
  params,
  onChange,
}: {
  params: BotParams
  onChange: (p: BotParams) => void
}) {
  if (params.kind === 'grid') {
    return (
      <div className="grid grid-cols-2 gap-1.5">
        <Num label="Levels" value={params.grid.levels} onChange={(v) => onChange({ kind: 'grid', grid: { ...params.grid, levels: v } })} />
        <Num label="Range %" value={params.grid.rangePct} onChange={(v) => onChange({ kind: 'grid', grid: { ...params.grid, rangePct: v } })} />
      </div>
    )
  }
  if (params.kind === 'dca') {
    return (
      <div className="grid grid-cols-2 gap-1.5">
        <Num label="Interval min" value={params.dca.intervalMin} onChange={(v) => onChange({ kind: 'dca', dca: { ...params.dca, intervalMin: v } })} />
        <Num label="Max orders" value={params.dca.maxOrders} onChange={(v) => onChange({ kind: 'dca', dca: { ...params.dca, maxOrders: v } })} />
      </div>
    )
  }
  if (params.kind === 'rsi') {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        <Num label="Period" value={params.rsi.period} onChange={(v) => onChange({ kind: 'rsi', rsi: { ...params.rsi, period: v } })} />
        <Num label="Oversold" value={params.rsi.oversold} onChange={(v) => onChange({ kind: 'rsi', rsi: { ...params.rsi, oversold: v } })} />
        <Num label="Overbought" value={params.rsi.overbought} onChange={(v) => onChange({ kind: 'rsi', rsi: { ...params.rsi, overbought: v } })} />
      </div>
    )
  }
  if (params.kind === 'ema_cross') {
    return (
      <div className="grid grid-cols-2 gap-1.5">
        <Num label="Fast EMA" value={params.ema.fast} onChange={(v) => onChange({ kind: 'ema_cross', ema: { ...params.ema, fast: v } })} />
        <Num label="Slow EMA" value={params.ema.slow} onChange={(v) => onChange({ kind: 'ema_cross', ema: { ...params.ema, slow: v } })} />
      </div>
    )
  }
  if (params.kind === 'breakout') {
    return (
      <div className="grid grid-cols-2 gap-1.5">
        <Num label="Lookback" value={params.breakout.lookback} onChange={(v) => onChange({ kind: 'breakout', breakout: { ...params.breakout, lookback: v } })} />
        <Num label="Buffer %" value={params.breakout.bufferPct} onChange={(v) => onChange({ kind: 'breakout', breakout: { ...params.breakout, bufferPct: v } })} />
      </div>
    )
  }
  if (params.kind === 'bollinger') {
    return (
      <div className="grid grid-cols-2 gap-1.5">
        <Num label="Period" value={params.bollinger.period} onChange={(v) => onChange({ kind: 'bollinger', bollinger: { ...params.bollinger, period: v } })} />
        <Num label="StdDev" value={params.bollinger.stdDev} onChange={(v) => onChange({ kind: 'bollinger', bollinger: { ...params.bollinger, stdDev: v } })} />
      </div>
    )
  }
  return null
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="space-y-0.5">
      <span className="text-[9px] text-[#848e9c]">{label}</span>
      <input
        type="number"
        step="any"
        className="w-full bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1 font-mono"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}
