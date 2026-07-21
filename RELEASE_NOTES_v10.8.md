# v10.8 — Fast, Reliable Round Loading

- Restores the fast v9-style browser-to-World-Bank loading path instead of routing every initial indicator through one slow server request.
- Loads only ten candidate categories initially, with four requests at a time, and fetches more only when the first group cannot form a valid board.
- Adds short request timeouts and a cached same-origin fallback for temporarily slow or blocked World Bank requests.
- Caches each successful category dataset on the device for seven days and caches fallback API responses at the edge.
- Replaces the expensive brute-force round search with a forward-checking solver that eliminates incompatible country choices early.
- Chooses category combinations with enough shared country coverage before attempting the eight-winner search.
- Tries deterministic fallback layouts automatically instead of showing the old “seed could not produce a balanced round” error.
- Preserves exact shared-link parameters while the challenge is loading, so a failed request cannot erase the board encoded in the URL.
- Retrying a failed random round now creates a genuinely new seed rather than repeating the same failed seed.
- Prevents an older slow request from overwriting a newer Daily or Random request.
- Keeps the v10.7 compact desktop and mobile layouts unchanged.
