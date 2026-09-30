# Authentication & session

## Architecture

- **Backend**: Cloudflare Pages Functions + KV (`WORKSPACE_KV`)
- **Session**: random 32-byte token stored in KV (`auth:session:{token}`, TTL 7 days)
- **Transport**: **HttpOnly cookie** `tt_session` only (browser)
  - Flags: `HttpOnly; SameSite=Lax; Secure` on HTTPS
  - **Never** store session tokens in `localStorage` / `sessionStorage`
- **Password**: PBKDF2-SHA256, 100k iterations; never logged or returned

## Why not `npm run dev` alone?

Vite (`npm run dev`) serves the SPA **without** Pages Functions.

| Command | Auth API | Workspace cloud |
|---------|----------|-----------------|
| `npm run dev` | ❌ 404 / network error | ❌ |
| `npx wrangler pages dev dist --kv WORKSPACE_KV` | ✅ | ✅ |
| Deployed Pages (`*.pages.dev`) | ✅ | ✅ |

**Local auth workflow:**

```bash
npm run build
npx wrangler pages dev dist --kv WORKSPACE_KV
# or:
npm run cf:pages:dev
```

In pure Vite DEV, the client may inject a soft `dev@localhost` session so the UI is usable offline — **that is not real auth**.

## Rate limits (KV sliding window)

| Endpoint | Key | Limit |
|----------|-----|-------|
| `POST /api/auth/login` | IP | 20 / 60s |
| `POST /api/auth/login` | email | 10 / 60s |
| `POST /api/auth/register` | IP | 5 / hour |

Exceeding limits → HTTP `429` with retry hint.

## Workspace ACL

- Cloud **GET / PUT / DELETE** `/api/workspace/:id` require a valid session (cookie).
- Ownership is stored in `wsmeta:{id}` (`ownerId`).
- Knowing the workspace id is **not** enough to read or write cloud data.
- `GET /api/workspace/list` returns ids owned by the current user (`user:ws:{userId}`).

## Client rules

```ts
fetch('/api/...', { credentials: 'include' }) // always
// Do NOT:
localStorage.setItem('tt-auth-token', token)
headers: { Authorization: `Bearer ${token}` } // browser app
```

Bearer is accepted server-side only for non-browser tooling.

## Related endpoints

- `POST /api/auth/register` → Set-Cookie + `{ user }`
- `POST /api/auth/login` → Set-Cookie + `{ user }`
- `POST /api/auth/logout` → clear cookie
- `GET /api/auth/me` → current user or 401
- `GET|PUT /api/user/portfolio` → per-user paper backup (auth required)
