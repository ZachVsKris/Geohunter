#!/usr/bin/env node
import fs from "node:fs";

const sourceArg = process.argv.find((arg) => arg.startsWith("--source="))?.split("=")[1]
  ?? process.argv[process.argv.indexOf("--source") + 1];
const allowed = new Set(["who", "unesco", "untourism"]);
if (!allowed.has(sourceArg)) throw new Error("Use --source who, --source unesco, or --source untourism.");

const categorySource = fs.readFileSync(new URL("../lib/categories.ts", import.meta.url), "utf8");
const factory = sourceArg === "who" ? "who" : sourceArg === "unesco" ? "unesco" : "tourism";
const pattern = new RegExp(`${factory}\\(\\{id:\"([^\"]+)\",name:\"([^\"]+)\",shortName:\"[^\"]+\",indicator:\"([^\"]+)\"[\\s\\S]*?coverageFloor:(\\d+)\\}\\)`, "g");
const categories = [...categorySource.matchAll(pattern)].map(([, id, name, indicator, floor]) => ({ id, name, indicator, floor: Number(floor) }));
if (!categories.length) throw new Error(`No ${sourceArg} categories found.`);

async function fetchJson(url, label) {
  const response = await fetch(url, { headers: { "User-Agent": "geo-second-coming-source-verifier/2.4" } });
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  return response.json();
}

for (const category of categories) {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${category.indicator}?format=json&per_page=20000&mrnev=10`;
  const json = await fetchJson(url, category.name);
  const latest = new Map();
  const seen = new Map();
  for (const row of json?.[1] ?? []) {
    const iso = String(row.countryiso3code ?? "");
    const year = String(row.date ?? "");
    const value = Number(row.value);
    if (!/^[A-Z]{3}$/.test(iso) || !/^\d{4}$/.test(year) || !Number.isFinite(value) || Number(year) < 2022) continue;
    const key = `${iso}:${year}`;
    if (seen.has(key) && Math.abs(seen.get(key) - value) > 1e-9) throw new Error(`${category.name}: contradictory ${key}`);
    seen.set(key, value);
    if (!latest.has(iso) || Number(year) > Number(latest.get(iso).year)) latest.set(iso, { year, value });
  }
  if (latest.size < category.floor) throw new Error(`${category.name}: 2022+ coverage ${latest.size} below ${category.floor}`);
  const newest = [...latest.values()].map((row) => row.year).sort().at(-1);
  const oldest = [...latest.values()].map((row) => row.year).sort().at(0);
  console.log(`✓ ${category.name}: ${latest.size} countries, observation years ${oldest}–${newest}`);
}
console.log(`${sourceArg} 2022+ verification passed (${categories.length} categories).`);
