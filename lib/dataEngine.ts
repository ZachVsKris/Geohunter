import type { Category } from "./categories";
import type { CategoryDataset, CountryInfo, Observation } from "./worldBank";
import { MAX_YEAR_SPREAD } from "./version";
import { categorySourceUrl } from "./sourceRegistry";
import { ROUND_CONFIGS, configForDimensions, pointsForBankSize } from "./gameRules";

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

export const POINTS_BY_RANK = ROUND_CONFIGS.easy.pointsByRank;
export const EXPERT_POINTS_BY_RANK = ROUND_CONFIGS.expert.pointsByRank;
export const LEGACY_POINTS_BY_RANK = EXPERT_POINTS_BY_RANK;

export function sourceUrl(indicator: string, source: Category["source"] = "worldbank") {
  return categorySourceUrl(source, indicator);
}

export function canonicalizeDataset(dataset: CategoryDataset): CanonicalDataset {
  const sorted = [...dataset.observations]
    .filter((row) => {
      const range = dataset.category.expectedRange;
      return !range || (row.value >= range[0] && row.value <= range[1]);
    })
    .sort((a, b) => dataset.category.direction === "high" ? b.value - a.value : a.value - b.value);

  let lastValue: number | null = null;
  let lastRank = 0;
  const ranked = sorted.map((row, index) => {
    const rank = lastValue !== null && Math.abs(row.value - lastValue) < 1e-12 ? lastRank : index + 1;
    lastValue = row.value;
    lastRank = rank;
    return { ...row, globalRank: rank };
  });

  return {
    ...dataset,
    ranked,
    byCountry: new Map(ranked.map((row) => [row.countryId, row])),
    sourceUrl: sourceUrl(dataset.category.indicator, dataset.category.source),
  };
}

export function poolLeaderboard(dataset: CanonicalDataset, bank: CountryInfo[]): PoolRow[] {
  const sorted = bank
    .map((country) => {
      const observation = dataset.byCountry.get(country.id);
      return observation ? { country, observation } : null;
    })
    .filter((row): row is { country: CountryInfo; observation: RankedObservation } => Boolean(row))
    .sort((a, b) => dataset.category.direction === "high"
      ? b.observation.value - a.observation.value
      : a.observation.value - b.observation.value);

  let lastValue: number | null = null;
  let lastRank = 0;
  return sorted.map((row, index) => {
    const poolRank = lastValue !== null && Math.abs(row.observation.value - lastValue) < 1e-12 ? lastRank : index + 1;
    lastValue = row.observation.value;
    lastRank = poolRank;
    const pointsTable = pointsForBankSize(bank.length);
    return { ...row, poolRank, points: pointsTable[poolRank - 1] ?? 0 };
  });
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
  const config = configForDimensions(categories.length, bank.length);
  if (!config) {
    errors.push(`Unsupported board dimensions: ${categories.length} categories with ${bank.length} countries.`);
  }

  const winners = categories.map((dataset) => poolLeaderboard(dataset, bank)[0]?.country.id).filter(Boolean);
  if (new Set(winners).size !== categories.length) {
    errors.push(`The ${categories.length} categories do not have ${categories.length} distinct pool winners.`);
  }

  for (const dataset of categories) {
    const leaderboard = poolLeaderboard(dataset, bank);
    if (leaderboard.length !== bank.length) {
      errors.push(`${dataset.category.name} is missing data for ${bank.length - leaderboard.length} pool countries.`);
    }
    const years = leaderboard.map((row) => Number(row.observation.year)).filter(Number.isFinite);
    if (years.length) {
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      if (dataset.category.minimumYear && minYear < dataset.category.minimumYear) {
        errors.push(`${dataset.category.name} contains data older than ${dataset.category.minimumYear}.`);
      }
      if (maxYear - minYear > MAX_YEAR_SPREAD) {
        errors.push(`${dataset.category.name} has a ${maxYear - minYear}-year observation spread.`);
      }
      if (dataset.category.requireCommonYear && minYear !== maxYear) {
        errors.push(`${dataset.category.name} requires a common comparison year.`);
      }
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
  if (["people", "passengers", "arrivals", "departures", "passenger-km", "hectares", "km²", "tonnes"].includes(category.unit)) {
    if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B ${category.unit}`;
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M ${category.unit}`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: category.decimals ?? 1 })} ${category.unit}`;
}
