# Geo: Second Coming v2.0

A strategy geography game built with Next.js and official World Bank indicators.

## Reliability changes

- One canonical observation drives value, year, rank, score, tooltip, and perfect answer
- Versioned challenge URLs include dataset, rules, and category-set releases
- Independent `verify-seed` utility reloads official World Bank data
- Round rejection for missing data, implausible ranges, stale observations, and excessive year spread
- Common-year requirement for volatile growth indicators
- Explicit tie handling
- Full ten-country leaderboard for every result
- Points-lost feedback and error-report links
- Data/methodology, privacy, terms, and audit pages
- Automated invariant smoke tests

## Commands

```bash
npm install
npm run dev
npm test
npm run verify-seed -- PYBM35HM
npm run check
```

## Production note

The game still reads live World Bank data at runtime. For a high-traffic public launch, the next infrastructure step is a scheduled server-side snapshot job backed by persistent storage. This package versions the release and rejects unsafe rounds, but does not bundle a complete frozen copy of every World Bank indicator.
