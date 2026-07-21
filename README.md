# Geo: Second Coming v10.5.4 — clearer mobile scoring

This build is based on v10.5.3 and keeps its round generation, proxy loading, and exact challenge-link behavior unchanged.

## Results readability

- Each result now leads with the player's placement among the ten countries, such as `2nd of 10`.
- Each card shows points earned directly instead of points left on the table.
- First-place answers are labeled `Best possible`.
- The results summary shows average placement, number of best-possible answers, and top-five finishes.
- `Rank` is renamed to `View rankings`, and metric/year text is shortened for mobile.

Stable recovery build based on v10.5.1.

## Seed/link fix

The prior app regenerated a board from the visible seed using whichever live category requests happened to succeed. That meant the same seed could produce different country banks on different devices.

This build keeps the working v10.5 round generator, but after a round is created the URL also stores the exact ordered category IDs and country IDs. Copy Link, refresh, and Share Score now reconstruct that exact board instead of generating a new one from the seed alone.

It also adds deterministic country-ID tie breaking so equal indicator values cannot vary with API response ordering.

Legacy links containing only a seed are upgraded to an exact-board URL after their first successful load.


## v10.5.3 reliability patch

World Bank requests now run through same-origin Next.js API routes with retries and Vercel caching. The v10.5 round solver and gameplay remain unchanged. Exact challenge links load the eight specified datasets in one batched request instead of making direct browser-to-World-Bank calls.