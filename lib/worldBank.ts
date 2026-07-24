import type { Category } from "./categories";
import { isUnRecognizedCountry } from "./playableCountries";

export type CountryInfo = { id: string; name: string; region: string; flag: string };
export type Observation = { countryId: string; countryName: string; value: number; year: string };
export type CategoryDataset = { category: Category; observations: Observation[]; year: string };

const COUNTRY_OVERRIDES: Record<string, string> = { XKX: "🇽🇰" };
let playableCountriesPromise: Promise<CountryInfo[]> | null = null;

function flagFromIso2(iso2: string) {
  if (!iso2 || iso2.length !== 2) return "🌐";
  return String.fromCodePoint(...iso2.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0)));
}

async function fetchJsonWithRetry(url: string, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`World Bank returned HTTP ${response.status}.`);
      const json = await response.json();
      const apiMessage = Array.isArray(json) ? json?.[0]?.message?.[0]?.value : null;
      if (apiMessage) throw new Error(`World Bank API: ${apiMessage}`);
      return json;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("World Bank request failed.");
}

export async function fetchCountries(): Promise<CountryInfo[]> {
  if (!playableCountriesPromise) {
    playableCountriesPromise = (async () => {
      const json = await fetchJsonWithRetry("https://api.worldbank.org/v2/country?format=json&per_page=400");
      const rows = json?.[1] ?? [];
      return rows
        // World Bank aggregate entities (World, income groups, regions, etc.) use region.id = NA.
        // Keep actual countries and territories only; do not use capitalCity because several valid
        // playable territories omit it in World Bank metadata.
        .filter((row: any) => row.id?.length === 3 && row.region?.id && row.region.id !== "NA" && isUnRecognizedCountry(row.id))
        .map((row: any) => ({
          id: row.id,
          name: row.name,
          region: row.region.value,
          flag: COUNTRY_OVERRIDES[row.id] ?? flagFromIso2(row.iso2Code)
        }))
        .sort((a: CountryInfo, b: CountryInfo) => a.name.localeCompare(b.name));
    })();
  }
  return playableCountriesPromise;
}

export async function fetchWorldBankCategory(category: Category): Promise<CategoryDataset> {
  const [countries, json] = await Promise.all([
    fetchCountries(),
    fetchJsonWithRetry(`https://api.worldbank.org/v2/country/all/indicator/${category.indicator}?format=json&per_page=20000&mrnev=8`)
  ]);
  const playableIds = new Set(countries.map((country) => country.id));
  const rows = json?.[1] ?? [];
  const latest = new Map<string, Observation>();
  const minimumYear = category.minimumYear ?? 2022;
  const seen = new Map<string, number>();

  for (const row of rows) {
    const id = row.countryiso3code;
    const value = Number(row.value);
    const year = String(row.date ?? "");
    if (!playableIds.has(id) || !Number.isFinite(value) || !/^\d{4}$/.test(year)) continue;
    if (Number(year) < minimumYear) continue;
    const duplicateKey = `${id}:${year}`;
    const priorValue = seen.get(duplicateKey);
    if (priorValue !== undefined && Math.abs(priorValue - value) > 1e-9) {
      throw new Error(`${category.shortName} returned contradictory values for ${id} in ${year}.`);
    }
    seen.set(duplicateKey, value);
    const prior = latest.get(id);
    if (!prior || Number(year) > Number(prior.year)) {
      latest.set(id, { countryId: id, countryName: row.country?.value ?? id, value, year });
    }
  }

  const observations = [...latest.values()];
  if (observations.length < category.coverageFloor) {
    throw new Error(`${category.shortName} has only ${observations.length} playable countries with ${minimumYear}+ data; ${category.coverageFloor} are required.`);
  }
  const year = observations.map((o) => o.year).sort().reverse()[0] ?? `${minimumYear}+`;
  return { category, observations, year };
}
