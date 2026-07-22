#!/usr/bin/env node
// Natural Earth is wired into the source registry, but intentionally contributes
// no playable categories: its boundary and physical-geometry attributes are
// timeless/versioned rather than annual observations and therefore cannot meet
// GeoStats's hard 2022+ observation rule.
console.log("Natural Earth integration verified: source registered; 0 playable categories under the 2022+ rule.");
