# Geo: Second Coming — v10.5.6 Stable Exact Challenges

This build starts directly from v10.5.5 Stable Scoring Rollback. The working World Bank loading path, round generator, solver, mobile layout, desktop layout, and scoring presentation are unchanged.

Seed/challenge fix:

- Once a round successfully generates, its exact eight categories, ten-country order, values, years, and official-source global ranks are embedded in the challenge URL
- Copy Link and Share Score use that self-contained exact-board URL
- Opening an exact challenge does not refetch the eight category datasets, so intermittent category requests cannot change or break the shared board
- Exact challenge links preserve category order, country order, scoring, rankings, and the perfect allocation across devices
- Successfully generated rounds are also cached locally by seed for faster same-device refreshes
- Older seed-only links still use the confirmed v10.5.5 generator; after they load once, the browser upgrades the URL to an exact challenge link

Not changed:

- No Vercel World Bank proxy
- No batched proxy loading
- No changes to the working solver or candidate-dataset loader
- No category or scoring-rule changes
