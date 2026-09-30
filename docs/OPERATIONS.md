# Operations

## Health

`GET /api/health` (Cloudflare Pages Function)

```json
{
  "ok": true,
  "service": "trading-terminal",
  "checks": { "kv": "ok", "runtime": "cloudflare-pages" }
}
```

- `kv: missing` – WORKSPACE_KV not bound
- `kv: error` – HTTP 503

## Telemetry (Sentry)

Set at build time:

```bash
VITE_SENTRY_DSN=https://<key>@<host>/<project>
```

`ErrorBoundary` and `window.onerror` / unhandledrejection post to Sentry store API (no heavy SDK).

## Onboarding

First visit: 5-step tour. Flag: `localStorage tt-onboarding:v1=done`.
Header **Tour** resets and reloads.

## CI

On every PR / push to `main`:

1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. `npm run build` (Pages `dist/`)
