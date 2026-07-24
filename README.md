# GeoStats v11.6.0

This release adds three connected systems:

1. A canonical country registry limited to the 193 UN member states plus the Holy See and State of Palestine.
2. Automated 0–100 category quality scoring. Only categories scoring at least 80 with at least 175 playable countries are eligible for Daily boards.
3. An optimization-based Daily generator. It evaluates up to 36 valid candidate boards per difficulty and selects the strongest based on data quality, category/measure variety, geographic spread, ranking tension, and difficulty fit.

## Required deployment order

1. In Supabase SQL Editor, run `RUN_THIS_IN_SUPABASE_FIRST.sql`.
2. Upload the extracted project files to GitHub.
3. Wait for the Vercel deployment to show Ready.
4. Open `/admin` and run Refresh World Bank once.

The refresh recalculates every category's quality score, marks Daily eligibility, removes non-UN countries from imported observations, and updates the canonical countries table.

Existing saved boards remain unchanged unless they contain a now-ineligible country or fail validation. Newly generated boards use the optimizer.
