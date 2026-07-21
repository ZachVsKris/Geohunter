# Geo: Second Coming — v10.8

A strategy geography game using 76 certified World Bank categories.

## This build

- Compact single-screen mobile board
- Compact 2 × 4 category grid on shorter desktop screens
- Exact-board challenge links and spoiler-free score sharing
- Maximum two categories from the same subject family
- Direct, incremental World Bank loading based on the fast v9 architecture
- Four-request concurrency limit with timeouts and a cached same-origin fallback
- Seven-day device cache for country and category data
- Forward-checking round solver with automatic deterministic fallbacks
- Shared-link parameters remain intact throughout loading

## Run locally

```bash
npm ci
npm run dev
```

## Verify

```bash
npm test
npx tsc --noEmit
npm run build
```
