# GeoStats v11 — Supabase Daily + Accounts + Leaderboard

This build keeps the proven v10.5.13 local round generator as a fallback, while adding a Supabase-backed Daily, optional accounts, verified Daily score saving, and an adjusted-average leaderboard.

## What changes

- `/daily` loads the authoritative saved Daily board from Supabase when available.
- The first successful Daily generation saves that exact board; later visitors load it quickly without rebuilding it.
- Random games remain local and do not affect the leaderboard.
- Players can continue with Google or an email magic link after playing.
- The server recalculates Daily scores from saved assignments before writing them.
- The main leaderboard requires five Dailies and ranks by a Bayesian-adjusted average using a 20-game confidence weight.
- Visible branding is now GeoStats; internal data/rules version text is hidden.

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste `supabase/migrations/001_geostats.sql`, and run it.
3. In **Authentication → URL Configuration**, set:
   - Site URL: `https://geostats.xyz`
   - Redirect URL: `https://geostats.xyz/auth/callback`
4. In **Authentication → Providers**, enable Google if desired. Email magic-link sign-in works with the email provider.
5. Add the four variables from `.env.example` to Vercel Project Settings → Environment Variables.
6. Redeploy.

The service-role key is server-only. Never prefix it with `NEXT_PUBLIC_` or expose it in client code.

## Daily behavior

When Supabase is configured, `/daily` first checks `daily_challenges`. If today is already stored, it opens immediately. If not, the existing stable generator creates the board and the API stores the first valid board. Concurrent visitors receive the first stored board.

## Leaderboard

The public leaderboard shows:

- raw average score
- Dailies completed
- adjusted rating

Adjusted rating = `(raw average × games + global average × 20) ÷ (games + 20)`.

Only Daily games count. A user/date pair can create only one official score row.
