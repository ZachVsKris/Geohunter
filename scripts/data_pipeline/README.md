# GeoStats strict importer contract

Every future source importer must write to the same warehouse fields introduced by
migration 010 and must obey these invariants:

1. Only the canonical 195-country UN universe is considered.
2. Missing observations remain missing; they are never silently converted to zero.
3. A common reference year is selected and its coverage is stored explicitly.
4. Reported, estimated, imputed, modeled, and unknown observations remain distinguishable.
5. Severe ceiling/floor clustering and year-to-year ranking instability reduce quality.
6. Import success never means game approval.
7. `auto_qualified=true` moves a candidate only to `needs_review`.
8. Only an administrator can set `review_status=approved`, `enabled=true`, and
   `eligible_daily=true`.
9. Every editorial decision is written to `stat_category_reviews`.
10. Re-imports preserve a rejection and preserve an approval only while the strict gate
    continues to pass.

The first implementation is `scripts/import-faostat.py`. WHO, UNESCO, UN Comtrade,
UNSD Energy, ILOSTAT, climate/geography, and WIPO importers should reuse this contract.
