import type { Category } from "./categories";
import type { CategoryDataset } from "./worldBank";
import { fetchWorldBankCategory } from "./worldBank";
import { fetchFaostatCategory } from "./faostat";
import { fetchDistributedIndicator } from "./distributedIndicators";

const datasetPromiseCache = new Map<string, Promise<CategoryDataset>>();
const SESSION_PREFIX = "geo-v251-dataset:";

function readSessionDataset(category: Category): CategoryDataset | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${SESSION_PREFIX}${category.source}:${category.id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { observations?: CategoryDataset["observations"]; year?: string };
    if (!Array.isArray(parsed.observations) || typeof parsed.year !== "string") return null;
    return { category, observations: parsed.observations, year: parsed.year };
  } catch {
    return null;
  }
}

function writeSessionDataset(dataset: CategoryDataset) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `${SESSION_PREFIX}${dataset.category.source}:${dataset.category.id}`,
      JSON.stringify({ observations: dataset.observations, year: dataset.year }),
    );
  } catch {
    // Storage can be unavailable or full; in-memory caching still applies.
  }
}

async function fetchCategoryUncached(category: Category): Promise<CategoryDataset> {
  if (!category.certified || category.enabled === false) {
    throw new Error(`${category.shortName} is not certified for playable rounds.`);
  }
  switch (category.source) {
    case "worldbank":
      return fetchWorldBankCategory(category);
    case "faostat":
      return fetchFaostatCategory(category);
    case "who":
    case "unesco":
    case "untourism":
      return fetchDistributedIndicator(category);
    case "naturalearth":
      throw new Error("Natural Earth has no playable categories under the 2022+ observation rule.");
    default: {
      const exhaustive: never = category.source;
      throw new Error(`Unsupported data source: ${exhaustive}`);
    }
  }
}

/**
 * Reuse a category request for the lifetime of the page. This prevents the same
 * official dataset from being downloaded again when a player generates another
 * challenge, switches modes, or when two category definitions share an indicator.
 * Failed requests are evicted so a later retry can recover.
 */
export function fetchCategory(category: Category): Promise<CategoryDataset> {
  const key = `${category.source}:${category.id}`;
  const cached = datasetPromiseCache.get(key);
  if (cached) return cached;

  const sessionDataset = readSessionDataset(category);
  if (sessionDataset) {
    const request = Promise.resolve(sessionDataset);
    datasetPromiseCache.set(key, request);
    return request;
  }

  const request = fetchCategoryUncached(category)
    .then((dataset) => {
      writeSessionDataset(dataset);
      return dataset;
    })
    .catch((error) => {
      datasetPromiseCache.delete(key);
      throw error;
    });
  datasetPromiseCache.set(key, request);
  return request;
}
