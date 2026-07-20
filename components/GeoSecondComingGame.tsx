"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, type Category } from "../lib/categories";
import { fetchCountries, type CountryInfo } from "../lib/worldBank";
import { fetchCategory } from "../lib/dataSources";
import { canonicalizeDataset, formatValue, poolLeaderboard, scorePlacements, validateRound, type CanonicalDataset } from "../lib/dataEngine";
import { CATEGORY_SET_VERSION, DATASET_VERSION, RULES_VERSION } from "../lib/version";
import { SOURCE_REGISTRY } from "../lib/sourceRegistry";

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

function tryAssembleRound(available: RoundCategory[], countryList: CountryInfo[], rng: Rng, attempts: number): Round | null {
  for (let attempt = 0; attempt < attempts; attempt++) {
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
    if (bank.length === 10 && validateRound(categories, bank).length === 0) return { bank, categories };
  }
  return null;
}

type StoredRound = {
  savedAt: number;
  bank: CountryInfo[];
  categories: Array<{ categoryId: string; observations: CanonicalDataset["observations"]; year: string }>;
};

const ROUND_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function roundCacheKey(seed: string) {
  return `geo-round:${DATASET_VERSION}:${RULES_VERSION}:${CATEGORY_SET_VERSION}:${seed}`;
}

function readCachedRound(seed: string): Round | null {
  try {
    const raw = window.localStorage.getItem(roundCacheKey(seed));
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredRound;
    if (!stored.savedAt || Date.now() - stored.savedAt > ROUND_CACHE_TTL_MS) {
      window.localStorage.removeItem(roundCacheKey(seed));
      return null;
    }
    const categoryById = new Map(CATEGORIES.map((category) => [category.id, category]));
    const categories = stored.categories.map((item) => {
      const category = categoryById.get(item.categoryId);
      if (!category) throw new Error("Cached category no longer exists.");
      return canonicalizeDataset({ category, observations: item.observations, year: item.year });
    });
    const round = { bank: stored.bank, categories };
    return validateRound(round.categories, round.bank).length === 0 ? round : null;
  } catch {
    return null;
  }
}

function writeCachedRound(seed: string, round: Round) {
  try {
    const stored: StoredRound = {
      savedAt: Date.now(),
      bank: round.bank,
      categories: round.categories.map((dataset) => ({
        categoryId: dataset.category.id,
        observations: dataset.observations,
        year: dataset.year,
      })),
    };
    window.localStorage.setItem(roundCacheKey(seed), JSON.stringify(stored));
  } catch {
    // The game remains fully functional when browser storage is unavailable.
  }
}

async function buildRound(countryList: CountryInfo[], seed: string): Promise<Round> {
  const rng = seededRandom(seed);
  const available: RoundCategory[] = [];
  const scheduledCategories = shuffle(CATEGORIES, rng);

  // World Bank-only rounds can load in larger parallel groups without waiting on
  // unrelated source APIs. Try once after 16 valid datasets, then expand only if
  // the seed needs a broader candidate pool.
  const BATCH_SIZE = 16;
  const MAX_CANDIDATES = 32;

  for (let offset = 0; offset < Math.min(scheduledCategories.length, MAX_CANDIDATES); offset += BATCH_SIZE) {
    const batch = scheduledCategories.slice(offset, offset + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (category) => canonicalizeDataset(await fetchCategory(category))),
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const dataset = result.value;
      if (dataset.ranked.length >= dataset.category.coverageFloor) available.push(dataset);
    }

    if (available.length >= 12) {
      const earlyRound = tryAssembleRound(available, countryList, rng, offset === 0 ? 36 : 72);
      if (earlyRound) return earlyRound;
    }
  }

  if (available.length < 8) {
    throw new Error("Not enough verified World Bank indicators were available to generate a round. Please try again.");
  }

  const finalRound = tryAssembleRound(available, countryList, rng, 100);
  if (finalRound) return finalRound;

  throw new Error("This seed could not produce a balanced eight-winner round. Generate another random challenge.");
}

export default function GeoSecondComingGame() {
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [assignments, setAssignments] = useState<Assignment>({});
  const [selected, setSelected] = useState<string | null>(null);
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

  const used = useMemo(() => new Set(Object.values(assignments)), [assignments]);

  function syncUrl(nextSeed: string, nextMode: GameMode) {
    const url = new URL(window.location.href);
    url.search = "";
    if (nextMode === "daily") url.searchParams.set("mode", "daily");
    else url.searchParams.set("seed", nextSeed);
    url.searchParams.set("data", DATASET_VERSION);
    url.searchParams.set("rules", RULES_VERSION);
    url.searchParams.set("cats", CATEGORY_SET_VERSION);
    window.history.replaceState({}, "", url);
  }

  async function loadRound(nextSeed: string, nextMode: GameMode, existingCountries = countries) {
    setError("");
    setRound(null);
    setScores(null);
    setAssignments({});
    setSelected(null);
    setCopied(false);
    setSeed(nextSeed);
    setMode(nextMode);
    syncUrl(nextSeed, nextMode);
    setStatus(nextMode === "daily" ? "Loading today’s shared challenge…" : "Building your seeded challenge…");
    try {
      const cachedRound = readCachedRound(nextSeed);
      if (cachedRound) {
        setRound(cachedRound);
        setStatus("");
        return;
      }
      const generated = await buildRound(existingCountries, nextSeed);
      writeCachedRound(nextSeed, generated);
      setRound(generated);
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
    (async () => {
      try {
        const list = await fetchCountries();
        setCountries(list);
        const params = new URLSearchParams(window.location.search);
        if (params.get("mode") === "daily") {
          await playDaily(list);
        } else {
          const sharedSeed = params.get("seed")?.trim().toUpperCase();
          await loadRound(sharedSeed || randomSeed(), "random", list);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Official data could not be loaded.");
        setStatus("");
      }
    })();
  }, []);

  async function copyChallenge() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("The challenge link could not be copied automatically. Copy the URL from your browser instead.");
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
    }, 220);
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
      <div><span className="kicker">{mode === "daily" ? "Daily challenge" : "Seeded challenge"}</span><strong>{mode === "daily" ? seed.replace("DAILY-", "") : seed}</strong></div>
      <button onClick={copyChallenge} disabled={!round}>{copied ? "Link copied ✓" : "Copy challenge link"}</button>
    </section>

    <section className="hero">
      <div><span className="kicker">Official-data beta</span><h2>Ten countries. Eight categories. You choose where every country goes.</h2><p>Every random link is reproducible, and the daily challenge is identical for everyone. Eight different countries are the best pool choice for the eight categories; the other two are decoys.</p></div>
      <aside><strong>{Object.keys(assignments).length}/8</strong><span>categories assigned</span></aside>
    </section>

    {status && <div className="loading"><div className="spinner"/><strong>{status}</strong><span>Loading verified World Bank indicators and assembling a valid round. Previously loaded indicators and completed rounds are reused automatically.</span></div>}
    {error && <div className="error"><strong>Couldn’t generate this round.</strong><span>{error}</span><button onClick={() => mode === "daily" ? playDaily() : loadRound(seed || randomSeed(), "random")}>Try again</button></div>}

    {round && !scores && <main className="grid playGrid">
      <section className="panel bankPanel"><div className="panelTitle"><div><span className="kicker">Country bank</span><h3>Choose your 8</h3></div><small>Two will remain unused</small></div>
        <div className="countries">{round.bank.map((country) => <button key={country.id} draggable={!used.has(country.id)} onDragStart={(event)=>event.dataTransfer.setData("text/plain", country.id)} onTouchStart={(event)=>beginTouch(event,country.id)} onTouchMove={moveTouch} onTouchEnd={endTouch} onTouchCancel={endTouch} className={`country ${selected===country.id?"selected":""} ${used.has(country.id)?"used":""}`} disabled={used.has(country.id)} onClick={() => setSelected(selected===country.id?null:country.id)}><span>{country.flag}</span><div><strong>{country.name}</strong></div>{used.has(country.id)&&<b>USED</b>}</button>)}</div>
      </section>
      <section className="panel boardPanel"><div className="panelTitle"><div><span className="kicker">Draft board</span><h3>Match countries to categories</h3></div><small>One use per country</small></div>
        <div className="slots">{round.categories.map((dataset) => { const c = round.bank.find((x)=>x.id===assignments[dataset.category.id]); return <button key={dataset.category.id} data-category-id={dataset.category.id} className={`slot ${selected&&!c?"target":""} ${touchDrag?.targetCategoryId===dataset.category.id?"touchTarget":""}`} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();const dropped=event.dataTransfer.getData("text/plain");if(dropped)assignCountry(dataset.category.id,dropped)}} onClick={()=>assign(dataset.category.id)}><div className="category"><span>{dataset.category.icon}</span><div><strong>{dataset.category.name}</strong><small>{dataset.category.description}</small></div></div><div className="choice">{c?<><span>{c.flag}</span><strong>{c.name}</strong><i onClick={(e)=>{e.stopPropagation();setAssignments((a)=>{const n={...a};delete n[dataset.category.id];return n;});}}>×</i></>:<em>{selected?"Place selected country":"Select a country"}</em>}</div><footer>{SOURCE_REGISTRY[dataset.category.source].name} · latest available data</footer></button>})}</div>
        <div className="lock"><span>{8-Object.keys(assignments).length>0?`${8-Object.keys(assignments).length} selections remaining`:"Draft complete"}</span><button disabled={Object.keys(assignments).length!==8} onClick={score}>Lock in draft</button></div>
      </section>
    </main>}

    {round && scores && <section className="panel results"><div className="score"><span>Final score</span><strong>{total}</strong><p>{total>=650?"Elite allocation.":total>=520?"Strong draft with room to optimize.":"A few specialists were spent in the wrong places."}</p><button className="shareScore" onClick={copyChallenge}>{copied ? "Challenge link copied ✓" : "Challenge a friend"}</button></div>
      <div className="resultsHeading"><div><span className="kicker">Your draft</span><h3>How each placement scored</h3></div><small>Hover or tap a stat for its global World Bank rank</small></div>
      {scores.map((row)=>{ const leaderboard=poolLeaderboard(row.category,round.bank); const regret=100-row.points; return <div className="resultWrap" key={row.category.category.id}><div className="result"><div><span>{row.category.category.icon}</span><div><strong>{row.category.category.name}</strong><small className="statTip" tabIndex={0}>{row.country.flag} {row.country.name} · {formatValue(row.value,row.category.category)} · Data year {row.category.byCountry.get(row.country.id)?.year}<span className="tooltip">World Bank rank: #{row.globalRank} globally<br/>Actual value: {formatValue(row.value,row.category.category)}<br/>Source: {row.category.category.dataset}<br/>Indicator: {row.category.category.indicator}<br/><a href={row.category.sourceUrl} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()}>Open official source ↗</a></span></small><small>{regret ? `${regret} points left on the table` : "Optimal placement"}</small></div></div><b>#{row.rank} / 10</b><strong>{row.points} pts</strong><button className="leaderboardButton" onClick={()=>setOpenLeaderboard(openLeaderboard===row.category.category.id?null:row.category.category.id)} aria-expanded={openLeaderboard===row.category.category.id}>Why this rank?</button></div>{openLeaderboard===row.category.category.id&&<div className="leaderboard"><div className="leaderboardHeader"><h4>{row.category.category.name} · all ten countries</h4><a href={row.category.sourceUrl} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()}>View official data source ↗</a></div>{leaderboard.map(item=><div key={item.country.id} className={item.country.id===row.country.id?"current":""}><b>#{item.poolRank}</b><span>{item.country.flag} {item.country.name}</span><span>{formatValue(item.observation.value,row.category.category)}</span><small>{item.observation.year}</small><strong>{item.points} pts</strong></div>)}</div>}</div>})}
      <div className="perfect"><div className="resultsHeading"><div><span className="kicker">Perfect answer</span><h3>The 800-point allocation</h3></div><small>Each category’s best country among these ten</small></div>
      <div className="perfectGrid">{scores.map((row)=><div className="perfectRow" key={`perfect-${row.category.category.id}`}><span>{row.category.category.icon}</span><div><strong>{row.category.category.name}</strong><small className="statTip" tabIndex={0}>{row.best.flag} {row.best.name} · {formatValue(row.bestValue,row.category.category)}<span className="tooltip">World Bank rank: #{row.bestGlobalRank} globally<br/>Actual value: {formatValue(row.bestValue,row.category.category)}<br/><a href={row.category.sourceUrl} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()}>Open official source ↗</a></span></small></div><b>100 pts</b></div>)}</div></div>
      <div className="lock"><span>Maximum score: 800</span><div className="resultActions"><button onClick={()=>playDaily()}>Daily challenge</button><button onClick={()=>playRandom()}>New random round</button></div></div></section>}

    {touchDrag && round && <div className="touchGhost" style={{ left: touchDrag.x, top: touchDrag.y }}><span>{round.bank.find((country)=>country.id===touchDrag.countryId)?.flag}</span><strong>{round.bank.find((country)=>country.id===touchDrag.countryId)?.name}</strong></div>}

    <section className="dataNote"><strong>Current library: {CATEGORIES.length} verified World Bank category definitions</strong><p><a href="/data">Data & methodology</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p><p>World Bank indicators use consistent ranking, coverage, contradiction, and tie checks. Country observations before 2022 are excluded, and any category that cannot meet its required coverage is removed from playable rounds.</p></section>

    {showRules&&<div className="modal" onClick={(e)=>e.currentTarget===e.target&&setShowRules(false)}><div><h2>How Geo: Second Coming works</h2><ol><li>Choose the shared daily challenge or generate a random challenge with its own shareable seed.</li><li>Eight categories are selected deterministically from that seed, with no more than two from the same subject family.</li><li>Each category winner is drawn from that category’s global top 100.</li><li>Within the ten-country pool, eight different countries are each #1 for exactly one of the eight categories. The other two are decoys.</li><li>Assign eight countries and discard two. Each country can be used once.</li><li>Anyone opening the same challenge link receives the same categories, countries, and category order.</li></ol><p>Enabled category values are loaded from the World Bank World Development Indicators API. The daily challenge changes at midnight UTC. Challenge links preserve the seed, dataset release, category set, and rules version.</p><button onClick={()=>setShowRules(false)}>Start drafting</button></div></div>}
  </div>;
}
