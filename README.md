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

## Public API limits

See `PUBLIC_API_LIMITS` in `src/data/exchanges/types.ts`. Multi-panel + L2 snapshot weight can 429 – feeds share sockets to reduce load.

## Quick Start

```bash
npm install
npm run dev
```

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

## License

MIT
