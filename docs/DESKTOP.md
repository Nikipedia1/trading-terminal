# NACS Lab Terminal — Desktop (Electron)

Run the trading terminal as a **native desktop app** on Windows / macOS / Linux.
Requires **Node.js ≥ 20** (you already have it) and VS Code is optional.

## One-time setup

```bash
cd trading-terminal
npm install
```

This installs `electron` and `electron-builder` (devDependencies).

## Development (hot reload)

Terminal 1 — Vite:

```bash
npm run dev
```

Terminal 2 — Electron window:

```bash
npm run electron:dev
```

Or in one command (waits for Vite then opens the app):

```bash
npm run desktop
```

## Production build (installer / portable)

```bash
npm run desktop:build
```

Outputs under `release/`:

- **Windows**: `.exe` (NSIS installer) + portable
- **macOS**: `.dmg`
- **Linux**: `.AppImage`

## Point desktop at your live Cloudflare site (optional)

If you prefer the packaged app to load the **deployed** Pages URL (auth + Functions already online):

```bash
# Windows PowerShell
$env:NACS_DESKTOP_URL="https://YOUR-PROJECT.pages.dev"
npm run electron:dev

# macOS / Linux
NACS_DESKTOP_URL="https://YOUR-PROJECT.pages.dev" npm run electron:dev
```

For a permanent default, set the same variable in your OS environment or a local `.env` used only for desktop launches.

## Notes

- **Live market WebSockets** work the same as in the browser.
- **Auth / KV API** need either local `wrangler pages dev` or `NACS_DESKTOP_URL` / proxy to production.
- Window: dark chrome, 1440×900 default, DevTools only in unpackaged builds.
