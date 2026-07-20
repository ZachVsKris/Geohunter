import type { Category } from "./categories";
import type { CategoryDataset } from "./worldBank";
import { fetchWorldBankCategory } from "./worldBank";

const datasetPromiseCache = new Map<string, Promise<CategoryDataset>>();
const STORAGE_PREFIX = "geo-v270-worldbank-dataset:";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function storageKey(category: Category) {
  return `${STORAGE_PREFIX}${category.id}`;
}

function readStoredDataset(category: Category): CategoryDataset | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(category));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { observations?: CategoryDataset["observations"]; year?: string; savedAt?: number };
    if (!Array.isArray(parsed.observations) || typeof parsed.year !== "string" || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      window.localStorage.removeItem(storageKey(category));
      return null;
    }
    return { category, observations: parsed.observations, year: parsed.year };
  } catch {
    return null;
  }
}

function writeStoredDataset(dataset: CategoryDataset) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(dataset.category),
      JSON.stringify({ observations: dataset.observations, year: dataset.year, savedAt: Date.now() }),
    );
  } catch {
    // The game still works if browser storage is unavailable or full.
  }
}

export function fetchCategory(category: Category): Promise<CategoryDataset> {
  if (!category.certified || category.enabled === false) {
    return Promise.reject(new Error(`${category.shortName} is not certified for playable rounds.`));
  }

  const cached = datasetPromiseCache.get(category.id);
  if (cached) return cached;

  const stored = readStoredDataset(category);
  if (stored) {
    const request = Promise.resolve(stored);
    datasetPromiseCache.set(category.id, request);
    return request;
  }

  const request = fetchWorldBankCategory(category)
    .then((dataset) => {
      writeStoredDataset(dataset);
      return dataset;
    })
    .catch((error) => {
      datasetPromiseCache.delete(category.id);
      throw error;
    });

  datasetPromiseCache.set(category.id, request);
  return request;
}
