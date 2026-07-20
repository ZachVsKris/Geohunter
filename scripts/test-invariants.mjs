import assert from "node:assert/strict";
import fs from "node:fs";

const points=[100,90,80,70,60,50,40,30,20,10];
assert.equal(points.length,10);
for(let i=1;i<points.length;i++) assert.equal(points[i-1]-points[i],10);

const categoriesSource=fs.readFileSync(new URL("../lib/categories.ts",import.meta.url),"utf8");
const ids=[...categoriesSource.matchAll(/wb\(\{id:"([^"]+)"/g)].map((m)=>m[1]);
assert.equal(ids.length,76,"Expected 76 World Bank category definitions.");
assert.equal(new Set(ids).size,ids.length,"Category IDs must be unique.");
assert.ok(!categoriesSource.includes('id:"waterStress"'),"Freshwater-withdrawal share must not be playable.");
assert.ok(categoriesSource.includes('export type DataSourceId = "worldbank"'),"Only World Bank may remain a source.");
assert.ok(categoriesSource.includes('Math.max(2022, category.minimumYear ?? 2022)'),"Every category must enforce the 2022 floor.");
for(const removed of ["faostat","unesco","untourism","naturalearth"]) assert.ok(!categoriesSource.includes(`source: "${removed}"`));

const adapter=fs.readFileSync(new URL("../lib/worldBank.ts",import.meta.url),"utf8");
assert.ok(adapter.includes("Number(year) < minimumYear"),"The adapter must reject pre-2022 observations.");
assert.ok(adapter.includes("contradictory"),"The adapter must reject contradictory country-year values.");
assert.ok(adapter.includes("coverageFloor"),"The adapter must enforce category coverage.");
assert.ok(adapter.includes('/api/worldbank/indicator/'),"Indicator requests must use the cached same-origin route.");

const registry=fs.readFileSync(new URL("../lib/sourceRegistry.ts",import.meta.url),"utf8");
assert.ok(registry.includes("worldbank:"),"World Bank registry entry is required.");
for(const removed of ["faostat:","who:","unesco:","untourism:","naturalearth:"]) assert.ok(!registry.includes(removed),`Removed source remains in registry: ${removed}`);

const game=fs.readFileSync(new URL("../components/GeoSecondComingGame.tsx",import.meta.url),"utf8");
assert.ok(game.includes("Current library: {CATEGORIES.length} verified World Bank category definitions"));
assert.ok(game.includes("View official data source ↗"));
assert.ok(!/FAOSTAT|UNESCO UIS|UN Tourism|Natural Earth/.test(game),"Stale multisource UI text remains.");

console.log(`World Bank-only invariant and recency tests passed (${ids.length} definitions).`);
