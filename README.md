# Trading Terminal

Personal multi-panel trading terminal with **real-time data only** from Binance and KuCoin.

Inspired by KuCoin terminal UI (dark, high information density) and built with modular architecture.

## Absolute Constraints

1. **No fake data** – only real exchange APIs. Errors show explicit messages, never mock charts.
2. **Do not break what works** – every change lists touched functions + precise changelog.
3. **Modular** – data-layer / rendering / drawing-tools / indicators / layout-manager are separated.
4. **Anti-film** – any overlay (drawings, indicators) must stay anchored to real price/time via Lightweight Charts coordinate APIs and redraw on pan/zoom/resize/data update.

## Current Status (Step 5 – data layer consolidated)

- Vite + React 18 + TypeScript + Tailwind
- **Binance + KuCoin** Spot clients (REST history + reconnecting WebSocket)
- Per-panel connection badge (ONLINE / RECONNECTING / ERROR / …) + Retry
- Normalized types + Zustand stores
- Lightweight Charts + CoordinateBridge (anti-pellicola)
- Multi-panel layout, drawing tools, chart style customization

## Data flow

1. **REST** `getKlines` → initial candles (real only; empty/error → explicit message)
2. **WebSocket** kline stream → live bar updates
3. On disconnect → **exponential backoff** reconnect (`reconnecting` status)
4. Never synthesizes OHLC or fills gaps with demo data

## Public API limits (read before scaling panels)

### Binance
- REST weight ≈ **1200/min per IP** – many panels × refresh can 429
- Klines `limit` max **1000**
- Invalid symbol → HTTP 400 (shown as `BAD_SYMBOL`)
- WS is fine for multiple streams; control frames limited

### KuCoin
- Symbol format **BASE-QUOTE** (`BTC-USDT`); client maps `BTCUSDT` automatically
- Public WS needs **bullet-public** token before connect
- Intervals **3d / 1M not supported** on public candles → `UNSUPPORTED_INTERVAL`
- Must **ping** on server `pingInterval` or socket drops
- L2 depth WS is incremental; full book UI may stay on REST snapshot until a local book engine exists

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Project Structure (data layer)

```
src/data/
├── ws/reconnecting-ws.ts      # backoff reconnect primitive
└── exchanges/
    ├── types.ts               # ExchangeClient + PUBLIC_API_LIMITS
    ├── binance.ts
    ├── kucoin.ts
    └── registry.ts            # getExchangeClient()
```

## Changelog (Step 5 – data layer)

### Added
- `src/data/ws/reconnecting-ws.ts` – reconnecting WS + status callbacks
- `src/data/exchanges/kucoin.ts` – KuCoin REST + WS (real)
- `src/data/exchanges/registry.ts` – binance | kucoin
- `src/charts/ConnectionBadge.tsx` – per-panel ONLINE/RECONNECTING/ERROR
- `ConnectionStatus` includes `reconnecting`
- `ExchangeId` includes `kucoin`
- `PUBLIC_API_LIMITS` documentation constant

### Changed
- `binance.ts` – uses ReconnectingWebSocket; rate-limit / bad-symbol errors
- `types.ts` (exchange) – optional `onStatus` on subscribe*
- `usePanelMarket.ts` – exchange-aware; REST then WS; status detail; keeps candles on WS error
- `marketStore.ts` – registry + reconnect status
- `ChartPanel.tsx` – ConnectionBadge, Retry, error banner, KuCoin in exchange select

### Untouched (no regressions)
- Drawing tools / layout / coordinate-bridge / series-manager applyStyle path
- Chart style store

## Roadmap

1. ✅ Data-layer + verification UI
2. ✅ Chart base + coordinate bridge
3. ✅ Multi-panel layout
4. ✅ Drawing tools
5. ✅ Data layer consolidate (WS reconnect, KuCoin, badges)
6. Indicator framework + RSI / VWAP / Volume Profile
7. Deep analysis
8. Alerts + layout persistence

## License

MIT
