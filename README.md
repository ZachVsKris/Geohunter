# GeoStats v11.1.1 — Full-Range Scoring

This release changes the core board format to:

- 8 countries
- 6 categories
- 2 unused countries
- 600 maximum points
- 1st through 8th score 100, 85, 70, 55, 40, 25, 10, and 0 points

## Category diversity

The round composer now:

- requires at least four broad category types among the six categories
- allows no more than two categories from one broad type
- allows no more than two general import/export categories
- prevents near-duplicate subjects in the same round, including opposite versions of the same indicator
- strongly prefers new category types and measurement styles while composing a round
- preserves the requirement that six different countries can each rank first in one category

Specific-product trade categories can later be marked separately so they do not feel identical to broad imports and exports.

## Interface and results

- Phone country bank is now a 4 × 2 grid
- Phone category board is now a 2 × 3 grid
- Compact desktop uses a 2 × 4 country bank and 2 × 3 category board
- All assignment counts and rules use six categories
- Results and sharing use a 600-point maximum
- “Top five” is replaced by “Top three”
- Exact challenge links use a new variable-size board format while old 10-country / 8-category links remain readable

## Daily and leaderboard transition

Rules version is now `3.1`. A Daily board already stored for the current date remains unchanged until the next New York midnight; the next Daily is generated in the new format. All-time leaderboard calculations use Rules 3.0 scores only so 800-point and 600-point eras are not mixed.

All existing Supabase, account, source-link, category-title, tactile-board, and New York Daily-time behavior is preserved.


## Scoring update

The eight placements now use the full 0–100 range: 100, 85, 70, 55, 40, 25, 10, and 0. Legacy 10-country challenge links retain their original 100–10 scoring table when opened.
