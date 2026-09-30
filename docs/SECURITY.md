# Security checklist – trading-terminal

Status verified against codebase (Functions + client). Update when controls change.

| Control | Status | Implementation notes |
|--------|--------|----------------------|
| Password hashing | **OK** | PBKDF2-SHA256, 100k iterations, random salt |
| No password disclosure (admin) | **OK** | Admin can set a new password only; never returns hash/plaintext |
| Session server-side KV | **OK** | `auth:session:{token}` in WORKSPACE_KV, TTL 7d |
| HTTPS / Secure cookie | **OK (prod CF)** | `HttpOnly; Secure; SameSite=Lax` on HTTPS |
| XSS → token localStorage | **Mitigated** | Session only in HttpOnly cookie; legacy `tt-auth-token` scrubbed; login JSON never returns token |
| Workspace ACL per user | **OK** | `wsmeta:{id}.ownerId`; auth required; orphan docs without meta → 403 |
| Rate limit auth | **OK** | Login 20/min/IP + 10/min/email; register 5/hour/IP |
| CSRF (cookie session) | **OK** | SameSite=Lax + Origin/Referer on mutating requests with session cookie |
| Bearer tokens | **Restricted** | Off by default; `AUTH_ALLOW_BEARER=1` or `X-Auth-Bearer: 1` |
| AI API secrets | **Acceptable risk** | sessionStorage only; not sent to our backend; cleared on logout |
| Input validation Functions | **OK** | Email/password policy; auth body ≤4KB; workspace size + JSON; id charset |

## Residual risk

1. XSS can still drive cookie-authenticated actions (CSRF mitigations apply).
2. User AI keys remain readable to same-tab XSS via sessionStorage.
3. Dev auth bypass is local-only — never in production.

See `docs/AUTH.md`, `docs/OPERATIONS.md`.
