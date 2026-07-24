# GeoStats v12.1.0 — Strict Data Intake

This release begins the multi-source expansion without lowering GeoStats' data standard.
It adds the first full external-source pipeline: **FAOSTAT crop and livestock production
(QCL)**, imported into a quarantine and editorial review workflow.

## What this release adds

- A generic candidate-data intake model shared by future FAOSTAT, WHO, UNESCO,
  Comtrade, energy, climate, and other importers
- A GitHub Actions FAOSTAT bulk importer that can process the large official dataset
  without relying on a short-lived Vercel function
- Strict automated checks for:
  - common-year coverage
  - freshness
  - official versus estimated/imputed observations
  - severe ties or clustering
  - year-to-year ranking stability
- An evidence tier and 0–100 quality score for every candidate
- A review quarantine: **imports never become playable automatically**
- Admin inspection of the top and bottom rankings before approval
- Approve, reject, and reset actions with an audit trail

Missing country reports are always kept missing. The importer never converts them to
zero, even where a zero might seem plausible.

## Required deployment order

1. In Supabase SQL Editor, run `RUN_THIS_IN_SUPABASE_FIRST.sql`
   (the same migration is stored as `supabase/migrations/010_candidate_intake_and_reviews.sql`).
2. Upload the extracted project files to GitHub.
3. Wait for Vercel to show **Ready**.
4. Open GitHub → **Actions** → **Import FAOSTAT candidates** → **Run workflow**.
5. After the workflow completes, open `/admin` and filter the Category Library to
   **FAOSTAT** and **Needs review**.
6. Inspect surprising rankings before approving any category.

The GitHub workflow uses the existing repository secrets:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

## Important scope boundary

v12.1.0 loads and reviews FAOSTAT candidates in the warehouse. It does **not** yet make
the puzzle engine dynamically read external categories. Approval marks a category as
eligible in the warehouse; the next integration step will make the generator consume
approved warehouse categories rather than only the original hardcoded catalog.

## Existing v12 features retained

- UN-recognized country registry
- World Bank category scoring
- Puzzle Intelligence optimizer and diagnostics
- Persistent authentication
- One saved Daily attempt per mode and date
