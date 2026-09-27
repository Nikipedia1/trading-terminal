# Cloudflare Pages (free)

## Deploy via dashboard (recommended)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Select repo `trading-terminal`
3. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Production branch:** `main`
   - Framework: React (Vite) or Vite or None
4. Optional env: `NODE_VERSION` = `20`
5. **Save and Deploy**

When status is **Success**, open `https://<project>.pages.dev`.

Workspace **Save/Load** works on **localStorage** even without KV.

## Optional: cloud workspace (KV)

Only after the site deploys successfully:

1. **Workers & Pages** → **KV** → **Create a namespace** (name e.g. `WORKSPACE_KV`)
2. Open your Pages project → **Settings** → **Functions** (or **Bindings**)
3. **Add binding**:
   - Type: **KV namespace**
   - Variable name: **`WORKSPACE_KV`** (exact spelling)
   - Namespace: the one you created
4. **Deployments** → **Retry deployment** (or push a new commit)

Then in the app: **Workspace → Save** should report `cloud`.

Do **not** put `REPLACE_WITH_...` ids in `wrangler.toml` — that breaks Function publish (error 8000022).

## CLI alternative

```bash
npm install
npx wrangler login
npm run build
npx wrangler pages deploy dist
```

Bind KV from the dashboard as above, or create real namespace ids and only then uncomment `[[kv_namespaces]]` in `wrangler.toml`.
