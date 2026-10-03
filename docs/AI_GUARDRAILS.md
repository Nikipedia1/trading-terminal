# AI guardrails (News impact)

## Product rules

1. **Always** show disclaimer: *Interpretazione AI, non consiglio finanziario*.
2. **Never** emit buy/sell / “entra long” prescriptions; server scrubs common phrases.
3. Response includes **confidenza** (0–1) and optional **fonti**.
4. JSON schema fixed; no free-form investment advice.

## Ops

| Control | Default |
|---------|---------|
| Keys | `OPENAI_API_KEY` \| `XAI_API_KEY` \| `GROQ_API_KEY` |
| Model | `NEWS_ANALYZE_MODEL` optional |
| Quota / user or IP | `NEWS_ANALYZE_QUOTA_HOUR` (default **15**/hour) via KV |
| Cache | KV key `ai:news-analyze:<hash>` TTL **6h** |
| Fallback | Heuristic keyword analysis if model missing/down |

## Client

`ImpactCard` shows disclaimer, confidence, sources, cache/fallback badges.
