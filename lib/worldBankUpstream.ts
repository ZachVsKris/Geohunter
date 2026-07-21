import type { Category } from "./categories";
import type { CategoryDataset, CountryInfo, Observation } from "./worldBank";

const COUNTRY_OVERRIDES: Record<string, string> = {
  XKX: "🇽🇰",
};

function flagFromIso2(iso2: string) {
  if (!iso2 || iso2.length !== 2) return "🌐";
  return String.fromCodePoint(...iso2.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0)));
}

async function upstreamJson(url: string, label: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Geo-Second-Coming/10.5.3" },
        next: { revalidate: 86_400 },
      });
      if (!response.ok) throw new Error(`${label} request failed (${response.status}).`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} request failed.`);
}

export async function fetchCountriesUpstream(): Promise<CountryInfo[]> {
  const json = await upstreamJson(
    "https://api.worldbank.org/v2/country?format=json&per_page=400",
    "World Bank country list",
  );
  const rows = json?.[1] ?? [];
  return rows
    .filter((row: any) => row.region?.id && row.region.id !== "NA" && row.capitalCity)
    .map((row: any) => ({
      id: row.id,
      name: row.name,
      region: row.region.value,
      flag: COUNTRY_OVERRIDES[row.id] ?? flagFromIso2(row.iso2Code),
    }))
    .sort((a: CountryInfo, b: CountryInfo) => a.name.localeCompare(b.name));
}

export async function fetchWorldBankCategoryUpstream(category: Category): Promise<CategoryDataset> {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${category.indicator}?format=json&per_page=20000&mrnev=8`;
  const json = await upstreamJson(url, category.shortName);
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
    throw new Error(
      `${category.shortName} has only ${observations.length} countries with ${minimumYear}+ data; ${category.coverageFloor} are required.`,
    );
  }
  const year = observations.map((observation) => observation.year).sort().reverse()[0] ?? `${minimumYear}+`;
  return { category, observations, year };
}
