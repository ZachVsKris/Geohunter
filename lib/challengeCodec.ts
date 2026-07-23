import { CATEGORIES } from "./categories";
import { sourceUrl, validateRound, type CanonicalDataset } from "./dataEngine";
import type { CountryInfo } from "./worldBank";

export type RoundCategory = CanonicalDataset;
export type Round = { bank: CountryInfo[]; categories: RoundCategory[] };

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function checksum(bytes: Uint8Array, end = bytes.length) {
  let hash = 2166136261;
  for (let index = 0; index < end; index++) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function encodeRound(round: Round) {
  const categoryIds = round.categories.map((dataset) => dataset.category.id);
  const categoryByteLength = categoryIds.reduce((sum, id) => sum + 1 + id.length, 0);
  const observationByteLength = 8 * 10 * (8 + 1 + 1);
  const bytes = new Uint8Array(1 + categoryByteLength + 10 * 3 + observationByteLength + 4);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  view.setUint8(offset++, 2);

  for (const categoryId of categoryIds) {
    if (!/^[\x20-\x7E]+$/.test(categoryId) || categoryId.length > 255) {
      throw new Error("A category ID could not be encoded into the challenge link.");
    }
    view.setUint8(offset++, categoryId.length);
    for (const character of categoryId) view.setUint8(offset++, character.charCodeAt(0));
  }

  for (const country of round.bank) {
    if (!/^[A-Z0-9]{3}$/.test(country.id)) throw new Error(`${country.name} has an invalid country code.`);
    for (const character of country.id) view.setUint8(offset++, character.charCodeAt(0));
  }

  for (const dataset of round.categories) {
    for (const country of round.bank) {
      const observation = dataset.byCountry.get(country.id);
      if (!observation) throw new Error(`Missing ${country.name} data for ${dataset.category.name}.`);
      const year = Number(observation.year);
      if (!Number.isFinite(observation.value) || !Number.isInteger(year) || year < 2000 || year > 2255) {
        throw new Error(`${dataset.category.name} contains data that cannot be encoded.`);
      }
      if (!Number.isInteger(observation.globalRank) || observation.globalRank < 1 || observation.globalRank > 255) {
        throw new Error(`${dataset.category.name} contains a global rank that cannot be encoded.`);
      }
      view.setFloat64(offset, observation.value, false);
      offset += 8;
      view.setUint8(offset++, year - 2000);
      view.setUint8(offset++, observation.globalRank);
    }
  }

  view.setUint32(offset, checksum(bytes, offset), false);
  return bytesToBase64Url(bytes);
}

export function decodeRound(value: string, countryList: CountryInfo[]): Round {
  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(value);
  } catch {
    throw new Error("This challenge link is incomplete or damaged.");
  }

  const minimumLength = 1 + 8 * 2 + 10 * 3 + 8 * 10 * 10 + 4;
  if (bytes.length < minimumLength) throw new Error("This challenge link does not contain a complete board.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const expectedChecksum = view.getUint32(bytes.length - 4, false);
  if (checksum(bytes, bytes.length - 4) !== expectedChecksum) {
    throw new Error("This challenge link was truncated or changed while being copied.");
  }

  let offset = 0;
  if (view.getUint8(offset++) !== 2) throw new Error("This challenge link uses an unsupported board format.");
  const categoryIds: string[] = [];
  for (let categoryIndex = 0; categoryIndex < 8; categoryIndex++) {
    const length = view.getUint8(offset++);
    if (!length || offset + length > bytes.length - 4) throw new Error("This challenge contains an incomplete category list.");
    let categoryId = "";
    for (let index = 0; index < length; index++) categoryId += String.fromCharCode(view.getUint8(offset++));
    categoryIds.push(categoryId);
  }
  if (new Set(categoryIds).size !== 8) throw new Error("This challenge repeats a category.");

  const countryIds: string[] = [];
  for (let countryIndex = 0; countryIndex < 10; countryIndex++) {
    let countryId = "";
    for (let index = 0; index < 3; index++) countryId += String.fromCharCode(view.getUint8(offset++));
    countryIds.push(countryId);
  }
  if (new Set(countryIds).size !== 10) throw new Error("This challenge repeats a country.");
  if (offset + 8 * 10 * 10 !== bytes.length - 4) throw new Error("This challenge contains an unexpected amount of board data.");

  const categoryById = new Map(CATEGORIES.map((category) => [category.id, category]));
  const countryById = new Map(countryList.map((country) => [country.id, country]));
  const bank = countryIds.map((id) => countryById.get(id));
  if (bank.some((country) => !country)) throw new Error("This challenge includes a country that is no longer available.");
  const exactBank = bank.filter((country): country is CountryInfo => Boolean(country));

  const categories = categoryIds.map((categoryId): RoundCategory => {
    const category = categoryById.get(categoryId);
    if (!category) throw new Error("This challenge includes a category that is no longer available.");
    const ranked = exactBank.map((country) => {
      const value = view.getFloat64(offset, false);
      offset += 8;
      const year = 2000 + view.getUint8(offset++);
      const globalRank = view.getUint8(offset++);
      if (!Number.isFinite(value) || globalRank < 1) throw new Error("This challenge contains invalid ranking data.");
      return {
        countryId: country.id,
        countryName: country.name,
        value,
        year: String(year),
        globalRank,
      };
    }).sort((a, b) => category.direction === "high" ? b.value - a.value : a.value - b.value);

    return {
      category,
      observations: ranked.map(({ globalRank: _globalRank, ...observation }) => observation),
      year: ranked.map((row) => row.year).sort().reverse()[0] ?? "",
      ranked,
      byCountry: new Map(ranked.map((row) => [row.countryId, row])),
      sourceUrl: sourceUrl(category.indicator, category.source),
    };
  });

  const errors = validateRound(categories, exactBank);
  if (errors.length) throw new Error(`This challenge link is inconsistent: ${errors[0]}`);
  return { bank: exactBank, categories };
}

