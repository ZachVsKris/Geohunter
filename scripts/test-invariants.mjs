import assert from "node:assert/strict";
import fs from "node:fs";

const points=[100,90,80,70,60,50,40,30,20,10];
assert.equal(points.length,10);
for(let i=1;i<points.length;i++) assert.equal(points[i-1]-points[i],10);

const categoriesSource=fs.readFileSync(new URL("../lib/categories.ts",import.meta.url),"utf8");
const factories=["wb","fao","who","unesco","tourism"];
const byFactory=Object.fromEntries(factories.map((factory)=>[factory,[...categoriesSource.matchAll(new RegExp(`${factory}\\(\\{id:\"([^\"]+)\"`,"g"))].map((m)=>m[1])]));
const ids=Object.values(byFactory).flat();
assert.equal(byFactory.wb.length,76,"Expected 76 World Bank-origin categories after source attribution.");
assert.equal(byFactory.fao.length,26,"Expected 26 FAOSTAT categories.");
assert.equal(byFactory.who.length,7,"Expected 7 WHO categories.");
assert.equal(byFactory.unesco.length,6,"Expected 6 UNESCO UIS categories.");
assert.equal(byFactory.tourism.length,4,"Expected 4 UN Tourism categories.");
assert.equal(ids.length,119,"Expected 119 category definitions.");
assert.equal(new Set(ids).size,ids.length,"Category IDs must be unique.");
assert.ok(!categoriesSource.includes('id:"waterStress"'),"Freshwater-withdrawal share must not be playable.");
assert.ok(categoriesSource.includes('Math.max(2022, category.minimumYear ?? 2022)'),"Every factory must enforce the 2022 floor.");

const wb=fs.readFileSync(new URL("../lib/worldBank.ts",import.meta.url),"utf8");
const fao=fs.readFileSync(new URL("../lib/faostat.ts",import.meta.url),"utf8");
const distributed=fs.readFileSync(new URL("../lib/distributedIndicators.ts",import.meta.url),"utf8");
for(const adapter of [wb,fao,distributed]) {
  assert.ok(adapter.includes("Number(year) < minimumYear"),"Every annual-data adapter must reject pre-2022 observations.");
  assert.ok(adapter.includes("contradictory"),"Every annual-data adapter must reject contradictory country-year values.");
  assert.ok(adapter.includes("coverageFloor"),"Every annual-data adapter must enforce category coverage.");
}

const registry=fs.readFileSync(new URL("../lib/sourceRegistry.ts",import.meta.url),"utf8");
for(const source of ["worldbank","faostat","who","unesco","untourism","naturalearth"]) assert.ok(registry.includes(`${source}:`),`Missing source registry entry: ${source}`);
assert.ok(registry.includes('playable: false'),"Natural Earth must remain non-playable under the annual recency rule.");
assert.ok(fs.existsSync(new URL("./verify-distributed.mjs",import.meta.url)));
assert.ok(fs.existsSync(new URL("./verify-natural-earth.mjs",import.meta.url)));

console.log(`Invariant and recency-gate tests passed (${ids.length} definitions: ${byFactory.wb.length} World Bank + ${byFactory.fao.length} FAOSTAT + ${byFactory.who.length} WHO + ${byFactory.unesco.length} UNESCO + ${byFactory.tourism.length} UN Tourism; Natural Earth 0 playable).`);
