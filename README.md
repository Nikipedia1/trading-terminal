# Trading Terminal

Personal multi-panel trading terminal with **real-time data only** from Binance (KuCoin planned).

Inspired by KuCoin terminal UI (dark, high information density) and built with modular architecture.

## Absolute Constraints

1. **No fake data** – only real exchange APIs. Errors show explicit messages, never mock charts.
2. **Do not break what works** – every change lists touched functions + precise changelog.
3. **Modular** – data-layer / rendering / drawing-tools / indicators / layout-manager are separated.
4. **Anti-film** – any overlay (drawings, indicators) must stay anchored to real price/time via Lightweight Charts coordinate APIs and redraw on pan/zoom/resize/data update.

## Current Status (Step 3 complete)

- Vite + React 18 + TypeScript + Tailwind
- Binance Spot client (REST + WebSocket) – real data only
- Normalized types + Zustand market store
- **Lightweight Charts** candlestick + volume with live updates
- **CoordinateBridge** – per-chart instance (anti-pellicola)
- SeriesManager for clean series lifecycle
- **Multi-panel layout** (react-grid-layout magnetic grid)
  - `+` / `−` add/remove panels at runtime
  - Drag (header handle) + resize (borders/corners)
  - Independent symbol / timeframe / exchange per panel
  - Optional sync groups (A/B/C) for visible time range
  - Primary panel (★) feeds trades tape + order book
- Side panels: Live Trades + Order Book
- Auto-loads BTCUSDT 1m on start

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

The chart loads real Binance data automatically. Use **+** to add panels.

## Project Structure

```
src/
├── charts/
│   ├── ChartContainer.tsx      # Single chart pane + own CoordinateBridge
│   ├── ChartPanel.tsx          # Panel chrome (symbol/tf/exchange/sync)
│   ├── coordinate-bridge.ts    # Anti-pellicola conversions (per instance)
│   └── series-manager.ts       # Candlestick + volume lifecycle
├── data/
│   └── exchanges/
│       ├── binance.ts          # Real REST + WS client
│       └── types.ts
├── hooks/
│   └── usePanelMarket.ts       # Per-panel data subscription
├── layout/
│   └── PanelGrid.tsx           # react-grid-layout magnetic grid
├── stores/
│   ├── marketStore.ts          # Primary panel → trades/orderbook/ticker
│   └── layoutStore.ts          # Panels + layout + sync bus
├── types/
│   └── index.ts
└── App.tsx
```

## Changelog (Step 3 – multi-panel)

### Added
- `src/stores/layoutStore.ts` – panel list, grid layout, primary id, sync bus
- `src/hooks/usePanelMarket.ts` – independent kline subscription per panel
- `src/charts/ChartPanel.tsx` – header controls + ChartContainer
- `src/layout/PanelGrid.tsx` – react-grid-layout wrapper (+ button)

### Changed
- `src/charts/coordinate-bridge.ts` – removed singleton; one instance per ChartContainer
- `src/charts/ChartContainer.tsx` – props-driven (candles/status), per-instance bridge, sync group support, ResizeObserver unchanged (anti-pellicola)
- `src/types/index.ts` – `ChartPanelConfig`, `GridLayoutItem`, `ExchangeId`
- `src/App.tsx` – ChartArea + PanelGrid; primary panel syncs marketStore
- `src/index.css` – grid placeholder / resize-handle styling

### Untouched (no regressions)
- `src/data/exchanges/*` – data layer unchanged
- `src/stores/marketStore.ts` – still powers trades/orderbook/ticker
- `src/charts/series-manager.ts` – unchanged

## Roadmap

1. ✅ Data-layer + verification UI
2. ✅ Chart base (Lightweight Charts) + coordinate bridge
3. ✅ Resizable / draggable multi-panel layout
4. Drawing tools (anchored)
5. Indicator framework + RSI / VWAP / Volume Profile
6. Deep analysis (divergences, correlation, order flow)
7. Alerts + layout persistence
8. Full KuCoin-style polish

## License

MIT
