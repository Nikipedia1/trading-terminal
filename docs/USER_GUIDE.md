# NACS Lab Terminal – User guide

This is the **trader-facing** guide (not the developer README).

## First 10 minutes

1. **Register / Sign in** – no guest mode. First account becomes admin.
2. Complete the **checklist** (bottom-right):
   - Open **Paper** (`+ Panel` → Trade) and place a practice order
   - Click **Start live** on the chart for real market data
   - Review **risk limits** on the paper panel
   - Save a **workspace** from the workspace menu
   - Only later: **Live Keys** (API keys stay encrypted in your browser)
3. Optional: switch language **EN / IT** in the header.

## Desk layout

- **+ Panel** adds charts and widgets (Order Book, News, Ops, Learn, …)
- Drag the panel header handle; resize from edges
- Mobile: simplified vertical stack; full multi-grid is **desktop-oriented**

## Paper vs Live

| Mode | What happens |
|------|----------------|
| Paper (default) | Simulated fills from live marks – no real money |
| Live | Real orders via your exchange API after arm + risk checks |

Always prefer keys **without withdrawal** permission.

## News, Calendar, AI

- News polls RSS every ~45s; **Analizza impatto** is AI text, **not advice**
- Calendar high-impact events can draw vertical lines on the chart
- Glossary links from Learn when AI cites terms

## Ops & backup

- **Ops** panel: health, feed status, feature flags, JSON backup export/import
- Cloud workspace needs Cloudflare Pages + KV (see `docs/CLOUDFLARE.md`)

## Safety

- Not investment advice; not a licensed broker
- See `/legal/risk.html`, `/legal/terms.html`, `/legal/privacy.html`

## Shortcuts

Open the in-app hotkey help (keyboard map overlay) for chart and order shortcuts.
