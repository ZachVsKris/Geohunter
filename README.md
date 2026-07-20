# Geo: Second Coming

A deterministic geography strategy game powered exclusively by World Bank World Development Indicators.

## Data policy

- One authoritative source: World Bank WDI
- 76 verified category definitions
- Observations before 2022 are rejected
- Per-category coverage floors are enforced
- Contradictory country-year duplicates are rejected
- Tied first-place results are rejected
- Seeded challenges are deterministic
- Every round contains eight distinct category winners and ten complete countries

## Performance architecture

- The browser requests only the World Bank indicators needed to assemble a round
- Requests go through same-origin Next.js routes with Vercel/CDN revalidation caching
- Successful datasets are cached in browser local storage for 30 days
- Completed seeded rounds are cached for seven days
- World Bank-only parallel batches remove cross-source delays and retries

## Commands

```bash
npm install
npm test
npm run build
npm run verify-seed -- <seed>
```
