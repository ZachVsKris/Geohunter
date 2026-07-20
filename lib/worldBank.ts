import type { Category } from "./categories";

export type CountryInfo = { id: string; name: string; region: string; flag: string };
export type Observation = { countryId: string; countryName: string; value: number; year: string };
export type CategoryDataset = { category: Category; observations: Observation[]; year: string };

const COUNTRY_OVERRIDES: Record<string, string> = {
  XKX: "🇽🇰"
};

const REQUEST_TIMEOUT_MS = 9000;
const COUNTRY_SESSION_KEY = "geo-v251-countries";

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function flagFromIso2(iso2: string) {
  if (!iso2 || iso2.length !== 2) return "🌐";
  return String.fromCodePoint(...iso2.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0)));
}

export async function fetchCountries(): Promise<CountryInfo[]> {
  try {
    const cached = window.sessionStorage.getItem(COUNTRY_SESSION_KEY);
    if (cached) return JSON.parse(cached) as CountryInfo[];
  } catch {}
  const response = await fetchWithTimeout("https://api.worldbank.org/v2/country?format=json&per_page=400", { cache: "force-cache" });
  if (!response.ok) throw new Error("Country list could not be loaded from the World Bank.");
  const json = await response.json();
  const rows = json?.[1] ?? [];
  const countries = rows
    .filter((row: any) => row.region?.id && row.region.id !== "NA" && row.capitalCity)
    .map((row: any) => ({
      id: row.id,
      name: row.name,
      region: row.region.value,
      flag: COUNTRY_OVERRIDES[row.id] ?? flagFromIso2(row.iso2Code)
    }))
    .sort((a: CountryInfo, b: CountryInfo) => a.name.localeCompare(b.name));
  try { window.sessionStorage.setItem(COUNTRY_SESSION_KEY, JSON.stringify(countries)); } catch {}
  return countries;
}

export async function fetchWorldBankCategory(category: Category): Promise<CategoryDataset> {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${category.indicator}?format=json&per_page=20000&mrnev=8`;
  const response = await fetchWithTimeout(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`${category.shortName} data could not be loaded.`);
  const json = await response.json();
  const rows = json?.[1] ?? [];
  const latest = new Map<string, Observation>();
  const minimumYear = category.minimumYear ?? 2022;
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
