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


## v12.0.1 verification fixes

- Uses the current World Bank AR5 series for total CO2, CO2 per capita, and methane emissions.
- Preserves all v12 Puzzle Intelligence functionality; this is not a downgrade to v11.6.
- Surfaces World Bank API message-envelope errors instead of misreporting them as zero coverage.
- Uses the same New York date boundary in Admin and the Daily game.
- Locks board regeneration once player scores exist, protecting saved scores and the one-attempt rule.
