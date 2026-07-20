import type { DataSourceId } from "./categories";

export type SourceDefinition = {
  id: DataSourceId;
  name: string;
  homepage: string;
  verifier: string;
  playable: boolean;
};

export const SOURCE_REGISTRY: Record<DataSourceId, SourceDefinition> = {
  worldbank: {
    id: "worldbank",
    name: "World Bank",
    homepage: "https://data.worldbank.org/indicator",
    verifier: "scripts/verify-seed.mjs",
    playable: true,
  },
};

export function categorySourceUrl(_source: DataSourceId, indicator: string) {
  return `https://data.worldbank.org/indicator/${indicator}?name_desc=false`;
}
