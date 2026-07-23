"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, type Category } from "../lib/categories";
import { fetchCountries, type CountryInfo } from "../lib/worldBank";
import { fetchCategory } from "../lib/dataSources";
import { SOURCE_REGISTRY } from "../lib/sourceRegistry";
import { canonicalizeDataset, formatValue, poolLeaderboard, scorePlacements, sourceUrl, validateRound, type CanonicalDataset } from "../lib/dataEngine";
import { CATEGORY_SET_VERSION, DATASET_VERSION, RULES_VERSION } from "../lib/version";
import { decodeRound, encodeRound, type Round, type RoundCategory } from "../lib/challengeCodec";
import AccountControls from "./AccountControls";
import { newYorkDate } from "../lib/time";
import { DEFAULT_DIFFICULTY, ROUND_CONFIGS, type DailyDifficulty, type RoundConfig, canAddCategory, measureKind, roundHasRequiredDiversity, roundType } from "../lib/gameRules";

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
export type GameMode = "daily" | "random";
type GeoSecondComingGameProps = {
  initialMode?: GameMode;
  initialDifficulty?: DailyDifficulty;
};
type DailyPair = Record<DailyDifficulty, Round>;
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

function dailySeed(difficulty: DailyDifficulty, date = new Date()) {
  return `DAILY-${difficulty.toUpperCase()}-${newYorkDate(date)}`;
}

function dailyDateFromSeed(value: string) {
  const match = value.match(/(\d{4}-\d{2}-\d{2})$/);
  return match?.[1] ?? newYorkDate();
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
    "United Arab Emirates": "UAE", "United States": "USA", "United Kingdom": "UK",
    "Gambia, The": "Gambia", "Bahamas, The": "Bahamas", "Russian Federation": "Russia",
    "Venezuela, RB": "Venezuela", "Egypt, Arab Rep.": "Egypt", "Iran, Islamic Rep.": "Iran",
    "Yemen, Rep.": "Yemen", "Kyrgyz Republic": "Kyrgyzstan", "Slovak Republic": "Slovakia",
    "Korea, Rep.": "South Korea", "Korea, Dem. People's Rep.": "North Korea",
    "Congo, Dem. Rep.": "DR Congo", "Congo, Rep.": "Congo", "Lao PDR": "Laos",
    "West Bank and Gaza": "West Bank & Gaza", "Micronesia, Fed. Sts.": "Micronesia",
    "St. Vincent and the Grenadines": "St. Vincent", "Antigua and Barbuda": "Antigua",
    "Trinidad and Tobago": "Trinidad & Tobago", "Bosnia and Herzegovina": "Bosnia & Herz.",
    "Central African Republic": "Central African Rep.", "Dominican Republic": "Dominican Rep.",
    "Equatorial Guinea": "Eq. Guinea", "Papua New Guinea": "Papua N. Guinea",
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
  config: RoundConfig,
  overlapBank?: Set<string>,
  maxOverlap = Number.POSITIVE_INFINITY,
): { winners: string[]; decoys: string[] } | null {
  const countryIds = new Set(countryList.map((country) => country.id));
  const completeCountries = countryList.filter((country) =>
    categories.every((category) => observationValue(category, country.id) !== undefined),
  );
  const completeIds = new Set(completeCountries.map((country) => country.id));

  const candidates = categories.map((category) =>
    shuffle(
      category.ranked.slice(0, 100).map((row) => row.countryId)
        .filter((id) => countryIds.has(id) && completeIds.has(id)),
      rng,
    ),
  );
  if (candidates.some((list) => list.length === 0)) return null;

  const order = categories.map((_, index) => index).sort((a, b) => candidates[a].length - candidates[b].length);
  const winnerByCategory = new Array<string>(categories.length);
  const used = new Set<string>();
  let steps = 0;

  function overlapCount() {
    if (!overlapBank) return 0;
    let count = 0;
    for (const id of used) if (overlapBank.has(id)) count++;
    return count;
  }

  function search(depth: number): boolean {
    if (++steps > 160000) return false;
    if (depth === order.length) return true;
    const categoryIndex = order[depth];
    const category = categories[categoryIndex];
    for (const candidateId of candidates[categoryIndex].slice(0, 75)) {
      if (used.has(candidateId)) continue;
      if (overlapBank?.has(candidateId) && overlapCount() >= maxOverlap) continue;
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
        if (previousWinnerOnOwn === undefined || candidateOnPrevious === undefined || previousWinnerOnCurrent === undefined ||
            !isBetter(previousCategory, previousWinnerOnOwn, candidateOnPrevious) ||
            !isBetter(category, candidateOwnValue, previousWinnerOnCurrent)) {
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

  const decoyCandidates = shuffle(completeCountries, rng)
    .filter((country) => {
      if (used.has(country.id)) return false;
      return categories.every((category, index) => {
        const winnerValue = observationValue(category, winnerByCategory[index]);
        const decoyValue = observationValue(category, country.id);
        return winnerValue !== undefined && decoyValue !== undefined && isBetter(category, winnerValue, decoyValue);
      });
    })
    .sort((a, b) => Number(Boolean(overlapBank?.has(a.id))) - Number(Boolean(overlapBank?.has(b.id))));

  const decoys: string[] = [];
  let currentOverlap = overlapCount();
  for (const country of decoyCandidates) {
    const addsOverlap = Boolean(overlapBank?.has(country.id));
    if (addsOverlap && currentOverlap >= maxOverlap) continue;
    decoys.push(country.id);
    if (addsOverlap) currentOverlap++;
    if (decoys.length === config.decoyCount) break;
  }
  if (decoys.length < config.decoyCount) return null;
  return { winners: winnerByCategory, decoys };
}

async function loadCandidateDatasets(seed: string, targetCount = 20): Promise<RoundCategory[]> {
  const rng = seededRandom(`${seed}:datasets`);
  const shuffled = shuffle(CATEGORIES.filter((category) => category.enabled !== false), rng);
  const loaded: RoundCategory[] = [];
  const loadedIds = new Set<string>();
  const typeCounts = new Map<string, number>();
  const batchSize = 8;

  for (let offset = 0; offset < shuffled.length && loaded.length < targetCount; offset += batchSize) {
    const batch: Category[] = [];
    const pendingTypeCounts = new Map(typeCounts);
    for (const category of shuffled.slice(offset, offset + batchSize * 4)) {
      const type = roundType(category);
      if (loadedIds.has(category.id) || batch.some((item) => item.id === category.id)) continue;
      if ((pendingTypeCounts.get(type) ?? 0) >= 4) continue;
      batch.push(category);
      pendingTypeCounts.set(type, (pendingTypeCounts.get(type) ?? 0) + 1);
      if (batch.length === batchSize) break;
    }
    if (!batch.length) continue;
    const results = await Promise.allSettled(batch.map(async (category) => canonicalizeDataset(await fetchCategory(category))));
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const dataset = result.value;
      if (dataset.ranked.length < dataset.category.coverageFloor) continue;
      const type = roundType(dataset.category);
      if ((typeCounts.get(type) ?? 0) >= 4) continue;
      loaded.push(dataset);
      loadedIds.add(dataset.category.id);
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
      if (loaded.length >= targetCount) break;
    }
  }
  return loaded;
}

function chooseDiverseCategories(
  available: RoundCategory[],
  rng: Rng,
  config: RoundConfig,
  forbiddenIds = new Set<string>(),
) {
  const ordered = shuffle(available.filter((dataset) => !forbiddenIds.has(dataset.category.id)), rng);
  const selected: RoundCategory[] = [];
  while (selected.length < config.categoryCount) {
    const options = ordered.filter((dataset) =>
      !selected.includes(dataset) && canAddCategory(selected.map((item) => item.category), dataset.category),
    );
    if (!options.length) return null;
    const selectedTypes = new Set(selected.map((item) => roundType(item.category)));
    const selectedMeasures = new Set(selected.map((item) => measureKind(item.category)));
    const scored = options.map((dataset) => ({
      dataset,
      score: (selectedTypes.has(roundType(dataset.category)) ? 0 : 12) +
        (selectedMeasures.has(measureKind(dataset.category)) ? 0 : 3) + rng(),
    })).sort((a, b) => b.score - a.score);
    selected.push(scored[0].dataset);
  }
  return roundHasRequiredDiversity(selected.map((dataset) => dataset.category), config) ? selected : null;
}

function composeRound(
  available: RoundCategory[],
  countryList: CountryInfo[],
  seed: string,
  config: RoundConfig,
  forbiddenIds = new Set<string>(),
  overlapBank?: Set<string>,
  maxOverlap = Number.POSITIVE_INFINITY,
): Round | null {
  const rng = seededRandom(seed);
  const attempted = new Set<string>();
  for (let attempt = 0; attempt < 320; attempt++) {
    const categories = chooseDiverseCategories(available, rng, config, forbiddenIds);
    if (!categories) continue;
    const signature = categories.map((dataset) => dataset.category.id).sort().join("|");
    if (attempted.has(signature)) continue;
    attempted.add(signature);
    const solution = findDistinctWinners(categories, countryList, rng, config, overlapBank, maxOverlap);
    if (!solution) continue;
    const byId = new Map(countryList.map((country) => [country.id, country]));
    const bank = shuffle([...solution.winners, ...solution.decoys].map((id) => byId.get(id)!).filter(Boolean), rng);
    if (bank.length !== config.countryCount) continue;
    if (validateRound(categories, bank).length === 0) return { bank, categories };
  }
  return null;
}

async function buildRound(countryList: CountryInfo[], seed: string): Promise<Round> {
  const config = ROUND_CONFIGS.easy;
  const available = await loadCandidateDatasets(seed, 20);
  const round = composeRound(available, countryList, seed, config);
  if (round) return round;
  throw new Error("This seed could not produce a balanced Normal round. Generate another random challenge.");
}

async function buildDailyPair(
  countryList: CountryInfo[],
  date: string,
  fixed: Partial<DailyPair> = {},
): Promise<DailyPair> {
  const pairSeed = `DAILY-PAIR-${date}`;
  const available = await loadCandidateDatasets(pairSeed, 38);
  if (available.length < ROUND_CONFIGS.expert.categoryCount) {
    throw new Error("Not enough official datasets were available to build both Daily boards.");
  }

  for (let attempt = 0; attempt < 48; attempt++) {
    let easy = fixed.easy ?? null;
    let expert = fixed.expert ?? null;

    if (!easy && expert) {
      const expertCategoryIds = new Set(expert.categories.map((dataset) => dataset.category.id));
      const expertCountries = new Set(expert.bank.map((country) => country.id));
      easy = composeRound(available, countryList, `${pairSeed}:easy:${attempt}`, ROUND_CONFIGS.easy, expertCategoryIds, expertCountries, 2);
    } else if (!easy) {
      easy = composeRound(available, countryList, `${pairSeed}:easy:${attempt}`, ROUND_CONFIGS.easy);
    }
    if (!easy) continue;

    if (!expert) {
      const easyCategoryIds = new Set(easy.categories.map((dataset) => dataset.category.id));
      const easyCountries = new Set(easy.bank.map((country) => country.id));
      expert = composeRound(available, countryList, `${pairSeed}:expert:${attempt}`, ROUND_CONFIGS.expert, easyCategoryIds, easyCountries, 2);
    }
    if (!expert) continue;

    const easyCategoryIds = new Set(easy.categories.map((dataset) => dataset.category.id));
    const easyCountries = new Set(easy.bank.map((country) => country.id));
    const categoryOverlap = expert.categories.filter((dataset) => easyCategoryIds.has(dataset.category.id));
    const countryOverlap = expert.bank.filter((country) => easyCountries.has(country.id));
    if (categoryOverlap.length === 0 && countryOverlap.length <= 2) return { easy, expert };
  }
  throw new Error("Today’s Normal and Expert boards could not be paired with enough variety. Please try again.");
}

export default function GeoSecondComingGame({ initialMode = "random", initialDifficulty = DEFAULT_DIFFICULTY }: GeoSecondComingGameProps = {}) {
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
  const [mode, setMode] = useState<GameMode>(initialMode);
  const [difficulty, setDifficulty] = useState<DailyDifficulty>(initialDifficulty);
  const [copied, setCopied] = useState(false);
  const [openLeaderboard, setOpenLeaderboard] = useState<string | null>(null);
  const [touchDrag, setTouchDrag] = useState<{ countryId: string; x: number; y: number; targetCategoryId: string | null } | null>(null);
  const touchStart = useRef<{ countryId: string; x: number; y: number } | null>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const embeddedBoardRef = useRef<string | null>(null);

  const used = useMemo(() => new Set(Object.values(assignments)), [assignments]);
  const activeDifficulty: DailyDifficulty = mode === "daily" ? difficulty : DEFAULT_DIFFICULTY;
  const activeConfig = ROUND_CONFIGS[activeDifficulty];
  const categoryTarget = round?.categories.length ?? activeConfig.categoryCount;
  const poolSize = round?.bank.length ?? activeConfig.countryCount;
  const roundMaxScore = round?.categories.length === ROUND_CONFIGS.expert.categoryCount && round.bank.length === ROUND_CONFIGS.expert.countryCount
    ? ROUND_CONFIGS.expert.maxScore
    : ROUND_CONFIGS.easy.maxScore;
  const topFinishRank = poolSize === ROUND_CONFIGS.expert.countryCount
    ? ROUND_CONFIGS.expert.topFinishRank
    : ROUND_CONFIGS.easy.topFinishRank;

  function challengeUrl(nextSeed = seed, nextMode = mode, nextRound: Round | null = round, nextDifficulty = difficulty) {
    if (nextMode === "daily") {
      const path = nextDifficulty === "expert" ? "/daily/expert" : "/daily";
      return new URL(path, window.location.origin).toString();
    }
    const url = new URL("/random", window.location.origin);
    url.searchParams.set("seed", nextSeed);
    url.searchParams.set("data", DATASET_VERSION);
    url.searchParams.set("rules", RULES_VERSION);
    url.searchParams.set("cats", CATEGORY_SET_VERSION);
    if (nextRound) url.searchParams.set("board", encodeRound(nextRound));
    return url.toString();
  }

  function syncUrl(nextSeed: string, nextMode: GameMode, nextRound: Round | null = null, nextDifficulty = difficulty) {
    window.history.replaceState({}, "", challengeUrl(nextSeed, nextMode, nextRound, nextDifficulty));
  }

  function resetRoundState(nextSeed: string, nextMode: GameMode, nextDifficulty: DailyDifficulty) {
    setError("");
    setRound(null);
    setScores(null);
    setAssignments({});
    setSelected(null);
    setSelectedCategory(null);
    setCopied(false);
    setSeed(nextSeed);
    setMode(nextMode);
    setDifficulty(nextDifficulty);
  }

  async function loadRandomRound(nextSeed: string, existingCountries = countries) {
    embeddedBoardRef.current = null;
    resetRoundState(nextSeed, "random", DEFAULT_DIFFICULTY);
    syncUrl(nextSeed, "random", null, DEFAULT_DIFFICULTY);
    setStatus("Building your seeded challenge…");
    try {
      const generated = await buildRound(existingCountries, nextSeed);
      setRound(generated);
      rememberRound(nextSeed, generated);
      syncUrl(nextSeed, "random", generated, DEFAULT_DIFFICULTY);
      setStatus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The round could not be generated.");
      setStatus("");
    }
  }

  async function loadDailyRound(nextDifficulty: DailyDifficulty, existingCountries = countries) {
    const date = newYorkDate();
    const nextSeed = dailySeed(nextDifficulty);
    embeddedBoardRef.current = null;
    resetRoundState(nextSeed, "daily", nextDifficulty);
    syncUrl(nextSeed, "daily", null, nextDifficulty);
    setStatus(`Loading today’s ${ROUND_CONFIGS[nextDifficulty].label} Daily…`);
    try {
      let fixed: Partial<DailyPair> = {};
      try {
        const response = await fetch(`/api/daily-pair/${date}`);
        const saved = await response.json().catch(() => ({}));
        for (const candidate of ["easy", "expert"] as const) {
          const packed = saved?.[candidate]?.encoded_board;
          if (packed) fixed[candidate] = decodeRound(packed, existingCountries);
        }
        const restored = fixed[nextDifficulty];
        if (restored) {
          setRound(restored);
          rememberRound(nextSeed, restored);
          syncUrl(nextSeed, "daily", restored, nextDifficulty);
          setStatus("");
          return;
        }
      } catch {
        fixed = {};
      }

      setStatus("Building both Daily boards with no repeated categories…");
      const generated = await buildDailyPair(existingCountries, date, fixed);
      let finalPair = generated;
      try {
        const response = await fetch(`/api/daily-pair/${date}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            easy: { seed: dailySeed("easy"), encodedBoard: encodeRound(generated.easy) },
            expert: { seed: dailySeed("expert"), encodedBoard: encodeRound(generated.expert) },
          }),
        });
        if (response.ok) {
          const saved = await response.json();
          if (saved?.easy?.encoded_board && saved?.expert?.encoded_board) {
            finalPair = {
              easy: decodeRound(saved.easy.encoded_board, existingCountries),
              expert: decodeRound(saved.expert.encoded_board, existingCountries),
            };
          }
        }
      } catch {
        // Both locally generated boards still obey the paired-Daily constraints.
      }
      const finalRound = finalPair[nextDifficulty];
      setRound(finalRound);
      rememberRound(nextSeed, finalRound);
      syncUrl(nextSeed, "daily", finalRound, nextDifficulty);
      setStatus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The Daily pair could not be generated.");
      setStatus("");
    }
  }

  function loadEmbeddedRound(nextSeed: string, nextMode: GameMode, packedBoard: string, existingCountries = countries, nextDifficulty: DailyDifficulty = difficulty) {
    embeddedBoardRef.current = packedBoard;
    resetRoundState(nextSeed, nextMode, nextDifficulty);
    setStatus("Opening the exact shared challenge…");
    try {
      const restored = decodeRound(packedBoard, existingCountries);
      setRound(restored);
      rememberRound(nextSeed, restored);
      syncUrl(nextSeed, nextMode, restored, nextDifficulty);
      setStatus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The shared challenge could not be opened.");
      setStatus("");
    }
  }

  function playRandom(existingCountries = countries) {
    return loadRandomRound(randomSeed(), existingCountries);
  }

  function playDaily(nextDifficulty: DailyDifficulty = difficulty, existingCountries = countries) {
    return loadDailyRound(nextDifficulty, existingCountries);
  }

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchCountries();
        setCountries(list);
        const params = new URLSearchParams(window.location.search);
        const isDailyPath = window.location.pathname === "/daily" || window.location.pathname.startsWith("/daily/");
        const pathDifficulty: DailyDifficulty = window.location.pathname.startsWith("/daily/expert") ? "expert" : "easy";
        const nextMode: GameMode = isDailyPath || params.get("mode") === "daily" ? "daily" : "random";
        const sharedSeed = params.get("seed")?.trim().toUpperCase();
        const nextDifficulty = nextMode === "daily" ? pathDifficulty : DEFAULT_DIFFICULTY;
        const nextSeed = sharedSeed || (nextMode === "daily" ? dailySeed(nextDifficulty) : randomSeed());
        const packedBoard = params.get("board");
        if (packedBoard) {
          loadEmbeddedRound(nextSeed, nextMode, packedBoard, list, nextDifficulty);
          return;
        }
        if (nextMode === "daily") {
          await loadDailyRound(nextDifficulty, list);
          return;
        }
        const restored = cachedRound(nextSeed, list);
        if (restored) {
          loadEmbeddedRound(nextSeed, nextMode, encodeRound(restored), list, DEFAULT_DIFFICULTY);
          return;
        }
        await loadRandomRound(nextSeed, list);
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
    if (mode === "daily") playDaily(difficulty);
    else loadRandomRound(seed || randomSeed());
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
    const topFinish = scores.filter((row) => row.rank <= topFinishRank).length;
    const text = `🌍 GeoStats${mode === "daily" ? ` ${ROUND_CONFIGS[difficulty].label} Daily` : ""}
${total} / ${roundMaxScore}

🥇 ${firsts}   🥈 ${seconds}   🥉 ${thirds}
⭐ Top ${topFinishRank}: ${topFinish}/${categoryTarget}

Can you beat my score?`;

    const url = challengeUrl();

    try {
      if (navigator.share) {
        await navigator.share({
          title: "GeoStats",
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
    if (!round || Object.keys(assignments).length !== categoryTarget) return;
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
  const topFinishCount = scores?.filter((row) => row.rank <= topFinishRank).length ?? 0;
  const normalDailyActive = mode === "daily" && difficulty === "easy";
  const expertDailyActive = mode === "daily" && difficulty === "expert";

  return <div className={`shell ${round && !scores ? "activePlay" : ""} ${scores ? "resultsView" : ""} ${poolSize === 10 ? "expertRound" : "easyRound"}`}>
    {!scores && <header>
      <div className="brand"><span className="logo">🌍</span><div><h1>GeoStats</h1><p>Geography, with strategy.</p></div></div>
      <div className="headerButtons"><a href="/audit" className="headerLink">Data audit</a><button onClick={() => setShowRules(true)}>How it works</button><a href="/daily" className={`dailyModeButton ${normalDailyActive ? "active" : ""}`} aria-current={normalDailyActive ? "page" : undefined}>Normal Daily</a><a href="/daily/expert" className={`dailyModeButton ${expertDailyActive ? "active" : ""}`} aria-current={expertDailyActive ? "page" : undefined}>Expert Daily</a><button onClick={() => playRandom()} disabled={!countries.length}>Random</button><AccountControls /></div>
    </header>}

    <section className="challengeBar">
      <div><span className="kicker">{mode === "daily" ? `${ROUND_CONFIGS[difficulty].label} Daily` : "Seeded challenge"}</span><strong>{mode === "daily" ? dailyDateFromSeed(seed) : seed}</strong></div>
      <div className="challengeActions"><span className="mobileProgress">{Object.keys(assignments).length}/{categoryTarget} assigned</span>{scores && <button className="resultsRulesLink" onClick={() => setShowRules(true)}>Rules</button>}<button onClick={copyChallenge} disabled={!round}>{copied ? "Copied ✓" : "Copy link"}</button></div>
    </section>

    {!scores && <section className="hero">
      <div><span className="kicker">A strategy atlas</span><h2>{poolSize} countries. {categoryTarget} measures. One perfect allocation.</h2><p>Place {categoryTarget} countries, leave two behind, and make every specialist count. Each challenge link preserves the exact same board and values for everyone.</p></div>
      <aside><strong>{Object.keys(assignments).length}/{categoryTarget}</strong><span>categories assigned</span></aside>
    </section>}

    {status && <div className="loading"><div className="spinner"/><strong>{status}</strong><span>Official datasets can take a few seconds to load the first time.</span></div>}
    {error && <div className="error"><strong>Couldn’t generate this round.</strong><span>{error}</span><button onClick={retryCurrentRound}>Try again</button></div>}

    {round && !scores && <main className={`grid playGrid ${selected ? "holdingCountry" : ""} ${selectedCategory ? "choosingCountry" : ""}`}>
      <section className="panel bankPanel"><div className="panelTitle"><div><span className="kicker">Country bank</span><h3>Choose your {categoryTarget}</h3></div><small>Two will remain unused</small></div>
        <div className="countries">{round.bank.map((country) => <button key={country.id} draggable={!used.has(country.id)} onDragStart={(event)=>event.dataTransfer.setData("text/plain", country.id)} onTouchStart={(event)=>beginTouch(event,country.id)} onTouchMove={moveTouch} onTouchEnd={endTouch} onTouchCancel={endTouch} className={`country ${selected===country.id?"selected":""} ${selectedCategory&&!used.has(country.id)?"categoryTarget":""} ${used.has(country.id)?"used":""}`} aria-pressed={selected===country.id} disabled={used.has(country.id)} onClick={() => selectCountry(country.id)}><span>{country.flag}</span><div><strong title={country.name}><span className="desktopCountryName">{country.name}</span><span className="mobileCountryName">{shortCountryName(country.name)}</span></strong></div>{used.has(country.id)&&<b>USED</b>}</button>)}</div>
      </section>
      <div className="boardSpine" aria-hidden="true"/>
      <section className="panel boardPanel"><div className="panelTitle"><div><span className="kicker">The atlas</span><h3>Match countries to measures</h3></div><small>One use per country</small></div>
        <div className="slots">{round.categories.map((dataset, index) => { const c = round.bank.find((x)=>x.id===assignments[dataset.category.id]); return <button key={dataset.category.id} data-category-id={dataset.category.id} className={`slot theme-${dataset.category.family.toLowerCase().replace(/[^a-z0-9]+/g,"-")} ${c?"assigned":""} ${selected&&!c?"target":""} ${selectedCategory===dataset.category.id?"selectedCategory":""} ${touchDrag?.targetCategoryId===dataset.category.id?"touchTarget":""}`} aria-pressed={selectedCategory===dataset.category.id} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();const dropped=event.dataTransfer.getData("text/plain");if(dropped)assignCountry(dataset.category.id,dropped)}} onClick={()=>selectCategory(dataset.category.id)}><span className="cornerNotch" aria-hidden="true"/><div className="category"><span>{dataset.category.icon}</span><div><strong>{dataset.category.name}</strong><small>{dataset.category.description}</small></div><b className="slotNumber">{String(index + 1).padStart(2, "0")}</b></div><div className={`choice ${c?"filled":""}`}>{c?<><span className="pieceFlag">{c.flag}</span><strong className="pieceName">{c.name}</strong><i className="removePiece" aria-label={`Remove ${c.name} from ${dataset.category.name}`} title="Remove country" onClick={(e)=>{e.stopPropagation();setAssignments((a)=>{const n={...a};delete n[dataset.category.id];return n;});setSelectedCategory(null);}}>×</i></>:<em>{selected?"Place selected country":selectedCategory===dataset.category.id?"Now choose a country":"Select a country"}</em>}</div></button>})}</div>
        <div className="lock"><span>{categoryTarget-Object.keys(assignments).length>0?`${categoryTarget-Object.keys(assignments).length} selections remaining`:"Draft complete"}</span><button disabled={Object.keys(assignments).length!==categoryTarget} onClick={score}>Lock in draft</button></div>
      </section>
    </main>}

    {round && scores && <section className="panel results"><div className="score"><span>Final score</span><div className="scoreValue"><strong>{total}</strong><b>/ {roundMaxScore}</b></div><div className="scoreInsights"><div><strong>{averagePlacement}</strong><span>Average placement</span></div><div><strong>{bestPossibleCount}</strong><span>Best possible</span></div><div><strong>{topFinishCount}/{categoryTarget}</strong><span>Top {topFinishRank}</span></div></div><div className="scoreBreakdown">{[1,2,3].map((rank)=><span key={rank}>{rank===1?"🥇":rank===2?"🥈":"🥉"} {scores.filter((row)=>row.rank===rank).length}</span>)}</div><p>{total>=roundMaxScore*.8125?"Elite allocation.":total>=roundMaxScore*.65?"Strong draft with room to optimize.":"A few specialists were spent in the wrong places."}</p><div className="scoreActions"><button className="shareScore" onClick={shareScore}>{copied ? "Score copied ✓" : "Share score"}</button><AccountControls results difficulty={difficulty} pendingScore={mode === "daily" ? { challengeDate: dailyDateFromSeed(seed), difficulty, assignments } : undefined} /></div></div>
      <div className="resultsHeading"><div><span className="kicker">Your placements</span><h3>Placement and points earned</h3></div><small>Open a ranking to compare all {poolSize} countries</small></div>
      {scores.map((row)=>{ const leaderboard=poolLeaderboard(row.category,round.bank); return <div className={`resultWrap theme-${row.category.category.family.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`} key={row.category.category.id}><div className="result"><div className="resultMain"><span>{row.category.category.icon}</span><div><strong>{row.category.category.name}</strong><small className="statTip" tabIndex={0}>{row.country.flag} {row.country.name} · {formatValue(row.value,row.category.category)} · {row.category.byCountry.get(row.country.id)?.year}<span className="tooltip">{SOURCE_REGISTRY[row.category.category.source].name} list: #{row.globalRank} globally<br/>Actual value: {formatValue(row.value,row.category.category)}<br/>Indicator: {row.category.category.indicator}<br/><a href={row.category.sourceUrl} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()}>Open official source ↗</a></span></small></div></div><div className="placementSummary"><b>{ordinal(row.rank)} of {poolSize}</b><strong>{row.points} pts earned</strong>{row.rank===1&&<span>Best possible</span>}</div><button className="leaderboardButton" onClick={()=>setOpenLeaderboard(openLeaderboard===row.category.category.id?null:row.category.category.id)} aria-expanded={openLeaderboard===row.category.category.id}>{openLeaderboard===row.category.category.id?"Hide rankings":"View rankings"}</button></div>{openLeaderboard===row.category.category.id&&<div className="leaderboard"><div className="leaderboardHeader"><div className="leaderboardTitle"><h4>{row.category.category.name}</h4><span>All {poolSize} countries</span></div><div className="leaderboardSource"><span className="sourceBadge">{row.category.category.source === "worldbank" ? "World Bank" : SOURCE_REGISTRY[row.category.category.source].name}</span><a href={row.category.sourceUrl} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()}>Official source ↗</a></div></div>{leaderboard.map(item=><div key={item.country.id} className={item.country.id===row.country.id?"current":""}><b>#{item.poolRank}</b><span>{item.country.flag} {item.country.name}</span><span>{formatValue(item.observation.value,row.category.category)}</span><small>{item.observation.year}</small><strong>{item.points} pts</strong></div>)}</div>}</div>})}
      <div className="perfect"><div className="resultsHeading"><div><span className="kicker">🏆 Perfect Round</span><h3>The optimal allocation</h3></div><small>Each category’s best country among these {poolSize}</small></div>
      <div className="perfectGrid">{scores.map((row)=><div className="perfectRow" key={`perfect-${row.category.category.id}`}><span>{row.category.category.icon}</span><div><strong>{row.category.category.name}</strong><small className="statTip" tabIndex={0}>{row.best.flag} {row.best.name} · {formatValue(row.bestValue,row.category.category)}<span className="tooltip">{SOURCE_REGISTRY[row.category.category.source].name} list: #{row.bestGlobalRank} globally<br/>Actual value: {formatValue(row.bestValue,row.category.category)}<br/><a href={row.category.sourceUrl} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()}>Open official source ↗</a></span></small></div><b>100 pts</b></div>)}</div></div>
      <div className="lock"><span>Maximum score: {roundMaxScore}</span><div className="resultActions"><a className="resultModeLink" href="/daily">Normal Daily</a><a className="resultModeLink" href="/daily/expert">Expert Daily</a><button onClick={()=>playRandom()}>New random round</button></div></div></section>}

    {touchDrag && round && <div className="touchGhost" style={{ left: touchDrag.x, top: touchDrag.y }}><span>{round.bank.find((country)=>country.id===touchDrag.countryId)?.flag}</span><strong>{round.bank.find((country)=>country.id===touchDrag.countryId)?.name}</strong></div>}

    {!scores && <section className="dataNote"><strong>Atlas index · {CATEGORIES.length} official categories</strong><p><a href="/data">Data & methodology</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p><p>Population, economy, land, rainfall, agriculture, forests, energy, health, education, labor, transport, technology, and environment. Food-specific categories such as cheese, bread, meat, livestock, and wildfire statistics require separate FAO and satellite datasets and are reserved for the next data expansion so their definitions remain accurate.</p></section>}

    {showRules&&<div className="modal" onClick={(e)=>e.currentTarget===e.target&&setShowRules(false)}><div><h2>How GeoStats works</h2><ol><li><strong>Choose a Daily.</strong> Normal has 8 countries and 6 categories. Expert has 10 countries and 8 categories. Both leave two countries unused.</li><li><strong>Read the category direction.</strong> For “Highest,” the largest value ranks first. For “Lowest,” the smallest value ranks first.</li><li><strong>Use each country once.</strong> A country can only be assigned to one category.</li><li><strong>Earn points based on rank.</strong> Normal scores 100, 85, 70, 55, 40, 25, 10, and 0 points from 1st through 8th. Expert scores 100, 90, 80, 70, 60, 50, 40, 30, 20, and 10 points from 1st through 10th.</li><li><strong>Every round can be solved perfectly.</strong> Each category has a different first-place country within that board. A perfect Normal score is <strong>600</strong>; a perfect Expert score is <strong>800</strong>.</li><li><strong>The two Dailies stay fresh.</strong> Normal and Expert never repeat a category on the same day, and no more than two countries appear in both.</li></ol><button onClick={()=>setShowRules(false)}>Start drafting</button></div></div>}
  </div>;
}
