# Geo: Second Coming v10.5.2 — exact challenge links

Stable recovery build based on v10.5.1.

## Seed/link fix

The prior app regenerated a board from the visible seed using whichever live category requests happened to succeed. That meant the same seed could produce different country banks on different devices.

This build keeps the working v10.5 round generator, but after a round is created the URL also stores the exact ordered category IDs and country IDs. Copy Link, refresh, and Share Score now reconstruct that exact board instead of generating a new one from the seed alone.

It also adds deterministic country-ID tie breaking so equal indicator values cannot vary with API response ordering.

Legacy links containing only a seed are upgraded to an exact-board URL after their first successful load.
