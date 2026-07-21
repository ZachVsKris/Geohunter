# Geo: Second Coming — v10.6 Mobile Reliability & Load Speed

World Bank 76 build based on the v10.5 compact mobile board.

- Single-screen mobile drag-and-drop board retained
- Share Score now sends one complete score-and-link message
- Reliable clipboard fallback when native sharing is unavailable or fails
- Random seeds no longer contain hidden newline characters
- Rules reduced to the three facts players need
- Clarifies that each specialist is top-ranked within the ten-country bank, not necessarily worldwide
- Country and indicator data now load through compact same-origin API routes
- Country and category snapshots are cached locally for seven days
- World Bank requests are cached server-side and limited to 2022-current observations
- Country data and indicator data load in parallel
- Maximum two playable categories per subject family retained
