# Trading Terminal

Personal multi-panel trading terminal with **real-time data only** from Binance (KuCoin planned).

Inspired by KuCoin terminal UI (dark, high information density) and built with modular architecture.

## Absolute Constraints

1. **No fake data** – only real exchange APIs. Errors show explicit messages, never mock charts.
2. **Do not break what works** – every change lists touched functions + precise changelog.
3. **Modular** – data-layer / rendering / drawing-tools / indicators / layout-manager are separated.
4. **Anti-film** – any overlay (drawings, indicators) must stay anchored to real price/time via Lightweight Charts coordinate APIs and redraw on pan/zoom/resize/data update.

## Current Status (Step 4 complete)

- Vite + React 18 + TypeScript + Tailwind
- Binance Spot client (REST + WebSocket) – real data only
- Normalized types + Zustand market store
- **Lightweight Charts** candlestick + volume with live updates
- **CoordinateBridge** – per-chart instance (anti-pellicola)
- SeriesManager for clean series lifecycle
- **Multi-panel layout** (react-grid-layout magnetic grid)
- **Drawing tools** (anchored to time/price):
  - Trendline, horizontal, vertical, rectangle, parallel channel
  - Fibonacci retracement & extension, text annotations
  - Persist per panel+symbol (localStorage)
  - JSON export / import
  - Survive pan, zoom, panel drag/resize (no film effect)
- Side panels: Live Trades + Order Book
- Auto-loads BTCUSDT 1m on start

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

Use the drawing toolbar under each chart header. Click tool → click chart points.

## Project Structure

```
src/
├── charts/
│   ├── ChartContainer.tsx      # Chart + DrawingLayer host
│   ├── ChartPanel.tsx          # Panel chrome + DrawingToolbar
│   ├── coordinate-bridge.ts    # time/price ↔ pixel (per instance)
│   └── series-manager.ts
├── drawings/
│   ├── types.ts                # Logical drawing primitives
│   ├── drawingStore.ts         # Zustand + localStorage
│   ├── renderers.ts            # Pure canvas paint via bridge
│   ├── DrawingLayer.tsx        # Overlay + interaction
│   └── DrawingToolbar.tsx
├── data/exchanges/
├── hooks/usePanelMarket.ts
├── layout/PanelGrid.tsx
├── stores/
│   ├── marketStore.ts
│   └── layoutStore.ts
└── App.tsx
```

## Changelog (Step 4 – drawing tools)

### Added
- `src/drawings/types.ts` – Drawing union, logical points, fib levels, storage key
- `src/drawings/drawingStore.ts` – per panel+symbol store, localStorage, export/import JSON
- `src/drawings/renderers.ts` – pure canvas renderers (bridge only, no pixels stored)
- `src/drawings/DrawingLayer.tsx` – overlay canvas, multi-click tools, redraw on range/resize
- `src/drawings/DrawingToolbar.tsx` – tool/color/clear/export/import

### Changed
- `src/charts/ChartContainer.tsx` – hosts DrawingLayer; exposes bridge via state; accepts `symbol` prop
- `src/charts/ChartPanel.tsx` – DrawingToolbar under header; passes symbol to ChartContainer

### Untouched (no regressions)
- `src/data/exchanges/*`
- `src/stores/marketStore.ts`
- `src/stores/layoutStore.ts`
- `src/charts/series-manager.ts`
- `src/charts/coordinate-bridge.ts` (API unchanged; still the only conversion path)
- `src/layout/PanelGrid.tsx`

### Anti-pellicola guarantees
- Drawings store **only** `{ time, price }` (unix seconds + price)
- Paint path: `CoordinateBridge.toPixel` / `priceToCoordinate` / `timeToCoordinate`
- Redraw triggers: `subscribeVisibleTimeRangeChange`, ResizeObserver, drawing list change
- Panel move/resize → container ResizeObserver → chart.applyOptions + canvas resize + full re-paint from logical coords

## Roadmap

1. ✅ Data-layer + verification UI
2. ✅ Chart base (Lightweight Charts) + coordinate bridge
3. ✅ Resizable / draggable multi-panel layout
4. ✅ Drawing tools (anchored)
5. Indicator framework + RSI / VWAP / Volume Profile
6. Deep analysis (divergences, correlation, order flow)
7. Alerts + layout persistence
8. Full KuCoin-style polish

## License

MIT
