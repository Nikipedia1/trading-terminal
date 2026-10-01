# Trading Terminal

Personal multi-panel trading terminal with **real-time data only** from Binance and KuCoin.

## Absolute Constraints

1. **No fake data** – only real exchange APIs. Errors show explicit messages, never mock charts.
2. **Do not break what works** – every change lists touched functions + precise changelog.
3. **Modular** – data-layer / rendering / drawing-tools / indicators / layout-manager are separated.
4. **Anti-film** – overlays stay anchored via Lightweight Charts coordinate APIs.

## Shared microstructure data layer (Step 6)

Reusable feeds for upcoming deep-analysis modules (Deep Print, Delta, Volume Profile, … — **not implemented yet**):

```ts
import { subscribeTradeFeed, subscribeOrderBookFeed } from '@/data/shared'

const trades = subscribeTradeFeed('binance', 'BTCUSDT', {
  onTrade: (t) => {
    // t.aggressor === 'buy' | 'sell'  (from isBuyerMaker)
    // t.price, t.qty, t.time
  },
  onStatus: (s) => { /* connecting | connected | reconnecting | … */ },
  onError: ({ error }) => { /* never fake ticks */ },
})

const book = subscribeOrderBookFeed('binance', 'BTCUSDT', {
  onBook: (snap) => {
    // snap.bids / snap.asks top levels, snap.ready after sync
  },
})

// when done:
trades.unsubscribe()
book.unsubscribe()
```

- **One WebSocket per (exchange, symbol)** – reference counted
- **Trade stream**: aggTrade / match → `AggressorTrade` with aggressor side
- **L2 book**: Binance official snapshot + diff; KuCoin sequence-based; gap → resync
- **Reconnect** with backoff; status events; no synthetic data on failure

## Paper trading

Side panel tab **Paper** – simulated futures-style account (local only, no API keys):

- Buy/Long · Sell/Short, Market / Limit
- **Cross / Isolated** margin
- Leverage 1x–125x (KuCoin-style slider + presets)
- Optional **TP / SL** (validated vs side/entry; auto-close on real mark)
- Isolated **liquidation** when margin + uPnL ≤ 0
- Size in USDT notional → base qty from **real** last price
- Chart lines: entry (solid) + TP/SL (dashed) via `CoordinateBridge.priceToCoordinate` only
- Persist `localStorage` key `tt-paper:v2`

## Public API limits

See `PUBLIC_API_LIMITS` in `src/data/exchanges/types.ts`. Multi-panel + L2 snapshot weight can 429 – feeds share sockets to reduce load.

## Quick Start

```bash
npm install
npm run dev
```

### Tests (Codespaces / CI / local)

```bash
npm install
npm test          # vitest run – non-interactive, exits with code
npm run test:watch  # interactive watch mode
```

GitHub Codespaces: open the repo → Create codespace → after `postCreateCommand` finishes, run `npm test` in the terminal.

## Changelog (feat – multi-level OFI / MLOFI)

**Commit:** `ae3e9f9`

### Added
- `src/analysis/microstructure/ofi.ts`
  - `LnQuote`, `BookSideLevel`, `MultiLevelWeight`
  - `multiLevelOfiContribution` / `multiLevelOfiSeries` / `multiLevelOfi`
  - `multiLevelDepthImbalance`, `lnQuoteFromLevels`, `topOfLn`
  - weights: `equal` | `harmonic` | `linear` (default equal)
- `src/analysis/microstructure/__tests__/ofi.test.ts` – L1 + multi-level unit tests
- `MicroSnapshot`: `multiOfiCum`, `multiOfiStep`, `multiLevels`, `multiDepthImb`
- `FORMULAS.md` – OFI L1 + MLOFI sections

### Changed
- `engine.ts` – tracks multi-level OFI alongside L1 (default top-5 levels)
- `MicrostructurePanel.tsx` – surfaces multi-L metrics
- `index.ts` – re-exports multi-level API

### Untouched
- L1 OFI API & behaviour (fully backward-compatible)
- OrderBookWidget, VirtualizedTape, useVirtualWindow
- charts, drawings, indicators, stores, data feeds, paper trading

### Constraints
- Real L2 only; missing levels contribute 0 (never invent sizes/prices)
- Configurable depth via `startMicroEngine(..., { multiLevels: N })`

## Changelog (Step 6 – shared data layer)

### Added
- `src/data/shared/eventBus.ts` – typed pub/sub
- `src/data/shared/types.ts` – `AggressorTrade`, `OrderBookSnapshot`, …
- `src/data/shared/tradeFeed.ts` – shared tick stream + refcount
- `src/data/shared/orderBookFeed.ts` – L2 local book (Binance + KuCoin)
- `src/data/shared/index.ts` – public exports

### Changed
- `src/stores/marketStore.ts` – consumes shared trade + book feeds (no private WS for those)

### Untouched
- Chart panels, drawings, style, kline per-panel subscriptions, layout

### Not in this step
- Deep Print, Delta, Volume Profile, Deep Trades, DeepDom UI

## Changelog (chore – npm test in Codespaces)

### Added
- `.devcontainer/devcontainer.json` – Node 22 image, `postCreateCommand: npm install`
- `src/data/shared/__tests__/types.test.ts` – aggressor + feedKey
- `src/data/shared/__tests__/eventBus.test.ts` – pub/sub smoke

### Changed
- `package.json` – `test` → `vitest run` (exits cleanly in Codespaces/CI); `test:watch` for local
- `vite.config.ts` – `test` block (node env, `src/**/*.{test,spec}.{ts,tsx}`)
- `README.md` – test instructions

### Untouched
- Runtime data layer, charts, analysis modules

## Changelog (test – orderBookFeed vitest)

**Commit:** `1411b04`

### Added
- `src/data/shared/__tests__/orderBookFeed.test.ts`
  - mock ReconnectingWebSocket + fetch (no real APIs)
  - Binance: REST snapshot + buffered diffs
  - Binance: U > lastUpdateId+1 → resync
  - Binance: discard u <= lastUpdateId (stale)
  - KuCoin: sequenceStart misaligned → resync
  - KuCoin: buffer applied after snapshot

### Changed
- none

### Untouched
- `orderBookFeed.ts` runtime, charts, analysis modules

## Changelog (chore – ESLint flat config)

**Commit:** `b560a57`

### Added
- `eslint.config.js` – flat config, `@eslint/js` + `typescript-eslint` recommended, react-hooks / react-refresh, browser+node globals, no mass rule disables
- `package.json` devDependencies: eslint, @eslint/js, typescript-eslint, globals, eslint-plugin-react-hooks, eslint-plugin-react-refresh

### Changed
- none (lint script already present)

### Untouched
- Runtime src, tests, charts

## Changelog (fix – AbortController on resync fetches)

**Commit:** `5bc0910`

### Added
- AbortController for Binance and KuCoin depth snapshot fetches
- abort previous in-flight resync when starting a new one (or on stop)
- ignore AbortError in catch (no error event / no state overwrite)

### Changed
- `startBinanceBook` / `startKucoinBook` – fetch lifecycle only

### Untouched
- book reconstruction, buffer, gap detection, publish, refcount

## Changelog (perf – DomSnapshotBuffer ring buffer O(1))

**Commit:** `26c6549`

### Added
- fixed-size circular buffer (head/count) in `DomSnapshotBuffer`

### Changed
- `push` / `clear` / `last` / `list` / `reconfigure` – same public API, O(1) push

### Untouched
- `DeepDomOverlay.tsx`, `sample.ts`, types, public method signatures

## Changelog (chore – DEEPDOM_DEBUG paint timing)

**Commit:** `3b139a9`

### Added
- `DEEPDOM_DEBUG` via localStorage (off by default)
- `console.debug` on each paint: Δms since last paint, buffer size, sampleMs, skew vs 500ms loop

### Changed
- `paint()` – debug branch only when flag is on

### Untouched
- coordinate bridge usage, sampling, colors, overlay API

## Changelog (feat – paper trading panel)

**Commit:** `e5634de`

### Added
- `src/trading/paper/types.ts` – `PaperPosition`, `PaperOrder`, `PaperFill`, account
- `src/trading/paper/paperStore.ts` – simulated USDT account, leverage 1–125x, open/close,
  mark-to-market from real ticker, limit fill on real last, `localStorage` persist
- `src/trading/paper/PaperTradingPanel.tsx` – Buy/Sell, Market/Limit, leverage UI,
  positions + history (KuCoin-inspired)
- `src/trading/paper/index.ts` – public exports
- Side panel tab **Paper**

### Changed
- `src/App.tsx` – tab wiring + header label includes Paper

### Untouched
- exchange clients, shared feeds, charts, analysis, coordinate bridge

### Constraints
- Fills / marks use live `marketStore` ticker only (never synthetic prices)
- Paper module fully separated from data-layer

## Changelog (feat – paper TP/SL, isolated, chart lines)

**Commits:** `47a7ceb`, `2cd501f`

### Added
- TP / SL on place order + `setTpsl` per position; auto close on real mark (`tp` / `sl`)
- Margin mode **cross** | **isolated**; isolated liquidation when margin + uPnL ≤ 0
- `PaperPositionLines.tsx` – entry / TP / SL horizontal lines via `priceToCoordinate` only
- History actions: `tp` | `sl` | `liquidate`

### Changed
- `paperStore` / types / panel UI; storage key `tt-paper:v2`
- `ChartContainer` mounts `PaperPositionLines` for matching symbol

### Untouched
- exchange clients, shared feeds, drawings, other analysis overlays

## License

MIT
