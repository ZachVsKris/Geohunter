# Geo: Second Coming v2.4

A verified geography strategy game built with Next.js.

## Data sources

- World Bank World Development Indicators
- FAOSTAT Crops and Livestock Products (QCL)
- WHO Global Health Observatory indicators distributed through WDI
- UNESCO Institute for Statistics indicators distributed through WDI
- UN Tourism indicators distributed through WDI
- Natural Earth is registered, but contributes no playable category under the annual recency policy

## Hard 2022+ policy

Every annual-data adapter discards observations before 2022. If the remaining country observations do not meet a category's coverage floor, that category is automatically unavailable for playable rounds. This applies equally to World Bank, FAOSTAT, WHO, UNESCO, and UN Tourism categories.

The adapters also reject contradictory values for the same country and year, invalid units, impossible ranges, and insufficient country coverage. No category combines values from different sources.

## Verification

```bash
npm test
npm run build
npm run verify-faostat
npm run verify-who
npm run verify-unesco
npm run verify-tourism
npm run verify-natural-earth
```

The live verification commands require internet access.


## v2.4.1 performance update

- Loads candidate category datasets in deterministic parallel batches instead of one request at a time.
- Reuses successful category requests for later random and daily challenges during the same browser session.
- Preserves seeded ordering, round validation, unique-winner requirements, source limits, and the 2022+ recency gate.
