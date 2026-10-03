/** Minimal IT/EN strings for desk chrome. */

export type Locale = 'en' | 'it'

const EN = {
  'app.loading': 'Loading desk…',
  'app.desktopRecommended': 'Best experience on desktop (≥768px). Mobile is simplified read-only stack.',
  'app.continueMobile': 'Continue on mobile',
  'tour.skip': 'Skip',
  'tour.next': 'Next',
  'tour.back': 'Back',
  'tour.finish': 'Finish',
  'checklist.title': 'Get started',
  'checklist.paper': 'Open Paper trading and place a practice order',
  'checklist.liveData': 'Start live market data on the chart',
  'checklist.risk': 'Review risk limits (daily loss / exposure)',
  'checklist.workspace': 'Save a workspace (local or cloud)',
  'checklist.exchange': 'Optional: unlock Live Keys only after paper is comfortable',
  'checklist.dismiss': 'Hide checklist',
  'error.retry': 'Retry',
  'error.network': 'Network error. Check connection and try again.',
  'empty.noData': 'No data yet',
  'perf.panelWarn': 'Many panels open – performance may drop. Close unused widgets.',
  'help.open': 'User guide',
} as const

const IT: Record<keyof typeof EN, string> = {
  'app.loading': 'Caricamento desk…',
  'app.desktopRecommended': 'Esperienza ottimale su desktop (≥768px). Su mobile il layout è semplificato.',
  'app.continueMobile': 'Continua su mobile',
  'tour.skip': 'Salta',
  'tour.next': 'Avanti',
  'tour.back': 'Indietro',
  'tour.finish': 'Fine',
  'checklist.title': 'Per iniziare',
  'checklist.paper': 'Apri Paper trading e invia un ordine di prova',
  'checklist.liveData': 'Avvia i dati live sul grafico',
  'checklist.risk': 'Controlla i limiti di rischio (perdita giornaliera / esposizione)',
  'checklist.workspace': 'Salva un workspace (locale o cloud)',
  'checklist.exchange': 'Opzionale: Live Keys solo dopo aver praticato in paper',
  'checklist.dismiss': 'Nascondi checklist',
  'error.retry': 'Riprova',
  'error.network': 'Errore di rete. Controlla la connessione e riprova.',
  'empty.noData': 'Nessun dato',
  'perf.panelWarn': 'Molti pannelli aperti – le prestazioni possono calare. Chiudi i widget inutili.',
  'help.open': 'Guida utente',
}

export type MessageKey = keyof typeof EN

const STORAGE = 'tt-locale:v1'

export function getLocale(): Locale {
  try {
    const v = localStorage.getItem(STORAGE)
    if (v === 'it' || v === 'en') return v
  } catch {
    /* */
  }
  try {
    const nav = navigator.language?.toLowerCase() || 'en'
    if (nav.startsWith('it')) return 'it'
  } catch {
    /* */
  }
  return 'en'
}

export function setLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE, locale)
  } catch {
    /* */
  }
  window.dispatchEvent(new CustomEvent('tt-locale', { detail: locale }))
}

export function t(key: MessageKey, locale?: Locale): string {
  const loc = locale ?? getLocale()
  if (loc === 'it') return IT[key] ?? EN[key]
  return EN[key]
}
