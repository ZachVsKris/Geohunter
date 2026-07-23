# GeoStats v11.2.1 — Normal + Expert Dailies

GeoStats now has two coordinated Daily games and two separate leaderboards.

## Daily formats

### Normal Daily
- 8 countries
- 6 categories
- 2 unused countries
- 600 maximum points
- scoring: 100, 85, 70, 55, 40, 25, 10, 0

### Expert Daily
- 10 countries
- 8 categories
- 2 unused countries
- 800 maximum points
- scoring: 100, 90, 80, 70, 60, 50, 40, 30, 20, 10

Random challenges continue to use the Normal format.

## Coordinated Daily rules

The two Daily boards are generated together:

- no category can appear in both boards on the same day
- no more than two countries can appear in both boards
- each board still has distinct first-place countries for every category, so a perfect score is always possible
- each board retains the existing category-diversity rules: maximum two categories per broad type, restricted general trade categories, and no near-duplicate subjects within one board

The pair is stored in Supabase. The first visit of a new New York date may take longer while both boards are created; later visits load the saved boards.

## Routes

- Normal Daily: `/daily`
- Expert Daily: `/daily/expert`
- Public leaderboards: `/leaderboard`

The leaderboard has Normal/Expert and Today/All-time tabs. Scores are saved separately by difficulty.

## Required Supabase migration

Existing GeoStats projects **must run** this file in Supabase SQL Editor before deploying the code:

`supabase/migrations/002_dual_daily_modes.sql`

It adds a `difficulty` column and changes the database keys so each date can store both a Normal and Expert board, and each player can save one score for each mode per day.

Fresh Supabase projects can run `001_geostats.sql`, which already contains the dual-mode schema.

## Verification completed

- invariant tests
- TypeScript/TSX syntax transpilation
- internal TypeScript semantic checks available without installed Next.js/React packages

Vercel should run the final production build after upload.
