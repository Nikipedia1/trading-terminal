/**
 * Live numeric readout for active indicators (last bar values).
 */

import { useMemo } from 'react'
import type { Candle } from '@/types'
import {
  INDICATOR_CATALOG,
  type IndicatorParamsMap,
  type IndicatorValueRow,
  computeSma,
  computeEma,
  computeRsi,
  computeMacd,
  computeStoch,
  computeAtr,
  computeCci,
  computeWillR,
  computeMomentum,
  computeRoc,
  computeObv,
  computeMfi,
  computeAdx,
  computeVwap,
  lastValue,
  computeAo,
  computeTrix,
  computePpo,
  computeAroon,
  computeCmf,
  computeAdl,
  computeForce,
  computeUo,
  computeCmo,
  computeRvi,
  computeStdDev,
} from '@/indicators'

function fmt(n: number | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1000) return n.toFixed(1)
  if (Math.abs(n) >= 1) return n.toFixed(digits)
  return n.toFixed(4)
}

function buildRows(candles: Candle[], params: IndicatorParamsMap): IndicatorValueRow[] {
  if (candles.length === 0) return []
  const rows: IndicatorValueRow[] = []
  const push = (id: IndicatorValueRow['id'], label: string, values: IndicatorValueRow['values']) => {
    if (values.length) rows.push({ id, label, values })
  }

  if (params.rsi.visible) {
    const v = lastValue(computeRsi(candles, Math.max(2, params.rsi.period), params.rsi.source))
    push('rsi', 'RSI', [{ name: String(params.rsi.period), value: v ?? NaN, color: params.rsi.color }])
  }
  if (params.macd.visible) {
    let fast = Math.max(2, params.macd.period)
    let slow = Math.max(3, params.macd.period2)
    if (fast >= slow) slow = fast + 1
    const m = computeMacd(candles, fast, slow, Math.max(2, params.macd.period3), params.macd.source)
    const vals = []
    if (params.macd.show1)
      vals.push({ name: 'MACD', value: lastValue(m.macd) ?? NaN, color: params.macd.color })
    if (params.macd.show2)
      vals.push({ name: 'Sig', value: lastValue(m.signal) ?? NaN, color: params.macd.color2 })
    if (params.macd.show3)
      vals.push({ name: 'Hist', value: lastValue(m.hist) ?? NaN, color: params.macd.color3 })
    push('macd', 'MACD', vals)
  }
  if (params.stoch.visible) {
    const s = computeStoch(
      candles,
      Math.max(2, params.stoch.period),
      Math.max(1, params.stoch.period2),
      Math.max(1, params.stoch.period3)
    )
    const vals = []
    if (params.stoch.show1)
      vals.push({ name: '%K', value: lastValue(s.k) ?? NaN, color: params.stoch.color })
    if (params.stoch.show2)
      vals.push({ name: '%D', value: lastValue(s.d) ?? NaN, color: params.stoch.color2 })
    push('stoch', 'Stoch', vals)
  }
  if (params.cci.visible) {
    push('cci', 'CCI', [
      {
        name: String(params.cci.period),
        value: lastValue(computeCci(candles, Math.max(2, params.cci.period))) ?? NaN,
        color: params.cci.color,
      },
    ])
  }
  if (params.willr.visible) {
    push('willr', '%R', [
      {
        name: String(params.willr.period),
        value: lastValue(computeWillR(candles, Math.max(2, params.willr.period))) ?? NaN,
        color: params.willr.color,
      },
    ])
  }
  if (params.atr.visible) {
    push('atr', 'ATR', [
      {
        name: String(params.atr.period),
        value: lastValue(computeAtr(candles, Math.max(2, params.atr.period))) ?? NaN,
        color: params.atr.color,
      },
    ])
  }
  if (params.adx.visible) {
    const a = computeAdx(candles, Math.max(2, params.adx.period))
    const vals = []
    if (params.adx.show1)
      vals.push({ name: 'ADX', value: lastValue(a.adx) ?? NaN, color: params.adx.color })
    if (params.adx.show2)
      vals.push({ name: '+DI', value: lastValue(a.plusDI) ?? NaN, color: params.adx.color2 })
    if (params.adx.show3)
      vals.push({ name: '−DI', value: lastValue(a.minusDI) ?? NaN, color: params.adx.color3 })
    push('adx', 'ADX', vals)
  }
  if (params.mfi.visible) {
    push('mfi', 'MFI', [
      {
        name: String(params.mfi.period),
        value: lastValue(computeMfi(candles, Math.max(2, params.mfi.period))) ?? NaN,
        color: params.mfi.color,
      },
    ])
  }
  if (params.obv.visible) {
    push('obv', 'OBV', [
      { name: '', value: lastValue(computeObv(candles)) ?? NaN, color: params.obv.color },
    ])
  }
  if (params.momentum.visible) {
    push('momentum', 'Mom', [
      {
        name: String(params.momentum.period),
        value:
          lastValue(
            computeMomentum(candles, Math.max(1, params.momentum.period), params.momentum.source)
          ) ?? NaN,
        color: params.momentum.color,
      },
    ])
  }
  if (params.roc.visible) {
    push('roc', 'ROC', [
      {
        name: String(params.roc.period),
        value:
          lastValue(computeRoc(candles, Math.max(1, params.roc.period), params.roc.source)) ?? NaN,
        color: params.roc.color,
      },
    ])
  }
  if (params.sma.visible) {
    const vals = []
    if (params.sma.show1 && params.sma.period > 0)
      vals.push({
        name: `SMA${params.sma.period}`,
        value: lastValue(computeSma(candles, params.sma.period, params.sma.source)) ?? NaN,
        color: params.sma.color,
      })
    if (params.sma.show2 && params.sma.period2 > 0)
      vals.push({
        name: `SMA${params.sma.period2}`,
        value: lastValue(computeSma(candles, params.sma.period2, params.sma.source)) ?? NaN,
        color: params.sma.color2,
      })
    push('sma', 'SMA', vals)
  }
  if (params.ema.visible) {
    const vals = []
    if (params.ema.show1 && params.ema.period > 0)
      vals.push({
        name: `EMA${params.ema.period}`,
        value: lastValue(computeEma(candles, params.ema.period, params.ema.source)) ?? NaN,
        color: params.ema.color,
      })
    if (params.ema.show2 && params.ema.period2 > 0)
      vals.push({
        name: `EMA${params.ema.period2}`,
        value: lastValue(computeEma(candles, params.ema.period2, params.ema.source)) ?? NaN,
        color: params.ema.color2,
      })
    push('ema', 'EMA', vals)
  }
  if (params.vwap.visible) {
    push('vwap', 'VWAP', [
      { name: '', value: lastValue(computeVwap(candles)) ?? NaN, color: params.vwap.color },
    ])
  }
  if (params.ao?.visible) {
    push('ao', 'AO', [
      {
        name: '',
        value:
          lastValue(
            computeAo(candles, Math.max(2, params.ao.period), Math.max(3, params.ao.period2))
          ) ?? NaN,
        color: params.ao.color,
      },
    ])
  }
  if (params.trix?.visible) {
    push('trix', 'TRIX', [
      {
        name: String(params.trix.period),
        value:
          lastValue(computeTrix(candles, Math.max(2, params.trix.period), params.trix.source)) ??
          NaN,
        color: params.trix.color,
      },
    ])
  }
  if (params.ppo?.visible) {
    let f = Math.max(2, params.ppo.period)
    let s = Math.max(3, params.ppo.period2)
    if (f >= s) s = f + 1
    const p = computePpo(candles, f, s, Math.max(2, params.ppo.period3), params.ppo.source)
    push('ppo', 'PPO', [
      { name: 'PPO', value: lastValue(p.ppo) ?? NaN, color: params.ppo.color },
      { name: 'Sig', value: lastValue(p.signal) ?? NaN, color: params.ppo.color2 },
    ])
  }
  if (params.aroon?.visible) {
    const a = computeAroon(candles, Math.max(2, params.aroon.period))
    push('aroon', 'Aroon', [
      { name: 'Up', value: lastValue(a.up) ?? NaN, color: params.aroon.color },
      { name: 'Dn', value: lastValue(a.down) ?? NaN, color: params.aroon.color2 },
    ])
  }
  if (params.cmf?.visible) {
    push('cmf', 'CMF', [
      {
        name: String(params.cmf.period),
        value: lastValue(computeCmf(candles, Math.max(2, params.cmf.period))) ?? NaN,
        color: params.cmf.color,
      },
    ])
  }
  if (params.adl?.visible) {
    push('adl', 'ADL', [
      { name: '', value: lastValue(computeAdl(candles)) ?? NaN, color: params.adl.color },
    ])
  }
  if (params.force?.visible) {
    push('force', 'FI', [
      {
        name: String(params.force.period),
        value: lastValue(computeForce(candles, Math.max(2, params.force.period))) ?? NaN,
        color: params.force.color,
      },
    ])
  }
  if (params.uo?.visible) {
    push('uo', 'UO', [
      {
        name: '',
        value:
          lastValue(
            computeUo(
              candles,
              Math.max(2, params.uo.period),
              Math.max(2, params.uo.period2),
              Math.max(2, params.uo.period3)
            )
          ) ?? NaN,
        color: params.uo.color,
      },
    ])
  }
  if (params.cmo?.visible) {
    push('cmo', 'CMO', [
      {
        name: String(params.cmo.period),
        value:
          lastValue(computeCmo(candles, Math.max(2, params.cmo.period), params.cmo.source)) ?? NaN,
        color: params.cmo.color,
      },
    ])
  }
  if (params.rvi?.visible) {
    const r = computeRvi(candles, Math.max(2, params.rvi.period), Math.max(1, params.rvi.period2))
    push('rvi', 'RVI', [
      { name: 'RVI', value: lastValue(r.rvi) ?? NaN, color: params.rvi.color },
      { name: 'Sig', value: lastValue(r.signal) ?? NaN, color: params.rvi.color2 },
    ])
  }
  if (params.stddev?.visible) {
    push('stddev', 'σ', [
      {
        name: String(params.stddev.period),
        value:
          lastValue(
            computeStdDev(candles, Math.max(2, params.stddev.period), params.stddev.source)
          ) ?? NaN,
        color: params.stddev.color,
      },
    ])
  }

  // stable order by catalog
  const order = new Map(INDICATOR_CATALOG.map((m, i) => [m.id, i]))
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  return rows
}

export function IndicatorValuesHud({
  candles,
  params,
}: {
  candles: Candle[]
  params: IndicatorParamsMap
}) {
  const rows = useMemo(() => buildRows(candles, params), [candles, params])
  if (rows.length === 0) return null

  return (
    <div className="absolute top-2 left-2 z-20 max-w-[16rem] pointer-events-none select-none">
      <div className="bg-terminal-panel/90 border border-terminal-border rounded px-2 py-1.5 shadow text-[10px] font-mono-nums leading-relaxed">
        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-terminal-muted uppercase tracking-wide w-10 shrink-0">
              {row.label}
            </span>
            {row.values.map((v, i) => (
              <span key={i} style={{ color: v.color }}>
                {v.name ? `${v.name} ` : ''}
                <strong>{fmt(v.value)}</strong>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
