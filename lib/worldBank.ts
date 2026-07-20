import type { Category } from "./categories";

export type CountryInfo = { id: string; name: string; region: string; flag: string };
export type Observation = { countryId: string; countryName: string; value: number; year: string };
export type CategoryDataset = { category: Category; observations: Observation[]; year: string };

const COUNTRY_OVERRIDES: Record<string, string> = {
  XKX: "🇽🇰"
};

const REQUEST_TIMEOUT_MS = 12000;
const COUNTRY_STORAGE_KEY = "geo-v270-worldbank-countries";
const COUNTRY_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
    const cached = window.localStorage.getItem(COUNTRY_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as { countries?: CountryInfo[]; savedAt?: number };
      if (Array.isArray(parsed.countries) && typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt <= COUNTRY_CACHE_TTL_MS) return parsed.countries;
    }
  } catch {}
  const response = await fetchWithTimeout("/api/worldbank/countries", { cache: "force-cache" });
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
  try { window.localStorage.setItem(COUNTRY_STORAGE_KEY, JSON.stringify({ countries, savedAt: Date.now() })); } catch {}
  return countries;
}

export async function fetchWorldBankCategory(category: Category): Promise<CategoryDataset> {
  const url = `/api/worldbank/indicator/${encodeURIComponent(category.indicator)}`;
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
