/**
 * Local AI desk chat – answers from live TA + SMC + Liquidity context + mode.
 */

import type { TaReport } from './taEngine'
import type { SmcReport } from './smcEngine'
import type { LiquidityReport } from './liquidityEngine'

export type AiMode =
  | 'technical'
  | 'fundamental'
  | 'scalp'
  | 'swing'
  | 'risk'
  | 'draw'
  | 'smc'

export const AI_MODES: { id: AiMode; label: string; hint: string }[] = [
  { id: 'technical', label: 'Technical', hint: 'Structure, S/R, fib, bias' },
  { id: 'smc', label: 'SMC', hint: 'FVG, Order Block, BOS, Volume Profile' },
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
  fvg: boolean
  orderBlock: boolean
  bos: boolean
  volumeProfile: boolean
  /** Liquidity autodraw */
  highLow: boolean
  imbalance: boolean
  balance: boolean
  positionBias: boolean
}

export const DEFAULT_DRAW_OPTS: DrawOptions = {
  support: true,
  resistance: true,
  trend: true,
  fib: true,
  label: true,
  fvg: true,
  orderBlock: true,
  bos: true,
  volumeProfile: true,
  highLow: true,
  imbalance: true,
  balance: true,
  positionBias: true,
}

function fmt(n: number, d = 4) {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(d)
}

export function answerMessage(
  userText: string,
  report: TaReport | null,
  mode: AiMode,
  smc: SmcReport | null = null,
  liq: LiquidityReport | null = null
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

  const wantsDraw =
    /\b(draw|disegn|auto-?draw|paint|traccia|livelli sul grafico)\b/.test(q)
  const wantsBias = /\b(bias|direzione|bull|bear|trend|verso)\b/.test(q)
  const wantsSr = /\b(support|resist|s\/r|livell|zone)\b/.test(q)
  const wantsFib = /\b(fib|retracement|ritracci)\b/.test(q)
  const wantsEntry = /\b(entry|ingresso|long|short|buy|sell)\b/.test(q)
  const wantsRisk = /\b(risk|stop|sl|tp|rr|rischio|position)\b/.test(q)
  const wantsFvg = /\b(fvg|fair value|gap)\b/.test(q)
  const wantsOb = /\b(order\s*block|ob\b|blocco)\b/.test(q)
  const wantsVp = /\b(volume\s*profile|poc|vah|val|vp\b)\b/.test(q)
  const wantsBos = /\b(bos|choch|structure|struttura|break)\b/.test(q)
  const wantsLiq =
    /\b(liquidit|imbalance|balance|high\s*\/?\s*low|highlow|posizione|long\s*short)\b/.test(
      q
    )
  const wantsHelp = /\b(help|aiuto|comandi|cosa puoi)\b/.test(q)

  if (wantsHelp || q === '?' || q === 'help') {
    return {
      text: [
        'Posso rispondere su:',
        '• bias / trend / S/R / fib',
        '• **FVG** · **Order Block** · **BOS/CHoCH** · **Volume Profile**',
        '• **High/Low** · **Imbalance** · **Balance** · **Long/Short** (liquidity)',
        '• entry / risk framing',
        '• “disegna” → Auto-draw sul chart',
        '',
        `Modalità: **${mode}** — checkbox Draw options.`,
      ].join('\n'),
      suggestDraw: false,
    }
  }

  const parts: string[] = []

  switch (mode) {
    case 'scalp':
      parts.push(
        `[SCALP] Range pos ${r.rangePos.toFixed(0)}% · livelli vicini prioritari.`
      )
      break
    case 'swing':
      parts.push(`[SWING] Bias **${r.bias}** su ${r.interval}.`)
      break
    case 'risk':
      parts.push('[RISK] Framing rischio — non size advice.')
      break
    case 'fundamental':
      parts.push('[FUND] Contesto macro/crypto; segnale primario = prezzo.')
      break
    case 'smc':
      parts.push('[SMC] FVG · Order Block · BOS/CHoCH · Volume Profile')
      break
    case 'draw':
      parts.push(
        '[DRAW] S/R, trend, fib, FVG, OB, BOS, VP, High/Low, Imbalance, Balance, Long/Short.'
      )
      break
    default:
      parts.push(`[TA] ${r.symbol} ${r.interval}`)
  }

  if (wantsBias || mode === 'technical' || mode === 'swing') {
    parts.push(
      `Bias **${r.bias.toUpperCase()}** · last ${fmt(r.last.close)} · range ${r.rangePos.toFixed(0)}%.`
    )
  }

  if (wantsSr || mode === 'scalp' || mode === 'technical') {
    if (r.supports.length) parts.push(`Supporti: ${r.supports.map((p) => fmt(p)).join(' · ')}`)
    if (r.resistances.length)
      parts.push(`Resistenze: ${r.resistances.map((p) => fmt(p)).join(' · ')}`)
  }

  if (wantsFib && r.fib) {
    parts.push(
      'Fib: ' +
        r.fib.levels
          .filter((l) => [0.382, 0.5, 0.618].includes(l.ratio))
          .map((l) => `${(l.ratio * 100).toFixed(0)}% ${fmt(l.price)}`)
          .join(' · ')
    )
  }

  if (smc && (wantsFvg || mode === 'smc')) {
    const open = smc.fvgs.filter((z) => !z.mitigated)
    if (!open.length) parts.push('Nessun FVG aperto recente.')
    else {
      parts.push('FVG aperti:')
      for (const z of open.slice(-4)) {
        parts.push(
          `  · ${z.kind} ${fmt(z.bottom)}–${fmt(z.top)}${z.mitigated ? ' (mit)' : ''}`
        )
      }
    }
  }

  if (smc && (wantsOb || mode === 'smc')) {
    if (!smc.orderBlocks.length) parts.push('Nessun order block rilevato nel lookback.')
    else {
      parts.push('Order blocks:')
      for (const ob of smc.orderBlocks.slice(-4)) {
        parts.push(`  · ${ob.kind} OB ${fmt(ob.bottom)}–${fmt(ob.top)}`)
      }
    }
  }

  if (smc && (wantsBos || mode === 'smc')) {
    if (!smc.breaks.length) parts.push('Nessun BOS/CHoCH recente.')
    else {
      const last = smc.breaks[smc.breaks.length - 1]
      parts.push(
        `Ultima struttura: **${last.kind.toUpperCase()}** ${last.direction} @ ${fmt(last.price)}`
      )
    }
  }

  if (smc && (wantsVp || mode === 'smc')) {
    const vp = smc.volumeProfile
    if (!vp) parts.push('Volume profile non disponibile (pochi dati).')
    else {
      parts.push(
        `Volume Profile · **POC** ${fmt(vp.poc)} · VAL ${fmt(vp.val)} · VAH ${fmt(vp.vah)}`
      )
    }
  }

  if (liq && (wantsLiq || wantsEntry || mode === 'scalp' || mode === 'smc' || mode === 'draw')) {
    parts.push('— Liquidity —')
    parts.push(...liq.summary)
    if (liq.bias === 'long') {
      parts.push('Pressione **LONG** (book+tape). Conferma con struttura TA/SMC.')
    } else if (liq.bias === 'short') {
      parts.push('Pressione **SHORT** (book+tape). Conferma con struttura TA/SMC.')
    } else {
      parts.push('Book/tape **neutrali** — attendi sbilanciamento.')
    }
  }

  if (wantsEntry || mode === 'scalp' || mode === 'swing') {
    if (r.bias === 'bullish' && r.supports[0]) {
      parts.push(
        `Idea long (framing): retest ~${fmt(r.supports[0])}; invalidazione sotto swing low.`
      )
    } else if (r.bias === 'bearish' && r.resistances[0]) {
      parts.push(
        `Idea short (framing): retest ~${fmt(r.resistances[0])}; invalidazione sopra swing high.`
      )
    } else {
      parts.push('Struttura mista: attendi break + retest.')
    }
  }

  if (wantsRisk || mode === 'risk') {
    const ref =
      r.bias === 'bullish'
        ? r.supports[0]
        : r.bias === 'bearish'
          ? r.resistances[0]
          : null
    if (ref) {
      const pct = (Math.abs(r.last.close - ref) / r.last.close) * 100
      parts.push(
        `Distanza a ref ${fmt(ref)}: ~${pct.toFixed(2)}%. Stop strutturale tipicamente oltre quel livello.`
      )
    }
  }

  if (wantsDraw || mode === 'draw' || mode === 'smc') {
    parts.push(
      'Per disegnare: checkbox (FVG, High/Low, Long/Short, …) + **Auto-draw**, o scrivi “disegna”.'
    )
  }

  if (parts.length <= 1) parts.push(...r.summary)
  if (smc) parts.push(...smc.summary)
  if (liq && !wantsLiq) parts.push(...liq.summary.slice(0, 2))

  parts.push('_Non è consulenza finanziaria. Dati dalle candele live._')

  return {
    text: parts.join('\n\n'),
    suggestDraw: wantsDraw || mode === 'draw',
  }
}
