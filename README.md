# Trading Terminal

Personal multi-panel trading terminal with **real-time data only** from Binance (KuCoin planned).

Inspired by KuCoin terminal UI (dark, high information density) and built with modular architecture.

## Absolute Constraints

1. **No fake data** – only real exchange APIs. Errors show explicit messages, never mock charts.
2. **Do not break what works** – every change lists touched functions + precise changelog.
3. **Modular** – data-layer / rendering / drawing-tools / indicators / layout-manager are separated.
4. **Anti-film** – any overlay (drawings, indicators) must stay anchored to real price/time via Lightweight Charts coordinate APIs and redraw on pan/zoom/resize/data update.

## Current Status (Step 2 complete)

- Vite + React 18 + TypeScript + Tailwind
- Binance Spot client (REST + WebSocket) – real data only
- Normalized types + Zustand market store
- **Lightweight Charts** candlestick + volume with live updates
- **CoordinateBridge** – single source of truth for price/time ↔ pixel (anti-pellicola)
- SeriesManager for clean series lifecycle
- ChartContainer with ResizeObserver + error overlay (no fake data on error)
- Side panels: Live Trades + Order Book
- Auto-loads BTCUSDT 1m on start

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

The chart loads real Binance data automatically.

## Project Structure

```
src/
├── charts/
│   ├── ChartContainer.tsx      # Main chart pane
│   ├── coordinate-bridge.ts    # Anti-pellicola conversions
│   └── series-manager.ts       # Candlestick + volume lifecycle
├── data/
│   └── exchanges/
│       ├── binance.ts          # Real REST + WS client
│       └── types.ts
├── stores/
│   └── marketStore.ts
├── types/
│   └── index.ts
└── App.tsx
```

## Roadmap

1. ✅ Data-layer + verification UI
2. ✅ Chart base (Lightweight Charts) + coordinate bridge
3. Resizable / draggable multi-panel layout
4. Drawing tools (anchored)
5. Indicator framework + RSI / VWAP / Volume Profile
6. Deep analysis (divergences, correlation, order flow)
7. Alerts + layout persistence
8. Full KuCoin-style polish

## License

MIT
