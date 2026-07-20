# Geo: Second Coming

A strategy-first geography drafting game built with Next.js and official country data.

## Fair-round rule

Every round randomly selects eight categories and ten countries. For each selected category, the country bank is guaranteed to contain at least one country ranked in that category's global top 100. Categories are otherwise random, with no more than two from the same subject family.

## Data

The enabled category library is fetched directly from the World Bank API and uses World Development Indicators. Values use each country's latest available observation, and the result screen displays the observation year.

Food, livestock, cheese, bread, meat, wildfire, desert-cover, and wild-horse categories are intentionally not fabricated. They require separate FAOSTAT, GWIS, and geospatial pipelines and should be added only with explicit definitions and provenance.

## Deploy to Vercel

- Framework preset: Next.js
- Root directory: the folder containing this `package.json`
- Build command: leave blank/default
- Output directory: leave blank/default
- Environment variables: none

There is deliberately no `package-lock.json`; Vercel will install the pinned versions in `package.json`.
