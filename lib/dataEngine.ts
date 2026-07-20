import type { Category } from "./categories";
import type { CategoryDataset, CountryInfo, Observation } from "./worldBank";

export type RankedObservation = Observation & { globalRank: number };

export type CanonicalDataset = CategoryDataset & {
  ranked: RankedObservation[];
  byCountry: Map<string, RankedObservation>;
  sourceUrl: string;
};

export type PoolRow = {
  country: CountryInfo;
  observation: RankedObservation;
  poolRank: number;
  points: number;
};

export type ScoredPlacement = {
  dataset: CanonicalDataset;
  selected: PoolRow;
  best: PoolRow;
};

export const POINTS_BY_RANK = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10] as const;

export function sourceUrl(indicator: string) {
  return `https://data.worldbank.org/indicator/${indicator}?name_desc=false`;
}

export function canonicalizeDataset(dataset: CategoryDataset): CanonicalDataset {
  const ranked = [...dataset.observations]
    .sort((a, b) => dataset.category.direction === "high" ? b.value - a.value : a.value - b.value)
    .map((row, index) => ({ ...row, globalRank: index + 1 }));

  return {
    ...dataset,
    ranked,
    byCountry: new Map(ranked.map((row) => [row.countryId, row])),
    sourceUrl: sourceUrl(dataset.category.indicator),
  };
}

export function poolLeaderboard(dataset: CanonicalDataset, bank: CountryInfo[]): PoolRow[] {
  return bank
    .map((country) => {
      const observation = dataset.byCountry.get(country.id);
      return observation ? { country, observation } : null;
    })
    .filter((row): row is { country: CountryInfo; observation: RankedObservation } => Boolean(row))
    .sort((a, b) => dataset.category.direction === "high"
      ? b.observation.value - a.observation.value
      : a.observation.value - b.observation.value)
    .map((row, index) => ({
      ...row,
      poolRank: index + 1,
      points: POINTS_BY_RANK[index] ?? 0,
    }));
}

export function scorePlacements(
  categories: CanonicalDataset[],
  bank: CountryInfo[],
  assignments: Record<string, string>,
): ScoredPlacement[] {
  return categories.map((dataset) => {
    const leaderboard = poolLeaderboard(dataset, bank);
    const selectedId = assignments[dataset.category.id];
    const selected = leaderboard.find((row) => row.country.id === selectedId);
    const best = leaderboard[0];
    if (!selected || !best) {
      throw new Error(`Scoring invariant failed for ${dataset.category.name}.`);
    }
    return { dataset, selected, best };
  });
}

export function validateRound(categories: CanonicalDataset[], bank: CountryInfo[]) {
  const errors: string[] = [];
  if (categories.length !== 8) errors.push(`Expected 8 categories; found ${categories.length}.`);
  if (bank.length !== 10) errors.push(`Expected 10 countries; found ${bank.length}.`);

  const winners = categories.map((dataset) => poolLeaderboard(dataset, bank)[0]?.country.id).filter(Boolean);
  if (new Set(winners).size !== categories.length) {
    errors.push("The eight categories do not have eight distinct pool winners.");
  }

  for (const dataset of categories) {
    const leaderboard = poolLeaderboard(dataset, bank);
    if (leaderboard.length !== bank.length) {
      errors.push(`${dataset.category.name} is missing data for ${bank.length - leaderboard.length} pool countries.`);
    }
    for (let i = 1; i < leaderboard.length; i++) {
      const previous = leaderboard[i - 1].observation.value;
      const current = leaderboard[i].observation.value;
      const valid = dataset.category.direction === "high" ? previous >= current : previous <= current;
      if (!valid) errors.push(`${dataset.category.name} leaderboard is not sorted correctly.`);
    }
  }
  return errors;
}

export function formatValue(value: number, category: Category) {
  if (category.unit === "USD" || category.unit === "USD/person") {
    if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (["people", "passengers", "passenger-km", "hectares", "km²"].includes(category.unit)) {
    if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B ${category.unit}`;
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M ${category.unit}`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: category.decimals ?? 1 })} ${category.unit}`;
}
