import type { Category } from "./categories";

export const CATEGORY_COUNT = 6;
export const COUNTRY_COUNT = 8;
export const DECOY_COUNT = COUNTRY_COUNT - CATEGORY_COUNT;
export const MAX_SCORE = CATEGORY_COUNT * 100;
export const TOP_FINISH_RANK = 3;
export const MIN_ROUND_TYPES = 4;
export const MAX_PER_ROUND_TYPE = 2;
export const MAX_GENERAL_TRADE = 2;
export const MAX_TOTAL_TRADE = 3;

const ROUND_TYPE_OVERRIDES: Record<string, string> = {
  exports: "Trade",
  imports: "Trade",
  exportsShare: "Trade",
};

const SIMILARITY_GROUPS: Record<string, string> = {
  gdp: "gdp",
  gdpPc: "gdp",
  gdpGrowth: "gdp",
  urban: "settlement-share",
  rural: "settlement-share",
  population: "population-count",
  urbanAbsolute: "population-count",
  ruralAbsolute: "population-count",
  older: "population-age",
  young: "population-age",
  forestArea: "forest",
  forestPct: "forest",
  leastForest: "forest",
  agLand: "agricultural-land",
  agLandArea: "agricultural-land",
  arablePct: "arable-land",
  arableHa: "arable-land",
  rain: "rainfall",
  dry: "rainfall",
  renewable: "renewable-energy",
  renewableConsumption: "renewable-energy",
  mobile: "telecom-subscriptions",
  fixedBroadband: "telecom-subscriptions",
  fixedTelephone: "telecom-subscriptions",
  airPassengers: "air-transport",
  airFreight: "air-transport",
  rail: "rail-transport",
  railFreight: "rail-transport",
  cerealProduction: "cereal",
  cerealYield: "cereal",
  co2Total: "emissions",
  co2PerCapita: "emissions",
  methane: "emissions",
  militarySpend: "military-spending",
  militaryShare: "military-spending",
  imports: "general-imports",
  merchImports: "general-imports",
  exports: "general-exports",
  merchExports: "general-exports",
  exportsShare: "general-exports",
  foodExportsShare: "food-trade",
  foodImportsShare: "food-trade",
  oilRents: "resource-rents",
  gasRents: "resource-rents",
  mineralRents: "resource-rents",
};


export function roundType(category: Category) {
  return category.roundType ?? ROUND_TYPE_OVERRIDES[category.id] ?? category.family;
}

export function similarityGroup(category: Category) {
  return category.similarityGroup ?? SIMILARITY_GROUPS[category.id] ?? `indicator:${category.indicator}`;
}

export function isTradeCategory(category: Category) {
  return roundType(category) === "Trade" || category.productSpecificTrade === true;
}

export function isGeneralTradeCategory(category: Category) {
  return roundType(category) === "Trade" && category.productSpecificTrade !== true;
}

export function measureKind(category: Category) {
  const text = `${category.unit} ${category.description}`.toLowerCase();
  if (text.includes("per person") || text.includes("/person") || text.includes("per capita")) return "per-person";
  if (text.includes("per 100") || text.includes("per 1,000") || text.includes("per 100,000")) return "rate";
  if (text.includes("%") || text.includes("percent") || text.includes("share")) return "percentage";
  if (text.includes("usd") || text.includes("total") || text.includes("people") || text.includes("ton") || text.includes("km²") || text.includes("hectare")) return "total";
  return "other";
}

export function canAddCategory(selected: Category[], category: Category) {
  const type = roundType(category);
  if (selected.filter((item) => roundType(item) === type).length >= MAX_PER_ROUND_TYPE) return false;

  const group = similarityGroup(category);
  if (selected.some((item) => similarityGroup(item) === group)) return false;

  if (isGeneralTradeCategory(category) && selected.filter(isGeneralTradeCategory).length >= MAX_GENERAL_TRADE) return false;
  if (isTradeCategory(category) && selected.filter(isTradeCategory).length >= MAX_TOTAL_TRADE) return false;

  return true;
}

export function roundHasRequiredDiversity(categories: Category[]) {
  if (categories.length !== CATEGORY_COUNT) return false;
  const types = new Set(categories.map(roundType));
  if (types.size < MIN_ROUND_TYPES) return false;
  if (categories.filter(isGeneralTradeCategory).length > MAX_GENERAL_TRADE) return false;
  if (categories.filter(isTradeCategory).length > MAX_TOTAL_TRADE) return false;
  if (new Set(categories.map(similarityGroup)).size !== categories.length) return false;
  return true;
}
