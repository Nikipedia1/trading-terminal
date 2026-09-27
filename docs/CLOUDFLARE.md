# Cloudflare Pages + Workspace KV (free)

Deploy the terminal on **Cloudflare Pages** and persist workspaces on **Workers KV**. No paid plan required.

## What you get

| Piece | Role | Cost |
|-------|------|------|
| Pages | Hosts the Vite SPA (`dist/`) | Free |
| Pages Function `functions/api/workspace/[[id]].ts` | GET/PUT workspace JSON | Free |
| KV `WORKSPACE_KV` | Stores workspace documents | Free tier |
| Browser localStorage | Always-on fallback offline | Free |

## One-time setup

```bash
git pull
npm install

# Login (browser)
npx wrangler login

# Create KV namespaces (copy the ids into wrangler.toml)
npm run cf:kv:create
npm run cf:kv:create:preview
```

Edit `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "WORKSPACE_KV"
id = "<id from create>"
preview_id = "<preview id>"
```

## Deploy

```bash
npm run deploy:cf
```

Wrangler uploads `dist/` + `functions/`. You get a URL like:

`https://trading-terminal-xxxx.pages.dev`

## Local with Functions + KV

```bash
npm run cf:pages:dev
```

Opens a local Pages server that serves the build and binds KV (preview).

## In the app

Header → **Workspace**:

- **Save** – layout, panels, indicators, chart style → localStorage + KV (if deployed)
- **Load** – restore by workspace id
- **Export / Import** – JSON file (works without cloud)
- **New id** – new secret link for a blank cloud slot

The workspace **id** is an opaque secret. Anyone with the id can read/write that document. Do not share it publicly.

## Limits (free)

- KV value size ~1 MB (we cap ~900 KB)
- No real user accounts (id = capability URL)
- Tick history stays in the browser (IndexedDB); KV is for UI workspace only

## Optional env

Only if the API is on another origin:

```env
VITE_WORKSPACE_API=https://your-project.pages.dev
```

Same-origin deploy: leave unset.
