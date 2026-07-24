# GeoStats v12.0.0 — Puzzle Intelligence

## Included

- Admin-triggered generation of all three Daily boards
- Candidate-search optimization rather than first-valid selection
- Scoring breakdown for quality, variety, geography, difficulty fit, and competitiveness
- Generator diagnostics showing eligible datasets, attempts, and valid candidates evaluated
- Admin previews listing the countries and categories selected for Easy, Normal, and Expert
- Regeneration replaces today's saved trio after a successful search
- Existing Daily rules remain enforced: no shared categories and at most one shared country between any pair of modes

## Deployment

No additional Supabase migration is required beyond migration 009 already used by v11.6.0.

Upload the project to GitHub, wait for Vercel to report Ready, then open /admin and click Generate today's boards.


v12.0.1 keeps the optimizer intact while updating the emissions indicators and hardening board regeneration.
