import type { Category } from "./categories";

export type CountryInfo = { id: string; name: string; region: string; flag: string };
export type Observation = { countryId: string; countryName: string; value: number; year: string };
export type CategoryDataset = { category: Category; observations: Observation[]; year: string };

const WB_FETCH_OPTIONS = { next: { revalidate: 86400 } } as RequestInit & { next: { revalidate: number } };

const COUNTRY_OVERRIDES: Record<string, string> = {
  XKX: "🇽🇰"
};

function flagFromIso2(iso2: string) {
  if (!iso2 || iso2.length !== 2) return "🌐";
  return String.fromCodePoint(...iso2.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0)));
}

export async function fetchCountries(signal?: AbortSignal): Promise<CountryInfo[]> {
  const response = await fetch("https://api.worldbank.org/v2/country?format=json&per_page=400", { ...WB_FETCH_OPTIONS, signal });
  if (!response.ok) throw new Error("Country list could not be loaded from the World Bank.");
  const json = await response.json();
  const rows = json?.[1] ?? [];
  return rows
    .filter((row: any) => row.region?.id && row.region.id !== "NA" && row.capitalCity)
    .map((row: any) => ({
      id: row.id,
      name: row.name,
      region: row.region.value,
      flag: COUNTRY_OVERRIDES[row.id] ?? flagFromIso2(row.iso2Code)
    }))
    .sort((a: CountryInfo, b: CountryInfo) => a.name.localeCompare(b.name));
}

export async function fetchWorldBankCategory(category: Category, signal?: AbortSignal): Promise<CategoryDataset> {
  const minimumYear = category.minimumYear ?? 2022;
  const currentYear = new Date().getUTCFullYear();
  const url = `https://api.worldbank.org/v2/country/all/indicator/${category.indicator}?format=json&per_page=5000&date=${minimumYear}:${currentYear}`;
  const response = await fetch(url, { ...WB_FETCH_OPTIONS, signal });
  if (!response.ok) throw new Error(`${category.shortName} data could not be loaded.`);
  const json = await response.json();
  const rows = json?.[1] ?? [];
  const latest = new Map<string, Observation>();
  const seen = new Map<string, number>();
  for (const row of rows) {
    const id = row.countryiso3code;
    const value = Number(row.value);
    const year = String(row.date ?? "");
    if (!id || id.length !== 3 || !Number.isFinite(value) || !/^\d{4}$/.test(year)) continue;
    if (Number(year) < minimumYear) continue;
    const duplicateKey = `${id}:${year}`;
    const priorValue = seen.get(duplicateKey);
    if (priorValue !== undefined && Math.abs(priorValue - value) > 1e-9) throw new Error(`${category.shortName} returned contradictory values for ${id} in ${year}.`);
    seen.set(duplicateKey, value);
    const prior = latest.get(id);
    if (!prior || Number(year) > Number(prior.year)) latest.set(id, { countryId: id, countryName: row.country?.value ?? id, value, year });
  }
  const observations = [...latest.values()];
  if (observations.length < category.coverageFloor) throw new Error(`${category.shortName} has only ${observations.length} countries with ${minimumYear}+ data; ${category.coverageFloor} are required.`);
  const year = observations.map((o) => o.year).sort().reverse()[0] ?? `${minimumYear}+`;
  return { category, observations, year };
}
