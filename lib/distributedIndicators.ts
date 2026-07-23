import type { Category } from "./categories";
import type { CategoryDataset, Observation } from "./worldBank";

/**
 * WHO, UNESCO UIS, and UN Tourism publish a number of official series through
 * the World Bank WDI distribution API. We use that single distribution path
 * rather than blending values from multiple mirrors. The category metadata
 * still identifies the originating statistical agency.
 */
export async function fetchDistributedIndicator(category: Category): Promise<CategoryDataset> {
  const minimumYear = category.minimumYear ?? 2022;
  const url = `https://api.worldbank.org/v2/country/all/indicator/${category.indicator}?format=json&per_page=20000&mrnev=10`;
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`${category.shortName} data could not be loaded.`);
  const json = await response.json();
  const rows = json?.[1] ?? [];
  const latest = new Map<string, Observation>();
  const seen = new Map<string, number>();

  for (const row of rows) {
    const id = String(row.countryiso3code ?? "").trim();
    const year = String(row.date ?? "").trim();
    const value = Number(row.value);
    if (!/^[A-Z]{3}$/.test(id) || !/^\d{4}$/.test(year) || !Number.isFinite(value)) continue;
    if (Number(year) < minimumYear) continue;

    const duplicateKey = `${id}:${year}`;
    const priorValue = seen.get(duplicateKey);
    if (priorValue !== undefined && Math.abs(priorValue - value) > 1e-9) {
      throw new Error(`${category.shortName} returned contradictory values for ${id} in ${year}.`);
    }
    seen.set(duplicateKey, value);

    const prior = latest.get(id);
    if (!prior || Number(year) > Number(prior.year)) {
      latest.set(id, {
        countryId: id,
        countryName: row.country?.value ?? id,
        value,
        year,
      });
    }
  }

  const observations = [...latest.values()];
  if (observations.length < category.coverageFloor) {
    throw new Error(`${category.shortName} has only ${observations.length} countries with ${minimumYear}+ data; ${category.coverageFloor} are required.`);
  }
  const year = observations.map((row) => row.year).sort().reverse()[0] ?? `${minimumYear}+`;
  return { category, observations, year };
}
