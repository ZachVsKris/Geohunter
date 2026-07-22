"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, type Category } from "../lib/categories";
import { fetchCountries, type CountryInfo } from "../lib/worldBank";
import { fetchCategory } from "../lib/dataSources";
import { SOURCE_REGISTRY } from "../lib/sourceRegistry";
import { canonicalizeDataset, formatValue, poolLeaderboard, scorePlacements, sourceUrl, validateRound, type CanonicalDataset } from "../lib/dataEngine";
import { CATEGORY_SET_VERSION, DATASET_VERSION, RULES_VERSION } from "../lib/version";

type RoundCategory = CanonicalDataset;
type Round = { bank: CountryInfo[]; categories: RoundCategory[] };
type Assignment = Record<string, string>;
type ScoreRow = {
  category: RoundCategory;
  country: CountryInfo;
  rank: number;
  globalRank: number;
  points: number;
  value: number;
  best: CountryInfo;
  bestValue: number;
  bestGlobalRank: number;
};
type GameMode = "daily" | "random";
type Rng = () => number;

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string): Rng {
  let value = hashSeed(seed);
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: Rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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

function encodeRound(round: Round) {
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

function decodeRound(value: string, countryList: CountryInfo[]): Round {
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

function roundCacheKey(seed: string) {
  return `geo-second-coming:${DATASET_VERSION}:${RULES_VERSION}:${CATEGORY_SET_VERSION}:${seed}`;
}

function rememberRound(seed: string, round: Round) {
  try {
    localStorage.setItem(roundCacheKey(seed), encodeRound(round));
  } catch {
    // The exact board remains in the URL even when private browsing blocks storage.
  }
}

function cachedRound(seed: string, countryList: CountryInfo[]) {
  try {
    const value = localStorage.getItem(roundCacheKey(seed));
    return value ? decodeRound(value, countryList) : null;
  } catch {
    return null;
  }
}

function dailySeed(date = new Date()) {
  return `DAILY-${date.toISOString().slice(0, 10)}`;
}

function randomSeed() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function isBetter(category: RoundCategory, a: number, b: number) {
  return category.category.direction === "high" ? a > b : a < b;
}


function shortCountryName(name: string) {
  const aliases: Record<string, string> = {
    "United Arab Emirates": "UAE",
    "United States": "USA",
    "United Kingdom": "UK",
    "Gambia, The": "Gambia",
    "Bahamas, The": "Bahamas",
    "Russian Federation": "Russia",
    "Venezuela, RB": "Venezuela",
    "Egypt, Arab Rep.": "Egypt",
    "Iran, Islamic Rep.": "Iran",
    "Yemen, Rep.": "Yemen",
    "Kyrgyz Republic": "Kyrgyzstan",
    "Slovak Republic": "Slovakia",
    "Korea, Rep.": "South Korea",
    "Korea, Dem. People's Rep.": "North Korea",
    "Congo, Dem. Rep.": "DR Congo",
    "Congo, Rep.": "Congo",
    "Lao PDR": "Laos",
    "West Bank and Gaza": "West Bank & Gaza",
    "Micronesia, Fed. Sts.": "Micronesia",
    "St. Vincent and the Grenadines": "St. Vincent",
    "Antigua and Barbuda": "Antigua",
    "Trinidad and Tobago": "Trinidad & Tobago",
    "Bosnia and Herzegovina": "Bosnia & Herz.",
    "Central African Republic": "Central African Rep.",
    "Dominican Republic": "Dominican Rep.",
    "Equatorial Guinea": "Eq. Guinea",
    "Papua New Guinea": "Papua N. Guinea",
    "São Tomé and Príncipe": "São Tomé",
  };
  return aliases[name] ?? name;
}

function ordinal(rank: number) {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  const suffix = rank % 10 === 1 ? "st" : rank % 10 === 2 ? "nd" : rank % 10 === 3 ? "rd" : "th";
  return `${rank}${suffix}`;
}

function observationValue(category: RoundCategory, countryId: string) {
  return category.byCountry.get(countryId)?.value;
}

function findDistinctWinners(
  categories: RoundCategory[],
  countryList: CountryInfo[],
  rng: Rng,
): { winners: string[]; decoys: string[] } | null {
  const countryIds = new Set(countryList.map((country) => country.id));
  const completeCountries = countryList.filter((country) =>
    categories.every((category) => observationValue(category, country.id) !== undefined),
  );
  const completeIds = new Set(completeCountries.map((country) => country.id));

  const candidates = categories.map((category) =>
    shuffle(
      category.ranked
        .slice(0, 100)
        .map((row) => row.countryId)
        .filter((id) => countryIds.has(id) && completeIds.has(id)),
      rng,
    ),
  );

  if (candidates.some((list) => list.length === 0)) return null;

  const order = categories
    .map((_, index) => index)
    .sort((a, b) => candidates[a].length - candidates[b].length);
  const winnerByCategory = new Array<string>(categories.length);
  const used = new Set<string>();
  let steps = 0;
  const maxSteps = 120000;

  function search(depth: number): boolean {
    if (++steps > maxSteps) return false;
    if (depth === order.length) return true;
    const categoryIndex = order[depth];
    const category = categories[categoryIndex];

    for (const candidateId of candidates[categoryIndex].slice(0, 70)) {
      if (used.has(candidateId)) continue;
      const candidateOwnValue = observationValue(category, candidateId);
      if (candidateOwnValue === undefined) continue;

      let valid = true;
      for (let previousDepth = 0; previousDepth < depth; previousDepth++) {
        const previousCategoryIndex = order[previousDepth];
        const previousCategory = categories[previousCategoryIndex];
        const previousWinnerId = winnerByCategory[previousCategoryIndex];
        const previousWinnerOnOwn = observationValue(previousCategory, previousWinnerId);
        const candidateOnPrevious = observationValue(previousCategory, candidateId);
        const previousWinnerOnCurrent = observationValue(category, previousWinnerId);

        if (
          previousWinnerOnOwn === undefined ||
          candidateOnPrevious === undefined ||
          previousWinnerOnCurrent === undefined ||
          !isBetter(previousCategory, previousWinnerOnOwn, candidateOnPrevious) ||
          !isBetter(category, candidateOwnValue, previousWinnerOnCurrent)
        ) {
          valid = false;
          break;
        }
      }

      if (!valid) continue;
      winnerByCategory[categoryIndex] = candidateId;
      used.add(candidateId);
      if (search(depth + 1)) return true;
      used.delete(candidateId);
      winnerByCategory[categoryIndex] = "";
    }
    return false;
  }

  if (!search(0)) return null;

  const decoyCandidates = shuffle(completeCountries, rng).filter((country) => {
    if (used.has(country.id)) return false;
    return categories.every((category, index) => {
      const winnerValue = observationValue(category, winnerByCategory[index]);
      const decoyValue = observationValue(category, country.id);
      return winnerValue !== undefined && decoyValue !== undefined && isBetter(category, winnerValue, decoyValue);
    });
  });

  if (decoyCandidates.length < 2) return null;
  return { winners: winnerByCategory, decoys: decoyCandidates.slice(0, 2).map((country) => country.id) };
}

async function loadCandidateDatasets(seed: string): Promise<RoundCategory[]> {
  const rng = seededRandom(`${seed}:datasets`);
  const shuffled = shuffle(CATEGORIES.filter((category) => category.enabled !== false), rng);
  const loaded: RoundCategory[] = [];
  const familyCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const batchSize = 8;

  // Keep the known-fast v9 behavior: load only a small deterministic candidate set,
  // but fetch each small batch concurrently so the larger library does not make
  // startup scale with the total number of category definitions.
  for (let offset = 0; offset < shuffled.length && loaded.length < 16; offset += batchSize) {
    const batch: Category[] = [];
    for (const category of shuffled.slice(offset, offset + batchSize * 2)) {
      if ((familyCounts.get(category.family) ?? 0) >= 3) continue;
      // FAOSTAT is the slowest endpoint; cap its candidate presence without
      // excluding it from play. Other official sources remain fully eligible.
      if (false) continue;
      batch.push(category);
      if (batch.length === batchSize) break;
    }
    if (!batch.length) continue;

    const results = await Promise.allSettled(batch.map(async (category) =>
      canonicalizeDataset(await fetchCategory(category))
    ));

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const dataset = result.value;
      if (dataset.ranked.length < dataset.category.coverageFloor) continue;
      loaded.push(dataset);
      familyCounts.set(dataset.category.family, (familyCounts.get(dataset.category.family) ?? 0) + 1);
      sourceCounts.set(dataset.category.source, (sourceCounts.get(dataset.category.source) ?? 0) + 1);
      if (loaded.length >= 16) break;
    }
  }

  return loaded;
}

async function buildRound(countryList: CountryInfo[], seed: string): Promise<Round> {
  const rng = seededRandom(seed);
  const available = await loadCandidateDatasets(seed);

  if (available.length < 8) throw new Error("Not enough official datasets were available to generate a round. Please try again.");

  for (let attempt = 0; attempt < 180; attempt++) {
    const categories: RoundCategory[] = [];
    const counts = new Map<string, number>();
    let faostatCount = 0;
    for (const category of shuffle(available, rng)) {
      if ((counts.get(category.category.family) ?? 0) >= 2) continue;
      if (false) continue;
      categories.push(category);
      counts.set(category.category.family, (counts.get(category.category.family) ?? 0) + 1);
      
      if (categories.length === 8) break;
    }
    if (categories.length < 8) continue;

    const solution = findDistinctWinners(categories, countryList, rng);
    if (!solution) continue;

    const byId = new Map(countryList.map((country) => [country.id, country]));
    const bank = shuffle(
      [...solution.winners, ...solution.decoys].map((id) => byId.get(id)!).filter(Boolean),
      rng,
    );
    if (bank.length === 10) {
      const errors = validateRound(categories, bank);
      if (errors.length === 0) return { bank, categories };
    }
  }

  throw new Error("This seed could not produce a balanced eight-winner round. Generate another random challenge.");
}

export default function GeoSecondComingGame() {
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [assignments, setAssignments] = useState<Assignment>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreRow[] | null>(null);
  const [status, setStatus] = useState("Loading official country data…");
  const [error, setError] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [seed, setSeed] = useState("");
  const [mode, setMode] = useState<GameMode>("random");
  const [copied, setCopied] = useState(false);
  const [openLeaderboard, setOpenLeaderboard] = useState<string | null>(null);
  const [touchDrag, setTouchDrag] = useState<{ countryId: string; x: number; y: number; targetCategoryId: string | null } | null>(null);
  const touchStart = useRef<{ countryId: string; x: number; y: number } | null>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const embeddedBoardRef = useRef<string | null>(null);

  const used = useMemo(() => new Set(Object.values(assignments)), [assignments]);

  function challengeUrl(nextSeed = seed, nextMode = mode, nextRound: Round | null = round) {
    const url = new URL(window.location.pathname, window.location.origin);
    if (nextMode === "daily") url.searchParams.set("mode", "daily");
    url.searchParams.set("seed", nextSeed);
    url.searchParams.set("data", DATASET_VERSION);
    url.searchParams.set("rules", RULES_VERSION);
    url.searchParams.set("cats", CATEGORY_SET_VERSION);
    if (nextRound) url.searchParams.set("board", encodeRound(nextRound));
    return url.toString();
  }

  function syncUrl(nextSeed: string, nextMode: GameMode, nextRound: Round | null = null) {
    window.history.replaceState({}, "", challengeUrl(nextSeed, nextMode, nextRound));
  }

  function resetRoundState(nextSeed: string, nextMode: GameMode) {
    setError("");
    setRound(null);
    setScores(null);
    setAssignments({});
    setSelected(null);
    setSelectedCategory(null);
    setCopied(false);
    setSeed(nextSeed);
    setMode(nextMode);
  }

  async function loadRound(nextSeed: string, nextMode: GameMode, existingCountries = countries) {
    embeddedBoardRef.current = null;
    resetRoundState(nextSeed, nextMode);
    syncUrl(nextSeed, nextMode, null);
    setStatus(nextMode === "daily" ? "Loading today’s shared challenge…" : "Building your seeded challenge…");
    try {
      const generated = await buildRound(existingCountries, nextSeed);
      setRound(generated);
      rememberRound(nextSeed, generated);
      syncUrl(nextSeed, nextMode, generated);
      setStatus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The round could not be generated.");
      setStatus("");
    }
  }

  function loadEmbeddedRound(nextSeed: string, nextMode: GameMode, packedBoard: string, existingCountries = countries) {
    embeddedBoardRef.current = packedBoard;
    resetRoundState(nextSeed, nextMode);
    setStatus("Opening the exact shared challenge…");
    try {
      const restored = decodeRound(packedBoard, existingCountries);
      setRound(restored);
      rememberRound(nextSeed, restored);
      syncUrl(nextSeed, nextMode, restored);
      setStatus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The shared challenge could not be opened.");
      setStatus("");
    }
  }

  function playRandom(existingCountries = countries) {
    return loadRound(randomSeed(), "random", existingCountries);
  }

  function playDaily(existingCountries = countries) {
    return loadRound(dailySeed(), "daily", existingCountries);
  }

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchCountries();
        setCountries(list);
        const params = new URLSearchParams(window.location.search);
        const nextMode: GameMode = params.get("mode") === "daily" ? "daily" : "random";
        const sharedSeed = params.get("seed")?.trim().toUpperCase();
        const nextSeed = sharedSeed || (nextMode === "daily" ? dailySeed() : randomSeed());
        const packedBoard = params.get("board");
        if (packedBoard) {
          loadEmbeddedRound(nextSeed, nextMode, packedBoard, list);
          return;
        }
        const restored = cachedRound(nextSeed, list);
        if (restored) {
          loadEmbeddedRound(nextSeed, nextMode, encodeRound(restored), list);
          return;
        }
        await loadRound(nextSeed, nextMode, list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Official data could not be loaded.");
        setStatus("");
      }
    })();
  }, []);

  function retryCurrentRound() {
    if (embeddedBoardRef.current) {
      loadEmbeddedRound(seed, mode, embeddedBoardRef.current);
      return;
    }
    if (mode === "daily") playDaily();
    else loadRound(seed || randomSeed(), "random");
  }

  async function copyChallenge() {
    const url = challengeUrl();

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("The challenge link could not be copied. Copy the URL from your browser instead.");
    }
  }

  async function shareScore() {
    if (!scores) return;
    const firsts = scores.filter((row) => row.rank === 1).length;
    const seconds = scores.filter((row) => row.rank === 2).length;
    const thirds = scores.filter((row) => row.rank === 3).length;
    const topFive = scores.filter((row) => row.rank <= 5).length;
    const text = `🌍 Geo: Second Coming
${total} / 800

🥇 ${firsts}   🥈 ${seconds}   🥉 ${thirds}
⭐ Top 5: ${topFive}/8

Can you beat my score?`;

    const url = challengeUrl();

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Geo: Second Coming",
          text,
          url,
        });
      } else {
        await navigator.clipboard.writeText(`${text}

${url}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setError("The score could not be shared automatically. Copy the challenge link from your browser instead.");
    }
  }


  function clearTouchTimer() {
    if (touchTimer.current) clearTimeout(touchTimer.current);
    touchTimer.current = null;
  }

  function categoryAtPoint(x: number, y: number) {
    const element = document.elementFromPoint(x, y) as HTMLElement | null;
    return element?.closest<HTMLElement>("[data-category-id]")?.dataset.categoryId ?? null;
  }

  function beginTouch(event: React.TouchEvent, countryId: string) {
    if (used.has(countryId)) return;
    const touch = event.touches[0];
    touchStart.current = { countryId, x: touch.clientX, y: touch.clientY };
    clearTouchTimer();
    touchTimer.current = setTimeout(() => {
      setTouchDrag({ countryId, x: touch.clientX, y: touch.clientY, targetCategoryId: categoryAtPoint(touch.clientX, touch.clientY) });
      if (navigator.vibrate) navigator.vibrate(18);
    }, 120);
  }

  function moveTouch(event: React.TouchEvent) {
    const touch = event.touches[0];
    if (!touchDrag) {
      const start = touchStart.current;
      if (start && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10) clearTouchTimer();
      return;
    }
    event.preventDefault();
    setTouchDrag((current) => current ? { ...current, x: touch.clientX, y: touch.clientY, targetCategoryId: categoryAtPoint(touch.clientX, touch.clientY) } : null);
  }

  function endTouch() {
    clearTouchTimer();
    if (touchDrag?.targetCategoryId) assignCountry(touchDrag.targetCategoryId, touchDrag.countryId);
    setTouchDrag(null);
    touchStart.current = null;
  }

  function assignCountry(categoryId: string, countryId: string) {
    setAssignments((current) => {
      const next = { ...current };
      for (const key of Object.keys(next)) if (next[key] === countryId) delete next[key];
      next[categoryId] = countryId;
      return next;
    });
    setSelected(null);
    setSelectedCategory(null);
  }

  function selectCountry(countryId: string) {
    if (selectedCategory) {
      assignCountry(selectedCategory, countryId);
      return;
    }
    setSelected((current) => current === countryId ? null : countryId);
  }

  function selectCategory(categoryId: string) {
    if (selected) {
      assignCountry(categoryId, selected);
      return;
    }
    setSelectedCategory((current) => current === categoryId ? null : categoryId);
  }

  function score() {
    if (!round || Object.keys(assignments).length !== 8) return;
    try {
      const rows: ScoreRow[] = scorePlacements(round.categories, round.bank, assignments).map(({ dataset, selected, best }) => ({
        category: dataset,
        country: selected.country,
        rank: selected.poolRank,
        globalRank: selected.observation.globalRank,
        points: selected.points,
        value: selected.observation.value,
        best: best.country,
        bestValue: best.observation.value,
        bestGlobalRank: best.observation.globalRank,
      }));
      setScores(rows.sort((a, b) => b.points - a.points));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The round could not be scored consistently.");
    }
  }

  const total = scores?.reduce((sum, row) => sum + row.points, 0) ?? 0;
  const averagePlacement = scores?.length
    ? (scores.reduce((sum, row) => sum + row.rank, 0) / scores.length).toFixed(1)
    : "0.0";
  const bestPossibleCount = scores?.filter((row) => row.rank === 1).length ?? 0;
  const topFiveCount = scores?.filter((row) => row.rank <= 5).length ?? 0;

  return <div className={`shell ${round && !scores ? "activePlay" : ""} ${scores ? "resultsView" : ""}`}>
    {!scores && <header>
      <div className="brand"><span className="logo">🌍</span><div><h1>Geo: Second Coming</h1><p>Geography, with strategy.</p><small>Data {DATASET_VERSION} · Rules {RULES_VERSION}</small></div></div>
      <div className="headerButtons"><a href="/audit" className="headerLink">Data audit</a><button onClick={() => setShowRules(true)}>How it works</button><button onClick={() => playDaily()} disabled={!countries.length}>Daily</button><button onClick={() => playRandom()} disabled={!countries.length}>Random</button></div>
    </header>}

    <section className="challengeBar">
      <div><span className="kicker">{mode === "daily" ? "Daily challenge" : "Seeded challenge"}</span><strong>{mode === "daily" ? seed.replace("DAILY-", "") : seed}</strong></div>
      <div className="challengeActions"><span className="mobileProgress">{Object.keys(assignments).length}/8 assigned</span>{scores && <button className="resultsRulesLink" onClick={() => setShowRules(true)}>Rules</button>}<button onClick={copyChallenge} disabled={!round}>{copied ? "Copied ✓" : "Copy link"}</button></div>
    </section>

    {!scores && <section className="hero">
      <div><span className="kicker">A strategy atlas</span><h2>Ten countries. Eight measures. One perfect allocation.</h2><p>Place eight countries, leave two behind, and make every specialist count. Each challenge link preserves the exact same board and values for everyone.</p></div>
      <aside><strong>{Object.keys(assignments).length}/8</strong><span>categories assigned</span></aside>
    </section>}

    {status && <div className="loading"><div className="spinner"/><strong>{status}</strong><span>Official datasets can take a few seconds to load the first time.</span></div>}
    {error && <div className="error"><strong>Couldn’t generate this round.</strong><span>{error}</span><button onClick={retryCurrentRound}>Try again</button></div>}

    {round && !scores && <main className="grid playGrid">
      <section className="panel bankPanel"><div className="panelTitle"><div><span className="kicker">Country bank</span><h3>Choose your 8</h3></div><small>Two will remain unused</small></div>
        <div className="countries">{round.bank.map((country) => <button key={country.id} draggable={!used.has(country.id)} onDragStart={(event)=>event.dataTransfer.setData("text/plain", country.id)} onTouchStart={(event)=>beginTouch(event,country.id)} onTouchMove={moveTouch} onTouchEnd={endTouch} onTouchCancel={endTouch} className={`country ${selected===country.id?"selected":""} ${selectedCategory&&!used.has(country.id)?"categoryTarget":""} ${used.has(country.id)?"used":""}`} disabled={used.has(country.id)} onClick={() => selectCountry(country.id)}><span>{country.flag}</span><div><strong title={country.name}><span className="desktopCountryName">{country.name}</span><span className="mobileCountryName">{shortCountryName(country.name)}</span></strong></div>{used.has(country.id)&&<b>USED</b>}</button>)}</div>
      </section>
      <section className="panel boardPanel"><div className="panelTitle"><div><span className="kicker">The atlas</span><h3>Match countries to measures</h3></div><small>One use per country</small></div>
        <div className="slots">{round.categories.map((dataset, index) => { const c = round.bank.find((x)=>x.id===assignments[dataset.category.id]); return <button key={dataset.category.id} data-category-id={dataset.category.id} className={`slot theme-${dataset.category.family.toLowerCase().replace(/[^a-z0-9]+/g,"-")} ${selected&&!c?"target":""} ${selectedCategory===dataset.category.id?"selectedCategory":""} ${touchDrag?.targetCategoryId===dataset.category.id?"touchTarget":""}`} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();const dropped=event.dataTransfer.getData("text/plain");if(dropped)assignCountry(dataset.category.id,dropped)}} onClick={()=>selectCategory(dataset.category.id)}><div className="category"><span>{dataset.category.icon}</span><div><strong>{dataset.category.name}</strong><small>{dataset.category.description}</small></div><b className="slotNumber">{String(index + 1).padStart(2, "0")}</b></div><div className="choice">{c?<><span>{c.flag}</span><strong>{c.name}</strong><i onClick={(e)=>{e.stopPropagation();setAssignments((a)=>{const n={...a};delete n[dataset.category.id];return n;});setSelectedCategory(null);}}>×</i></>:<em>{selected?"Place selected country":selectedCategory===dataset.category.id?"Now choose a country":"Select a country"}</em>}</div></button>})}</div>
        <div className="lock"><span>{8-Object.keys(assignments).length>0?`${8-Object.keys(assignments).length} selections remaining`:"Draft complete"}</span><button disabled={Object.keys(assignments).length!==8} onClick={score}>Lock in draft</button></div>
      </section>
    </main>}

    {round && scores && <section className="panel results"><div className="score"><span>Final score</span><div className="scoreValue"><strong>{total}</strong><b>/ 800</b></div><div className="scoreInsights"><div><strong>{averagePlacement}</strong><span>Average placement</span></div><div><strong>{bestPossibleCount}</strong><span>Best possible</span></div><div><strong>{topFiveCount}/8</strong><span>Top five</span></div></div><div className="scoreBreakdown">{[1,2,3].map((rank)=><span key={rank}>{rank===1?"🥇":rank===2?"🥈":"🥉"} {scores.filter((row)=>row.rank===rank).length}</span>)}</div><p>{total>=650?"Elite allocation.":total>=520?"Strong draft with room to optimize.":"A few specialists were spent in the wrong places."}</p><button className="shareScore" onClick={shareScore}>{copied ? "Score copied ✓" : "Share score"}</button></div>
      <div className="resultsHeading"><div><span className="kicker">Your placements</span><h3>Placement and points earned</h3></div><small>Open a ranking to compare all ten countries</small></div>
      {scores.map((row)=>{ const leaderboard=poolLeaderboard(row.category,round.bank); return <div className={`resultWrap theme-${row.category.category.family.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`} key={row.category.category.id}><div className="result"><div className="resultMain"><span>{row.category.category.icon}</span><div><strong>{row.category.category.name}</strong><small className="statTip" tabIndex={0}>{row.country.flag} {row.country.name} · {formatValue(row.value,row.category.category)} · {row.category.byCountry.get(row.country.id)?.year}<span className="tooltip">{SOURCE_REGISTRY[row.category.category.source].name} list: #{row.globalRank} globally<br/>Actual value: {formatValue(row.value,row.category.category)}<br/>Indicator: {row.category.category.indicator}<br/><a href={row.category.sourceUrl} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()}>Open official source ↗</a></span></small></div></div><div className="placementSummary"><b>{ordinal(row.rank)} of 10</b><strong>{row.points} pts earned</strong>{row.rank===1&&<span>Best possible</span>}</div><button className="leaderboardButton" onClick={()=>setOpenLeaderboard(openLeaderboard===row.category.category.id?null:row.category.category.id)} aria-expanded={openLeaderboard===row.category.category.id}>{openLeaderboard===row.category.category.id?"Hide rankings":"View rankings"}</button></div>{openLeaderboard===row.category.category.id&&<div className="leaderboard"><div className="leaderboardHeader"><div className="leaderboardTitle"><h4>{row.category.category.name}</h4><span>All ten countries</span></div><div className="leaderboardSource"><span className="sourceBadge">{row.category.category.source === "worldbank" ? "World Bank" : SOURCE_REGISTRY[row.category.category.source].name}</span><a href={row.category.sourceUrl} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()}>Official source ↗</a></div></div>{leaderboard.map(item=><div key={item.country.id} className={item.country.id===row.country.id?"current":""}><b>#{item.poolRank}</b><span>{item.country.flag} {item.country.name}</span><span>{formatValue(item.observation.value,row.category.category)}</span><small>{item.observation.year}</small><strong>{item.points} pts</strong></div>)}</div>}</div>})}
      <div className="perfect"><div className="resultsHeading"><div><span className="kicker">🏆 Perfect Round</span><h3>The optimal allocation</h3></div><small>Each category’s best country among these ten</small></div>
      <div className="perfectGrid">{scores.map((row)=><div className="perfectRow" key={`perfect-${row.category.category.id}`}><span>{row.category.category.icon}</span><div><strong>{row.category.category.name}</strong><small className="statTip" tabIndex={0}>{row.best.flag} {row.best.name} · {formatValue(row.bestValue,row.category.category)}<span className="tooltip">{SOURCE_REGISTRY[row.category.category.source].name} list: #{row.bestGlobalRank} globally<br/>Actual value: {formatValue(row.bestValue,row.category.category)}<br/><a href={row.category.sourceUrl} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()}>Open official source ↗</a></span></small></div><b>100 pts</b></div>)}</div></div>
      <div className="lock"><span>Maximum score: 800</span><div className="resultActions"><button onClick={()=>playDaily()}>Daily challenge</button><button onClick={()=>playRandom()}>New random round</button></div></div></section>}

    {touchDrag && round && <div className="touchGhost" style={{ left: touchDrag.x, top: touchDrag.y }}><span>{round.bank.find((country)=>country.id===touchDrag.countryId)?.flag}</span><strong>{round.bank.find((country)=>country.id===touchDrag.countryId)?.name}</strong></div>}

    {!scores && <section className="dataNote"><strong>Atlas index · {CATEGORIES.length} official categories</strong><p><a href="/data">Data & methodology</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p><p>Population, economy, land, rainfall, agriculture, forests, energy, health, education, labor, transport, technology, and environment. Food-specific categories such as cheese, bread, meat, livestock, and wildfire statistics require separate FAO and satellite datasets and are reserved for the next data expansion so their definitions remain accurate.</p></section>}

    {showRules&&<div className="modal" onClick={(e)=>e.currentTarget===e.target&&setShowRules(false)}><div><h2>How Geo: Second Coming works</h2><ol><li>Drag eight of the ten countries into the eight category slots. Leave two countries unused.</li><li>Eight different countries are each the highest-ranking country for one distinct category among the ten countries in the bank. They are not necessarily ranked first in the world.</li><li>Each country can be used once. Anyone opening the same challenge link receives the same board.</li></ol><p>Results show the underlying World Bank indicator, data year, global rank, and official source. The daily challenge changes at midnight UTC.</p><button onClick={()=>setShowRules(false)}>Start drafting</button></div></div>}
  </div>;
}
