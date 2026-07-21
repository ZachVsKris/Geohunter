import type { Category } from "./categories";
import type { CategoryDataset } from "./worldBank";
import { fetchWorldBankCategories, fetchWorldBankCategory } from "./worldBank";
import { fetchFaostatCategory } from "./faostat";
import { fetchDistributedIndicator } from "./distributedIndicators";

export async function fetchCategories(categories: Category[]): Promise<Map<string, CategoryDataset>> {
  const worldBank = categories.filter((category) => category.source === "worldbank");
  const output = await fetchWorldBankCategories(worldBank);

  const remaining = categories.filter((category) => category.source !== "worldbank");
  const settled = await Promise.allSettled(remaining.map(async (category) => [category.id, await fetchCategory(category)] as const));
  for (const result of settled) {
    if (result.status === "fulfilled") output.set(result.value[0], result.value[1]);
  }
  return output;
}

export async function fetchCategory(category: Category): Promise<CategoryDataset> {
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
