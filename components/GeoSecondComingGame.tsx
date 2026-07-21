"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, type Category } from "../lib/categories";
import type { CategoryDataset, CountryInfo } from "../lib/worldBank";
import { SOURCE_REGISTRY } from "../lib/sourceRegistry";
import { canonicalizeDataset, formatValue, poolLeaderboard, scorePlacements, validateRound, type CanonicalDataset } from "../lib/dataEngine";
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
type SharedBoard = { categoryIds: string[]; bankIds: string[] };
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

function dailySeed(date = new Date()) {
  return `DAILY-${date.toISOString().slice(0, 10)}`;
}

function randomSeed() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function normalizeSeed(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

function parseOrderedIds(value: string | null, expectedLength: number) {
  if (!value) return null;
  const ids = value.split(",").map((id) => id.trim()).filter(Boolean);
  if (ids.length !== expectedLength || new Set(ids).size !== ids.length) return null;
  return ids;
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

function observationValue(category: RoundCategory, countryId: string) {
  return category.byCountry.get(countryId)?.value;
}

const CLIENT_CACHE_PREFIX = `geo-second-coming:${DATASET_VERSION}:${CATEGORY_SET_VERSION}`;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type CachedValue<T> = { cachedAt: number; value: T };

function readClientCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${CLIENT_CACHE_PREFIX}:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedValue<T>;
    if (!parsed?.cachedAt || Date.now() - parsed.cachedAt > CACHE_MAX_AGE_MS) {
      window.localStorage.removeItem(`${CLIENT_CACHE_PREFIX}:${key}`);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function writeClientCache<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${CLIENT_CACHE_PREFIX}:${key}`, JSON.stringify({ cachedAt: Date.now(), value }));
  } catch {
    // Storage can be unavailable in private browsing; the game still works without it.
  }
}

async function fetchCountryList(): Promise<CountryInfo[]> {
  const cached = readClientCache<CountryInfo[]>("countries");
  if (cached?.length) return cached;
  const response = await fetch("/api/countries");
  const payload = await response.json() as { countries?: CountryInfo[]; error?: string };
  if (!response.ok || !payload.countries?.length) throw new Error(payload.error ?? "Country data could not be loaded.");
  writeClientCache("countries", payload.countries);
  return payload.countries;
}

async function fetchDatasets(categoryIds: string[]): Promise<CategoryDataset[]> {
  if (!categoryIds.length) return [];
  const response = await fetch("/api/datasets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoryIds }),
  });
  const payload = await response.json() as { datasets?: CategoryDataset[]; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Indicator data could not be loaded.");
  return payload.datasets ?? [];
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy failed.");
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

async function loadDatasetsByIds(categoryIds: string[]): Promise<RoundCategory[]> {
  const categoryById = new Map(CATEGORIES.map((category) => [category.id, category]));
  const selected = categoryIds
    .map((id) => categoryById.get(id))
    .filter((category): category is Category => category !== undefined && category.enabled !== false);
  const rawById = new Map<string, CategoryDataset>();
  const missingIds: string[] = [];

  for (const category of selected) {
    const cached = readClientCache<CategoryDataset>(`dataset:${category.id}`);
    if (cached) rawById.set(category.id, cached);
    else missingIds.push(category.id);
  }

  if (missingIds.length) {
    const fetched = await fetchDatasets(missingIds);
    for (const dataset of fetched) {
      rawById.set(dataset.category.id, dataset);
      writeClientCache(`dataset:${dataset.category.id}`, dataset);
    }
  }

  const loaded: RoundCategory[] = [];
  for (const category of selected) {
    const dataset = rawById.get(category.id);
    if (!dataset) continue;
    try {
      const canonical = canonicalizeDataset(dataset);
      if (canonical.ranked.length >= canonical.category.coverageFloor) loaded.push(canonical);
    } catch {
      // A single unavailable indicator should not block the rest of the round.
    }
  }
  return loaded;
}

async function loadCandidateDatasets(seed: string): Promise<RoundCategory[]> {
  const rng = seededRandom(`${seed}:datasets`);
  const shuffled = shuffle(CATEGORIES.filter((category) => category.enabled !== false), rng);
  const selected: Category[] = [];
  const familyCounts = new Map<string, number>();

  for (const category of shuffled) {
    if ((familyCounts.get(category.family) ?? 0) >= 3) continue;
    selected.push(category);
    familyCounts.set(category.family, (familyCounts.get(category.family) ?? 0) + 1);
    if (selected.length === 16) break;
  }

  return loadDatasetsByIds(selected.map((category) => category.id));
}

function buildRound(countryList: CountryInfo[], seed: string, available: RoundCategory[]): Round {
  const rng = seededRandom(seed);

  if (available.length < 8) throw new Error("Not enough official datasets were available to generate a round. Please try again.");

  for (let attempt = 0; attempt < 180; attempt++) {
    const categories: RoundCategory[] = [];
    const counts = new Map<string, number>();
    for (const category of shuffle(available, rng)) {
      if ((counts.get(category.category.family) ?? 0) >= 2) continue;
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


function buildSharedRound(countryList: CountryInfo[], shared: SharedBoard, available: RoundCategory[]): Round {
  const datasetById = new Map(available.map((dataset) => [dataset.category.id, dataset]));
  const countryById = new Map(countryList.map((country) => [country.id, country]));
  const categories = shared.categoryIds.map((id) => datasetById.get(id)).filter((dataset): dataset is RoundCategory => Boolean(dataset));
  const bank = shared.bankIds.map((id) => countryById.get(id)).filter((country): country is CountryInfo => Boolean(country));

  if (categories.length !== 8 || bank.length !== 10) {
    throw new Error("This shared challenge could not be reconstructed from its exact board link.");
  }
  const errors = validateRound(categories, bank);
  if (errors.length) throw new Error(`This shared challenge is no longer valid: ${errors[0]}`);
  return { categories, bank };
}

export default function GeoSecondComingGame() {
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [assignments, setAssignments] = useState<Assignment>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreRow[] | null>(null);
  const [status, setStatus] = useState("Loading challenge data…");
  const [error, setError] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [seed, setSeed] = useState("");
  const [mode, setMode] = useState<GameMode>("random");
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied">("idle");
  const [openLeaderboard, setOpenLeaderboard] = useState<string | null>(null);
  const [touchDrag, setTouchDrag] = useState<{ countryId: string; x: number; y: number; targetCategoryId: string | null } | null>(null);
  const touchStart = useRef<{ countryId: string; x: number; y: number } | null>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const used = useMemo(() => new Set(Object.values(assignments)), [assignments]);

  function challengeUrl(nextSeed: string, nextMode: GameMode, exactRound: Round | null = round) {
    const cleanSeed = normalizeSeed(nextSeed);
    const url = new URL(window.location.pathname || "/", window.location.origin);
    if (nextMode === "daily") url.searchParams.set("mode", "daily");
    url.searchParams.set("seed", cleanSeed);
    url.searchParams.set("data", DATASET_VERSION);
    url.searchParams.set("rules", RULES_VERSION);
    url.searchParams.set("cats", CATEGORY_SET_VERSION);
    if (exactRound) {
      url.searchParams.set("categoryOrder", exactRound.categories.map((dataset) => dataset.category.id).join(","));
      url.searchParams.set("bankOrder", exactRound.bank.map((country) => country.id).join(","));
    }
    return url.toString();
  }

  function syncUrl(nextSeed: string, nextMode: GameMode, exactRound: Round | null = null) {
    window.history.replaceState({}, "", challengeUrl(nextSeed, nextMode, exactRound));
  }

  async function loadRound(nextSeed: string, nextMode: GameMode, existingCountries = countries, sharedBoard: SharedBoard | null = null) {
    setError("");
    setRound(null);
    setScores(null);
    setAssignments({});
    setSelected(null);
    setLinkCopied(false);
    setShareState("idle");
    const cleanSeed = normalizeSeed(nextSeed) || randomSeed();
    setSeed(cleanSeed);
    setMode(nextMode);
    syncUrl(cleanSeed, nextMode);
    setStatus(sharedBoard ? "Opening the exact shared challenge…" : nextMode === "daily" ? "Loading today’s shared challenge…" : "Building your seeded challenge…");
    try {
      const [countryList, available] = await Promise.all([
        existingCountries.length ? Promise.resolve(existingCountries) : fetchCountryList(),
        sharedBoard ? loadDatasetsByIds(sharedBoard.categoryIds) : loadCandidateDatasets(cleanSeed),
      ]);
      if (!countries.length) setCountries(countryList);
      const generated = sharedBoard ? buildSharedRound(countryList, sharedBoard, available) : buildRound(countryList, cleanSeed, available);
      setRound(generated);
      syncUrl(cleanSeed, nextMode, generated);
      setStatus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The round could not be generated.");
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
    const params = new URLSearchParams(window.location.search);
    const requestedMode: GameMode = params.get("mode") === "daily" ? "daily" : "random";
    const requestedSeed = normalizeSeed(params.get("seed") ?? "");
    const categoryIds = parseOrderedIds(params.get("categoryOrder"), 8);
    const bankIds = parseOrderedIds(params.get("bankOrder"), 10);
    const sharedBoard = categoryIds && bankIds ? { categoryIds, bankIds } : null;
    const nextSeed = requestedSeed || (requestedMode === "daily" ? dailySeed() : randomSeed());
    void loadRound(nextSeed, requestedMode, [], sharedBoard);
  }, []);

  async function copyChallenge() {
    try {
      await copyText(challengeUrl(seed, mode, round));
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      setError("The link could not be copied automatically. Copy the URL from your browser instead.");
    }
  }

  async function shareScore() {
    if (!scores) return;
    const firsts = scores.filter((row) => row.rank === 1).length;
    const seconds = scores.filter((row) => row.rank === 2).length;
    const thirds = scores.filter((row) => row.rank === 3).length;
    const topFive = scores.filter((row) => row.rank <= 5).length;
    const shareText = `🌍 Geo: Second Coming — ${total}/800

🥇 ${firsts}  ·  🥈 ${seconds}  ·  🥉 ${thirds}
⭐ Top 5: ${topFive}/8

Can you beat me?
${challengeUrl(seed, mode, round)}`;

    setShareState("idle");
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ text: shareText }))) {
        await navigator.share({ text: shareText });
        setShareState("shared");
      } else {
        await copyText(shareText);
        setShareState("copied");
      }
      window.setTimeout(() => setShareState("idle"), 1800);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await copyText(shareText);
        setShareState("copied");
        window.setTimeout(() => setShareState("idle"), 1800);
      } catch {
        setError("The score could not be shared or copied automatically.");
      }
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
  }

  function assign(categoryId: string) {
    if (!selected) return;
    assignCountry(categoryId, selected);
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

  return <div className={`shell ${round && !scores ? "activePlay" : ""}`}>
    <header>
      <div className="brand"><span className="logo">🌍</span><div><h1>Geo: Second Coming</h1><p>Geography, with strategy.</p><small>Data {DATASET_VERSION} · Rules {RULES_VERSION}</small></div></div>
      <div className="headerButtons"><a href="/audit" className="headerLink">Data audit</a><button onClick={() => setShowRules(true)}>How it works</button><button onClick={() => playDaily()} disabled={!countries.length}>Daily</button><button onClick={() => playRandom()} disabled={!countries.length}>Random</button></div>
    </header>

    <section className="challengeBar">
      <div><span className="kicker">{mode === "daily" ? "Daily challenge" : "Seeded challenge"}</span><strong>{mode === "daily" ? seed.replace("DAILY-", "") : seed.length === 8 ? `${seed.slice(0, 4)}-${seed.slice(4)}` : seed}</strong></div>
      <div className="challengeActions"><span className="mobileProgress">{Object.keys(assignments).length}/8 assigned</span><button onClick={copyChallenge} disabled={!round}>{linkCopied ? "Link copied ✓" : "Copy link"}</button></div>
    </section>

    <section className="hero">
      <div><span className="kicker">A strategy atlas</span><h2>Ten countries. Eight measures. One perfect allocation.</h2><p>Place eight countries, leave two behind, and make every specialist count. Each seed produces the same reproducible board for everyone.</p></div>
      <aside><strong>{Object.keys(assignments).length}/8</strong><span>categories assigned</span></aside>
    </section>

    {status && <div className="loading"><div className="spinner"/><strong>{status}</strong><span>The first visit may take a few seconds; later rounds reuse cached data.</span></div>}
    {error && <div className="error"><strong>Couldn’t generate this round.</strong><span>{error}</span><button onClick={() => mode === "daily" ? playDaily() : loadRound(seed || randomSeed(), "random")}>Try again</button></div>}

    {round && !scores && <main className="grid playGrid">
      <section className="panel bankPanel"><div className="panelTitle"><div><span className="kicker">Country bank</span><h3>Choose your 8</h3></div><small>Two will remain unused</small></div>
        <div className="countries">{round.bank.map((country) => <button key={country.id} draggable={!used.has(country.id)} onDragStart={(event)=>event.dataTransfer.setData("text/plain", country.id)} onTouchStart={(event)=>beginTouch(event,country.id)} onTouchMove={moveTouch} onTouchEnd={endTouch} onTouchCancel={endTouch} className={`country ${selected===country.id?"selected":""} ${used.has(country.id)?"used":""}`} disabled={used.has(country.id)} onClick={() => setSelected(selected===country.id?null:country.id)}><span>{country.flag}</span><div><strong title={country.name}><span className="desktopCountryName">{country.name}</span><span className="mobileCountryName">{shortCountryName(country.name)}</span></strong></div>{used.has(country.id)&&<b>USED</b>}</button>)}</div>
      </section>
      <section className="panel boardPanel"><div className="panelTitle"><div><span className="kicker">The atlas</span><h3>Match countries to measures</h3></div><small>One use per country</small></div>
        <div className="slots">{round.categories.map((dataset, index) => { const c = round.bank.find((x)=>x.id===assignments[dataset.category.id]); return <button key={dataset.category.id} data-category-id={dataset.category.id} className={`slot theme-${dataset.category.family.toLowerCase().replace(/[^a-z0-9]+/g,"-")} ${selected&&!c?"target":""} ${touchDrag?.targetCategoryId===dataset.category.id?"touchTarget":""}`} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();const dropped=event.dataTransfer.getData("text/plain");if(dropped)assignCountry(dataset.category.id,dropped)}} onClick={()=>assign(dataset.category.id)}><div className="category"><span>{dataset.category.icon}</span><div><strong>{dataset.category.name}</strong><small>{dataset.category.description}</small></div><b className="slotNumber">{String(index + 1).padStart(2, "0")}</b></div><div className="choice">{c?<><span>{c.flag}</span><strong>{c.name}</strong><i onClick={(e)=>{e.stopPropagation();setAssignments((a)=>{const n={...a};delete n[dataset.category.id];return n;});}}>×</i></>:<em>{selected?"Place selected country":"Select a country"}</em>}</div></button>})}</div>
        <div className="lock"><span>{8-Object.keys(assignments).length>0?`${8-Object.keys(assignments).length} selections remaining`:"Draft complete"}</span><button disabled={Object.keys(assignments).length!==8} onClick={score}>Lock in draft</button></div>
      </section>
    </main>}

    {round && scores && <section className="panel results"><div className="score"><span>Final score</span><div className="scoreValue"><strong>{total}</strong><b>/ 800</b></div><div className="scoreBreakdown">{[1,2,3].map((rank)=><span key={rank}>{rank===1?"🥇":rank===2?"🥈":"🥉"} {scores.filter((row)=>row.rank===rank).length}</span>)}<span>Top 5 {scores.filter((row)=>row.rank<=5).length}/8</span></div><p>{total>=650?"Elite allocation.":total>=520?"Strong draft with room to optimize.":"A few specialists were spent in the wrong places."}</p><button className="shareScore" onClick={shareScore}>{shareState === "shared" ? "Shared ✓" : shareState === "copied" ? "Score copied ✓" : "Share score"}</button></div>
      <div className="resultsHeading"><div><span className="kicker">Your placements</span><h3>How each placement scored</h3></div><small>Hover or tap a stat for its global official-source rank</small></div>
      {scores.map((row)=>{ const leaderboard=poolLeaderboard(row.category,round.bank); const regret=100-row.points; return <div className={`resultWrap theme-${row.category.category.family.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`} key={row.category.category.id}><div className="result"><div><span>{row.category.category.icon}</span><div><strong>{row.category.category.name}</strong><small className="statTip" tabIndex={0}>{row.country.flag} {row.country.name} · {formatValue(row.value,row.category.category)} · Data year {row.category.byCountry.get(row.country.id)?.year}<span className="tooltip">{SOURCE_REGISTRY[row.category.category.source].name} list: #{row.globalRank} globally<br/>Actual value: {formatValue(row.value,row.category.category)}<br/>Indicator: {row.category.category.indicator}<br/><a href={row.category.sourceUrl} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()}>Open official source ↗</a></span></small><small>{regret ? `${regret} points left on the table` : "Optimal placement"}</small></div></div><b>#{row.rank} / 10</b><strong>{row.points} pts</strong><button className="leaderboardButton" onClick={()=>setOpenLeaderboard(openLeaderboard===row.category.category.id?null:row.category.category.id)} aria-expanded={openLeaderboard===row.category.category.id}>{openLeaderboard===row.category.category.id?"▾ Rank":"▸ Rank"}</button></div>{openLeaderboard===row.category.category.id&&<div className="leaderboard"><div className="leaderboardHeader"><div className="leaderboardTitle"><h4>{row.category.category.name}</h4><span>All ten countries</span></div><div className="leaderboardSource"><span className="sourceBadge">{row.category.category.source === "worldbank" ? "World Bank" : SOURCE_REGISTRY[row.category.category.source].name}</span><a href={row.category.sourceUrl} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()}>Official source ↗</a></div></div>{leaderboard.map(item=><div key={item.country.id} className={item.country.id===row.country.id?"current":""}><b>#{item.poolRank}</b><span>{item.country.flag} {item.country.name}</span><span>{formatValue(item.observation.value,row.category.category)}</span><small>{item.observation.year}</small><strong>{item.points} pts</strong></div>)}</div>}</div>})}
      <div className="perfect"><div className="resultsHeading"><div><span className="kicker">🏆 Perfect Round</span><h3>The optimal allocation</h3></div><small>Each category’s best country among these ten</small></div>
      <div className="perfectGrid">{scores.map((row)=><div className="perfectRow" key={`perfect-${row.category.category.id}`}><span>{row.category.category.icon}</span><div><strong>{row.category.category.name}</strong><small className="statTip" tabIndex={0}>{row.best.flag} {row.best.name} · {formatValue(row.bestValue,row.category.category)}<span className="tooltip">{SOURCE_REGISTRY[row.category.category.source].name} list: #{row.bestGlobalRank} globally<br/>Actual value: {formatValue(row.bestValue,row.category.category)}<br/><a href={row.category.sourceUrl} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()}>Open official source ↗</a></span></small></div><b>100 pts</b></div>)}</div></div>
      <div className="lock"><span>Maximum score: 800</span><div className="resultActions"><button onClick={()=>playDaily()}>Daily challenge</button><button onClick={()=>playRandom()}>New random round</button></div></div></section>}

    {touchDrag && round && <div className="touchGhost" style={{ left: touchDrag.x, top: touchDrag.y }}><span>{round.bank.find((country)=>country.id===touchDrag.countryId)?.flag}</span><strong>{round.bank.find((country)=>country.id===touchDrag.countryId)?.name}</strong></div>}

    <section className="dataNote"><strong>Atlas index · {CATEGORIES.length} official categories</strong><p><a href="/data">Data & methodology</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p><p>Population, economy, land, rainfall, agriculture, forests, energy, health, education, labor, transport, technology, and environment. Food-specific categories such as cheese, bread, meat, livestock, and wildfire statistics require separate FAO and satellite datasets and are reserved for the next data expansion so their definitions remain accurate.</p></section>

    {showRules&&<div className="modal" onClick={(e)=>e.currentTarget===e.target&&setShowRules(false)}><div><h2>How Geo: Second Coming works</h2><ol><li>Ten countries are in the bank. Eight different countries are the top-ranked choice for one distinct category within that bank, whether the category rewards the highest or lowest value. The other two are decoys.</li><li>Drag one country to each category. Each country can be used once, so two countries will remain unused.</li><li>Anyone opening the same challenge link receives the same countries, categories, and order.</li></ol><p>After you submit, the results show each official value, data year, source, and global rank. The daily challenge changes at midnight UTC.</p><button onClick={()=>setShowRules(false)}>Start drafting</button></div></div>}
  </div>;
}
