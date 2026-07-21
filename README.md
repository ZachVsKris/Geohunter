# Geo: Second Coming — v10.5.5 Stable Scoring Rollback

This build starts from v10.5.1 Stable Recovery and deliberately removes the untested v10.5.3 proxy/batched-loading path.

Included:

- The confirmed v10.5 World Bank loading and round-generation path
- Compact mobile and shorter-desktop layouts from v10.5.1
- Clear results cards showing placement out of 10 and points earned
- Average placement, best-possible answers, and top-five finishes in the score summary
- “View rankings” controls
- Existing canonical seed link, share text, and simplified rules from v10.5.1

Not included:

- Vercel World Bank proxy routes
- Batched proxy dataset loading
- Any solver, category, or data-engine changes
- The later exact-board shared-link implementation

This version prioritizes restoring the last confirmed working load path before seed-link reliability is addressed separately.
