import type { DataSourceId } from "./categories";

export type SourceDefinition = {
  id: DataSourceId;
  name: string;
  homepage: string;
  verifier: string;
  playable: boolean;
  note?: string;
};

export const SOURCE_REGISTRY: Record<DataSourceId, SourceDefinition> = {
  worldbank: {
    id: "worldbank",
    name: "World Bank World Development Indicators",
    homepage: "https://data.worldbank.org/indicator",
    verifier: "scripts/verify-worldbank.mjs",
    playable: true,
  },
  faostat: {
    id: "faostat",
    name: "FAOSTAT",
    homepage: "https://www.fao.org/faostat/en/",
    verifier: "scripts/verify-faostat.mjs",
    playable: true,
  },
  who: {
    id: "who",
    name: "WHO Global Health Observatory",
    homepage: "https://www.who.int/data/gho",
    verifier: "scripts/verify-distributed.mjs --source who",
    playable: true,
    note: "Official WHO series distributed through the World Bank WDI API",
  },
  unesco: {
    id: "unesco",
    name: "UNESCO Institute for Statistics",
    homepage: "https://databrowser.uis.unesco.org/",
    verifier: "scripts/verify-distributed.mjs --source unesco",
    playable: true,
    note: "Official UIS series distributed through the World Bank WDI API",
  },
  untourism: {
    id: "untourism",
    name: "UN Tourism",
    homepage: "https://www.unwto.org/tourism-data/un-tourism-tourism-dashboard",
    verifier: "scripts/verify-distributed.mjs --source untourism",
    playable: true,
    note: "Official UN Tourism series distributed through the World Bank WDI API",
  },
  naturalearth: {
    id: "naturalearth",
    name: "Natural Earth",
    homepage: "https://www.naturalearthdata.com/",
    verifier: "scripts/verify-natural-earth.mjs",
    playable: false,
    note: "Integrated as a source, but no physical-geography category is playable because timeless geometry cannot satisfy the 2022+ observation rule",
  },
};

export function categorySourceUrl(source: DataSourceId, indicator: string) {
  if (source === "worldbank") return `https://data.worldbank.org/indicator/${indicator}?name_desc=false`;
  if (source === "faostat") return "https://www.fao.org/faostat/en/#data/QCL";
  if (source === "who") return `https://data.worldbank.org/indicator/${indicator}?name_desc=false`;
  if (source === "unesco") return `https://data.worldbank.org/indicator/${indicator}?name_desc=false`;
  if (source === "untourism") return `https://data.worldbank.org/indicator/${indicator}?name_desc=false`;
  if (source === "naturalearth") return "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/";
  throw new Error(`Unsupported source: ${source satisfies never}`);
}
