# GeoStats v11.3.3

GeoStats is now a three-Daily geography strategy game. Random and shared seeded rounds have been removed from the player-facing product.

## v11.3.1 interface refinement

- Removed the redundant Copy Link button from the Daily challenge bar; each mode now uses its clean browser URL for sharing
- Centered the fifth Easy country on the final desktop row
- Share Score remains available after completing a challenge
- No additional Supabase migration was required for v11.3.1


## v11.3.2 interface refinements

- Easy Daily's five mobile country cards are arranged as a centered 3 + 2 grid
- Mobile category titles and measurement descriptions wrap to additional lines instead of being truncated
- No Supabase migration is required when upgrading from v11.3.0 or v11.3.1


## v11.3.3 database-label correction

- Canonicalizes the readable Supabase `seed` field so each row clearly says `DAILY-EASY`, `DAILY-NORMAL`, or `DAILY-EXPERT`
- Fixes migrated Normal rows that still displayed the former `DAILY-EASY` seed label
- Does not change any encoded board, leaderboard score, or challenge result
- Existing v11.3.x projects should run only `supabase/migrations/004_canonical_daily_seed_labels.sql` once

## Daily modes

### Easy Daily
- 5 countries
- 4 categories
- 1 unused country
- Rank scoring: 100, 75, 50, 25, 0
- Maximum score: 400
- Route: `/daily/easy`

### Normal Daily
- 8 countries
- 6 categories
- 2 unused countries
- Rank scoring: 100, 85, 70, 55, 40, 25, 10, 0
- Maximum score: 600
- Route: `/daily`

### Expert Daily
- 10 countries
- 8 categories
- 2 unused countries
- Rank scoring: 100, 90, 80, 70, 60, 50, 40, 30, 20, 10
- Maximum score: 800
- Route: `/daily/expert`

`geostats.xyz` redirects to the Normal Daily. The active Daily is highlighted in the navigation.

## Daily variety rules

The three boards are generated as one coordinated set for each date:

- Categories are completely distinct across Easy, Normal, and Expert
- Any two Daily boards share no more than one country
- Each category has a different first-place country within its own board

These generator constraints are intentionally not shown in the player rules.

## Leaderboards

Easy, Normal, and Expert have separate Today and All-time leaderboards. Each signed-in player can save one verified score per mode per date.

## Supabase migration

For an existing v11.2.3 Supabase project, run **only** `supabase/migrations/003_three_daily_modes.sql` once before deploying this version. Do not rerun migrations 001 or 002.

For a brand-new Supabase project, run the migrations in numerical order: 001, 002, 003, then 004.

Migration 003 converts the old internal `easy` value—which previously represented Normal—to `normal`, preserving existing Normal Daily boards and scores. Migration 004 cleans up the human-readable seed labels for projects where Migration 003 had already run.

## Development

```bash
npm install
npm test
npm run build
```

Environment variables remain documented in `.env.example`.


## GeoStats Admin v1

The protected control center is available at `/admin` to users listed in `public.app_admins`.

Before deploying v11.5.0, run these migrations in order if they have not already been run:

- `005_data_warehouse_schema.sql`
- `006_allow_shared_indicator_codes.sql`
- `007_admin_access.sql` (replace the placeholder UUID first)
- `008_data_sources.sql`

Vercel must contain `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and either `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.

The World Bank refresh button imports one category per request to avoid long serverless timeouts, records import history, and updates category coverage and latest-year metadata. The public daily generator remains on the proven current data pipeline until warehouse validation is complete.

### Upgrade from v11.3.3
If migrations 005, 006, and 007 are already complete, run only `008_data_sources.sql` before deploying this version.
