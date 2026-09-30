# Product features

## Near term

| Feature | How |
|--------|-----|
| Web Notification + webhook | Alerts panel; client `notify.ts` |
| Server webhook relay | `POST /api/alerts/webhook` register/dispatch (auth + KV) |
| Bot backtest offline | Widget **Backtest** – pure `evaluateBot` |
| Liquidity dashboard | Widget **Liquidity** |
| Cloud layout sync | Auto-save after auth |
| Guest read-only | `VITE_ALLOW_GUEST` |

## Medium term foundation

| Feature | How |
|--------|-----|
| Live API keys client-only | **Live Keys** – sessionStorage + disclosure; never on our server |
| Mobile layout | `useMobileLayout` + `.tt-mobile-shell` |
| Indicator plugins | **Plugins** – JS sandbox |

## Env

```
VITE_ALLOW_GUEST=1
VITE_AUTO_CLOUD_LAYOUT=1
VITE_LIVE_KEYS_UI=1
VITE_INDICATOR_PLUGINS=1
```
