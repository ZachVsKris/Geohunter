#!/usr/bin/env node
import fs from "node:fs";

const categorySource = fs.readFileSync(new URL("../lib/categories.ts", import.meta.url), "utf8");
const categories = [...categorySource.matchAll(/wb\(\{id:"([^"]+)",name:"([^"]+)",shortName:"[^"]+",indicator:"([^"]+)"([\s\S]*?)\}\)/g)]
  .map(([, id, name, indicator, rest]) => {
    const floor = Number(rest.match(/coverageFloor:(\d+)/)?.[1] ?? 100);
    const minimumYear = Math.max(2022, Number(rest.match(/minimumYear:(\d+)/)?.[1] ?? 2022));
    return { id, name, indicator, floor, minimumYear };
  });

if (!categories.length) throw new Error("No World Bank categories found.");

async function fetchJson(url, label) {
  const response = await fetch(url, { headers: { "User-Agent": "geostats-worldbank-verifier/11.3" } });
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
    const year = Number(row.date);
    const value = Number(row.value);
    if (!/^[A-Z]{3}$/.test(iso) || !Number.isInteger(year) || year < category.minimumYear || !Number.isFinite(value)) continue;
    const key = `${iso}:${year}`;
    if (seen.has(key) && Math.abs(seen.get(key) - value) > 1e-9) throw new Error(`${category.name}: contradictory ${key}`);
    seen.set(key, value);
    if (!latest.has(iso) || year > latest.get(iso).year) latest.set(iso, { year, value });
  }

  if (latest.size < category.floor) {
    throw new Error(`${category.name}: ${category.minimumYear}+ coverage ${latest.size} below ${category.floor}`);
  }
  const years = [...latest.values()].map((row) => row.year).sort((a, b) => a - b);
  console.log(`✓ ${category.name}: ${latest.size} countries, observation years ${years[0]}–${years.at(-1)}`);
}

console.log(`World Bank verification passed (${categories.length} categories).`);
