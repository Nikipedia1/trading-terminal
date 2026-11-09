/** Static copy & section data for NACS Lab landing */
export const FEATURES = [
  { icon: '▣', title: 'Order Block X-Ray', body: 'Detection BOS + body zone, mitigation (fresh/tested/mitigated/broken), quality score e R:R su ATR. Board BULLISH / BEARISH / PICKS con sector cap e filtro liquidità.' },
  { icon: '◆', title: 'Trading Desk 3D', body: 'Ufficio virtuale con agenti (Scanner, Analyst, Risk), monitor collegati ai pannelli e loop di autonomia con orchestrazione tra ruoli.' },
  { icon: '◎', title: 'Ops Scanner', body: 'Scanner operativo su universo crypto: strength, purezza del movimento, liquidità e ranking. Solo setup puliti restano in board.' },
  { icon: '▤', title: 'Grafici istituzionali', body: 'Lightweight Charts, volume profile, deep print, footprint, delta, zone overlay, VWAP e livelli Z / S1 / R1 / R2 ancorati alle coordinate reali.' },
  { icon: '◈', title: 'Multi-panel Workspace', body: 'React Grid Layout: ridimensiona e combina i moduli. Ogni pannello resta indipendente e sincronizzato sul simbolo primario del desk.' },
  { icon: '⚡', title: 'Dati live Binance & KuCoin', body: 'Ticker, klines, trades e order book pubblici. Nessun dato finto: errori espliciti, socket condivisi e reconnect con backoff.' },
  { icon: '◐', title: 'Paper Trading', body: 'Account simulato locale: long/short, market/limit, cross/isolated, leverage, TP/SL e liquidazione. Nessuna API key richiesta.' },
  { icon: '◇', title: 'Microstructure & OFI', body: 'Trade feed con aggressor side, L2 book sincronizzato, OFI / MLOFI e moduli deep-analysis (Deep Print, Delta, Volume Profile).' },
  { icon: '☰', title: 'Workspace & hotkeys', body: 'Salvataggio layout, densità SCALP/RESEARCH, alert engine, onboarding e scorciatoie da tastiera per sessioni lunghe.' },
] as const

export const STEPS = [
  { n: '01', t: 'Apri il desk', d: 'Dopo il login (o guest read-only) carichi il workspace multi-panel con chart, scanner e moduli collegati.' },
  { n: '02', t: 'Scegli simbolo e timeframe', d: 'Dati reali da Binance o KuCoin. History + live stream; i pannelli restano sincronizzati sul primary symbol.' },
  { n: '03', t: 'Leggi struttura e liquidità', d: 'Order Block X-Ray, depth, volume profile e scanner filtrano il rumore: zone, BOS, PICKS e R:R.' },
  { n: '04', t: 'Opera o simula', d: 'Paper trading locale oppure, con account, trading self-directed via le tue chiavi exchange (mai custodial).' },
] as const

export const DATA_POINTS = [
  { t: 'Exchange', d: 'Binance e KuCoin — solo API pubbliche per market data' },
  { t: 'No fake data', d: 'Se il feed fallisce vedi errore esplicito, mai chart inventati' },
  { t: 'Socket condivisi', d: 'Un WebSocket per (exchange, symbol) con reference counting' },
  { t: 'Paper locale', d: 'Simulazione in localStorage — zero chiavi per esercitarsi' },
  { t: 'Self-directed', d: 'Trading reale solo con le tue API key; NACS non è broker' },
  { t: 'Privacy desk', d: 'Layout e paper account restano sul tuo dispositivo / cloud workspace' },
] as const

export const FAQ = [
  { q: 'Cos’è NACS Lab Terminal?', a: 'Un terminal multi-panel per visualizzazione di mercato crypto e trading self-directed. Non è un broker, un exchange né un consulente finanziario.' },
  { q: 'Serve un account per vedere i chart?', a: 'Puoi entrare come guest in sola lettura (chart e dati pubblici). Login completo sblocca trading, bot e chiavi live.' },
  { q: 'I dati sono reali?', a: 'Sì. Solo feed ufficiali Binance/KuCoin. Nessun dato sintetico: in caso di errore di rete o API vedi messaggi chiari.' },
  { q: 'Cos’è l’Order Block X-Ray?', a: 'Un modulo che cerca zone di order block con break of structure, body zone, stato di mitigation e quality score, più breadth settoriale e board PICKS.' },
  { q: 'Il paper trading usa soldi veri?', a: 'No. È un account simulato sul browser (margine, leverage, TP/SL). Utile per allenarsi senza API key.' },
  { q: 'NACS custodisce fondi?', a: 'No. Eventuali ordini reali passano dalle tue chiavi exchange. NACS Lab non detiene capitali e non esegue ordini per conto terzi.' },
] as const
