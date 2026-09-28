/**
 * Local AI desk chat – answers from live TA context + mode.
 * No synthetic prices; optional future xAI proxy.
 */

import type { TaReport } from './taEngine'

export type AiMode =
  | 'technical'
  | 'fundamental'
  | 'scalp'
  | 'swing'
  | 'risk'
  | 'draw'

export const AI_MODES: { id: AiMode; label: string; hint: string }[] = [
  { id: 'technical', label: 'Technical', hint: 'Structure, S/R, fib, bias' },
  { id: 'fundamental', label: 'Fundamental', hint: 'Macro / crypto context' },
  { id: 'scalp', label: 'Scalp', hint: 'Short-term levels & tape focus' },
  { id: 'swing', label: 'Swing', hint: 'Multi-session structure' },
  { id: 'risk', label: 'Risk', hint: 'Stops, RR, position framing' },
  { id: 'draw', label: 'Draw', hint: 'What to paint on the chart' },
]

export interface DrawOptions {
  support: boolean
  resistance: boolean
  trend: boolean
  fib: boolean
  label: boolean
}

export const DEFAULT_DRAW_OPTS: DrawOptions = {
  support: true,
  resistance: true,
  trend: true,
  fib: true,
  label: true,
}

function fmt(n: number, d = 4) {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(d)
}

export function buildContextBlock(report: TaReport | null, mode: AiMode): string {
  if (!report || !report.last) {
    return 'No TA report yet. Run analysis or load candles first.'
  }
  const lines = [
    `Symbol ${report.symbol} · TF ${report.interval}`,
    `Last ${fmt(report.last.close)}  H ${fmt(report.last.high)}  L ${fmt(report.last.low)}`,
    `Bias ${report.bias} · range pos ${report.rangePos.toFixed(0)}%`,
    `Supports: ${report.supports.map((p) => fmt(p)).join(', ') || '—'}`,
    `Resistances: ${report.resistances.map((p) => fmt(p)).join(', ') || '—'}`,
    `Mode: ${mode}`,
  ]
  return lines.join('\n')
}

/** Rule-based reply from user message + TA + mode */
export function answerMessage(
  userText: string,
  report: TaReport | null,
  mode: AiMode
): { text: string; suggestDraw: boolean } {
  const q = userText.trim().toLowerCase()
  const r = report

  if (!r || !r.last) {
    return {
      text:
        'Non ho ancora candele/analisi. Premi **Analyze** o aspetta il live feed, poi riprova.',
      suggestDraw: false,
    }
  }

  // Intent detection
  const wantsDraw =
    /\b(draw|disegn|auto-?draw|paint|traccia|livelli sul grafico)\b/.test(q)
  const wantsBias = /\b(bias|direzione|bull|bear|trend|verso)\b/.test(q)
  const wantsSr = /\b(support|resist|s\/r|livell|zone)\b/.test(q)
  const wantsFib = /\b(fib|retracement|ritracci)\b/.test(q)
  const wantsEntry = /\b(entry|ingresso|long|short|buy|sell)\b/.test(q)
  const wantsRisk = /\b(risk|stop|sl|tp|rr|rischio|position)\b/.test(q)
  const wantsHelp = /\b(help|aiuto|comandi|cosa puoi)\b/.test(q)

  if (wantsHelp || q === '?' || q === 'help') {
    return {
      text: [
        'Posso rispondere su:',
        '• bias / trend / struttura',
        '• supporti e resistenze',
        '• fib',
        '• entry idea (solo framing, non consiglio finanziario)',
        '• risk / stop / RR',
        '• “disegna” → livelli sul chart',
        '',
        `Modalità attiva: **${mode}**`,
        'Cambia mode dal selettore sopra. Opzioni draw: S/R, trend, fib, label.',
      ].join('\n'),
      suggestDraw: false,
    }
  }

  const parts: string[] = []

  // Mode preamble
  switch (mode) {
    case 'scalp':
      parts.push(
        `[SCALP] Focus su livelli vicini e range pos ${r.rangePos.toFixed(0)}%. Preferisci reazioni su micro-S/R piuttosto che bias di lungo periodo.`
      )
      break
    case 'swing':
      parts.push(
        `[SWING] Guarda struttura multi-sessione. Bias corrente **${r.bias}** su ${r.interval}.`
      )
      break
    case 'risk':
      parts.push('[RISK] Framing rischio — non size advice automatico.')
      break
    case 'fundamental':
      parts.push(
        '[FUND] Contesto: funding, OI, ETF flows, DXY — non ho un feed news live; uso solo struttura prezzo.'
      )
      break
    case 'draw':
      parts.push('[DRAW] Posso tracciare S/R, trendline, fib e label sul chart primario.')
      break
    default:
      parts.push(`[TA] ${r.symbol} ${r.interval}`)
  }

  if (wantsBias || mode === 'technical' || mode === 'swing') {
    parts.push(
      `Bias struttura: **${r.bias.toUpperCase()}**. Prezzo ${fmt(r.last.close)}, posizione nel range recente ${r.rangePos.toFixed(0)}%.`
    )
    if (r.trend) {
      parts.push(
        `Trendline swing: ${fmt(r.trend.from.price)} → ${fmt(r.trend.to.price)} (${r.trend.slope > 0 ? 'rising' : 'falling'}).`
      )
    }
  }

  if (wantsSr || mode === 'scalp' || mode === 'technical') {
    if (r.supports.length) {
      parts.push(`Supporti: ${r.supports.map((p) => fmt(p)).join(' · ')}`)
    }
    if (r.resistances.length) {
      parts.push(`Resistenze: ${r.resistances.map((p) => fmt(p)).join(' · ')}`)
    }
    if (!r.supports.length && !r.resistances.length) {
      parts.push('Pochi swing chiari per cluster S/R — prova TF più alto o più history.')
    }
  }

  if (wantsFib && r.fib) {
    parts.push(
      `Fib (ultimo swing): ` +
        r.fib.levels
          .filter((l) => [0.382, 0.5, 0.618].includes(l.ratio))
          .map((l) => `${(l.ratio * 100).toFixed(0)}% ${fmt(l.price)}`)
          .join(' · ')
    )
  }

  if (wantsEntry || mode === 'scalp' || mode === 'swing') {
    if (r.bias === 'bullish' && r.supports[0]) {
      parts.push(
        `Idea long (framing): retest area ~${fmt(r.supports[0])} con conferma; invalidazione sotto lo swing low.`
      )
    } else if (r.bias === 'bearish' && r.resistances[0]) {
      parts.push(
        `Idea short (framing): retest area ~${fmt(r.resistances[0])}; invalidazione sopra lo swing high.`
      )
    } else {
      parts.push(
        'Struttura mista: meglio aspettare break + retest del livello più vicino prima di size.'
      )
    }
  }

  if (wantsRisk || mode === 'risk') {
    const ref =
      r.bias === 'bullish'
        ? r.supports[0]
        : r.bias === 'bearish'
          ? r.resistances[0]
          : null
    if (ref && r.last) {
      const dist = Math.abs(r.last.close - ref)
      const pct = (dist / r.last.close) * 100
      parts.push(
        `Distanza al livello di riferimento ${fmt(ref)}: ~${pct.toFixed(2)}% dal last. Uno stop strutturale tipicamente oltre quel livello (valuta tu la size).`
      )
    } else {
      parts.push('Definisci stop oltre lo swing opposto; RR ≥ 1.5 solo se il target ha liquidità/struttura.')
    }
  }

  if (mode === 'fundamental') {
    parts.push(
      'Fondamentali crypto da monitorare a parte: funding rate, open interest, liquidazioni, dominance BTC, flussi ETF, calendario macro. Qui il segnale primario resta il prezzo.'
    )
  }

  if (wantsDraw || mode === 'draw') {
    parts.push(
      'Per disegnare sul grafico: attiva le opzioni (S/R, trend, fib, label) e premi **Auto-draw**, oppure scrivi “disegna”.'
    )
  }

  // Generic fallback if few parts
  if (parts.length <= 1) {
    parts.push(...r.summary)
  }

  parts.push('_Non è consulenza finanziaria. Dati dalle tue candele live._')

  return { text: parts.join('\n\n'), suggestDraw: wantsDraw || mode === 'draw' }
}
