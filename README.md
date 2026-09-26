# Trading Terminal

Personal multi-panel trading terminal with **real-time data only** from Binance (KuCoin planned).

Inspired by KuCoin terminal UI (dark, high information density) and built with modular architecture.

## Absolute Constraints

1. **No fake data** – only real exchange APIs. Errors show explicit messages, never mock charts.
2. **Do not break what works** – every change lists touched functions + precise changelog.
3. **Modular** – data-layer / rendering / drawing-tools / indicators / layout-manager are separated.
4. **Anti-film** – any overlay (drawings, indicators) must stay anchored to real price/time via Lightweight Charts coordinate APIs and redraw on pan/zoom/resize/data update.

## Current Status (Step 1 complete)

- Vite + React 18 + TypeScript + Tailwind
- Binance Spot client (REST + WebSocket)
- Normalized types (Candle, Trade, OrderBook, Ticker)
- Zustand market store
- Verification UI: live candles table, trades tape, order book, ticker
- Auto-loads BTCUSDT 1m on start

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

Click **Load History** then **Start Live** (or just wait – auto-starts).

## Project Structure

```
src/
├── data/
│   └── exchanges/
│       ├── binance.ts      # Real REST + WS client
│       └── types.ts        # ExchangeClient interface
├── stores/
│   └── marketStore.ts      # Live state
├── types/
│   └── index.ts
├── App.tsx                 # Step-1 verification UI
└── ...
```

## Roadmap (approved plan)

1. ✅ Data-layer + verification UI
2. Chart base (Lightweight Charts) + coordinate bridge
3. Resizable / draggable multi-panel layout
4. Drawing tools (anchored)
5. Indicator framework + RSI / VWAP / Volume Profile
6. Deep analysis (divergences, correlation, order flow)
7. Alerts + layout persistence
8. Full KuCoin-style polish

## License

MIT
