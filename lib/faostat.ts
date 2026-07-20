import type { Category } from "./categories";
import type { CategoryDataset, Observation } from "./worldBank";

type ApiRow = Record<string, unknown>;

function normalizedRows(payload: unknown): ApiRow[] {
  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  if (data.length && Array.isArray(data[0])) {
    const [header, ...rows] = data as unknown[][];
    const keys = header.map(String);
    return rows.map((row) => Object.fromEntries(keys.map((key, index) => [key, row[index]])));
  }
  return data.filter((row): row is ApiRow => Boolean(row) && typeof row === "object" && !Array.isArray(row));
}

function pick(row: ApiRow, ...keys: string[]) {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null) return row[key];
  return undefined;
}

export async function fetchFaostatCategory(category: Category): Promise<CategoryDataset> {
  const response = await fetch(`/api/faostat?indicator=${encodeURIComponent(category.indicator)}`, { cache: "force-cache" });
  if (!response.ok) throw new Error(`${category.shortName} data could not be loaded from FAOSTAT.`);
  const payload = await response.json();
  const rows = normalizedRows(payload);
  const latest = new Map<string, Observation>();
  const seenYearValues = new Map<string, number>();
  const minimumYear = category.minimumYear ?? 2022;

  for (const row of rows) {
    const id = String(pick(row, "Area Code (ISO3)", "Area Code (ISO3) ", "area_code_iso3", "Area_Code_(ISO3)") ?? "").trim();
    const countryName = String(pick(row, "Area", "area") ?? id);
    const year = String(pick(row, "Year", "year") ?? "").trim();
    const value = Number(pick(row, "Value", "value"));
    const unit = String(pick(row, "Unit", "unit") ?? "").toLowerCase();
    if (!/^[A-Z]{3}$/.test(id) || !/^\d{4}$/.test(year) || !Number.isFinite(value)) continue;
    if (Number(year) < minimumYear) continue;
    if (unit && unit !== "t" && !unit.includes("tonne")) continue;

    const duplicateKey = `${id}:${year}`;
    const priorValue = seenYearValues.get(duplicateKey);
    if (priorValue !== undefined && Math.abs(priorValue - value) > 1e-9) {
      throw new Error(`FAOSTAT returned contradictory ${category.shortName} values for ${id} in ${year}.`);
    }
    seenYearValues.set(duplicateKey, value);

    const prior = latest.get(id);
    if (!prior || Number(year) > Number(prior.year)) latest.set(id, { countryId: id, countryName, value, year });
  }

  const observations = [...latest.values()];
  if (observations.length < category.coverageFloor) {
    throw new Error(`${category.shortName} has only ${observations.length} countries with ${minimumYear}+ FAOSTAT data; ${category.coverageFloor} are required.`);
  }
  const year = observations.map((row) => row.year).sort().reverse()[0] ?? "Latest available";
  return { category, observations, year };
}
