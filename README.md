# Geo: Second Coming v2.5.1

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


## v2.5.1 runtime performance pass

- Persists successful category datasets in session storage, so a page refresh in the same browser session does not redownload them.
- Persists the official country list for the browser session.
- Uses deterministic source-aware batches: seven faster WDI/distributed requests for each FAOSTAT request.
- Reduces the startup candidate target and maximum request count while retaining fallback batches.
- Adds request timeouts so one stalled official endpoint cannot leave the loading screen hanging indefinitely.
- Rejects rounds with a tied first-place country in any category.
- Preserves full round validation, distinct winners, coverage floors, family/source limits, and the 2022+ rule.

## v2.6 performance pass

- Tries to assemble a valid round immediately after the first eight successful datasets instead of waiting for a larger fixed pool.
- Fetches more candidates only when the initial pool cannot produce a valid round.
- Persists successful official datasets in versioned browser storage for seven days.
- Persists the official country list for thirty days.
- Persists completed seeded rounds for seven days, making repeat visits to the same challenge nearly immediate.
- Displays each category's actual official source instead of hardcoding World Bank.
- Preserves full round validation, unique winners, coverage rules, source limits, and the 2022+ recency gate.
