# NACS Lab – business surface

## Legal entity

- **Product name:** NACS Lab Terminal  
- **Positioning:** multi-venue **software** desk (visualization + optional self-directed execution via user exchange API keys).  
- **Not:** broker, exchange, portfolio manager, or investment advisor.  
- Update `src/brand/identity.ts` (`legalEntity`, `supportEmail`) when the company is incorporated.

## Plans

| Plan | Entitlement summary |
|------|---------------------|
| **Free** | Paper only, limited AI, local export |
| **Pro** | Live trading UI, cloud workspace, higher AI |
| **Team** | Seats, RBAC, priority support |

Client store: `src/billing/planStore.ts` (local + `VITE_DEFAULT_PLAN`).  
Checkout: set `VITE_STRIPE_CHECKOUT_URL` or use Contact sales.

## Support

- `/support/` form → `POST /api/support/ticket` (KV)  
- `/status/` live probes  
- Email: `BRAND.supportEmail`

## Roadmap

Public page: `/roadmap/` — paper vs live vs experimental.
