import type { Category } from "./categories";

export type CountryInfo = { id: string; name: string; region: string; flag: string };
export type Observation = { countryId: string; countryName: string; value: number; year: string };
export type CategoryDataset = { category: Category; observations: Observation[]; year: string };

type DatasetApiResult =
  | { id: string; dataset: CategoryDataset }
  | { id: string; error: string };

async function fetchJsonWithRetry(url: string, init?: RequestInit, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status}).`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Load failed.");
}

export async function fetchCountries(): Promise<CountryInfo[]> {
  const body = await fetchJsonWithRetry("/api/worldbank/countries", undefined, 3);
  if (!Array.isArray(body?.countries)) throw new Error("Country list could not be loaded.");
  return body.countries;
}

export async function fetchWorldBankCategories(categories: Category[]): Promise<Map<string, CategoryDataset>> {
  const pending = new Map(categories.map((category) => [category.id, category]));
  const loaded = new Map<string, CategoryDataset>();
  const errors = new Map<string, string>();

  for (let attempt = 0; attempt < 3 && pending.size; attempt++) {
    const ids = [...pending.keys()];
    const body = await fetchJsonWithRetry(
      "/api/worldbank/datasets",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryIds: ids }),
      },
      2,
    );
    const results: DatasetApiResult[] = Array.isArray(body?.results) ? body.results : [];
    for (const result of results) {
      if ("dataset" in result) {
        loaded.set(result.id, result.dataset);
        pending.delete(result.id);
        errors.delete(result.id);
      } else {
        errors.set(result.id, result.error);
      }
    }
    if (pending.size && attempt < 2) await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }

  if (pending.size && loaded.size === 0) {
    const firstId = pending.keys().next().value as string | undefined;
    throw new Error((firstId && errors.get(firstId)) || "Official indicator data could not be loaded.");
  }
  return loaded;
}

export async function fetchWorldBankCategory(category: Category): Promise<CategoryDataset> {
  const loaded = await fetchWorldBankCategories([category]);
  const dataset = loaded.get(category.id);
  if (!dataset) throw new Error(`${category.shortName} data could not be loaded.`);
  return dataset;
}
