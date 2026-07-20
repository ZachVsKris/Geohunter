# Geo: Second Coming v7 — data-engine rewrite

This version rewrites the scoring and ranking architecture around one canonical World Bank dataset per category.

## What changed

- A single canonical observation now drives the displayed value, data year, global rank, pool rank, points, and perfect answer
- Rankings are never stored separately from values
- Every round is validated before it is shown
- Every result tooltip links to the exact official World Bank indicator page
- Added `/audit`, which lists every category, indicator code, definition, and official source link
- Renamed the water category to accurately match World Bank indicator `ER.H2O.FWAG.ZS`: **Highest agricultural share of freshwater withdrawals**
- Scoring is derived from the same sorted ten-country leaderboard shown by the data engine

## Deploy

Upload the contents of this folder to the root of the GitHub repository. Vercel should detect Next.js automatically.

## Local verification

```bash
npm install
npm run build
npm run dev
```
