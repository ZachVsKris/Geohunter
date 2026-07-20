"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, type Category } from "../lib/categories";
import { fetchCategory, fetchCountries, type CategoryDataset, type CountryInfo } from "../lib/worldBank";

type RoundCategory = CategoryDataset & { ranked: CategoryDataset["observations"] };
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

function formatValue(value: number, category: Category) {
  if (category.unit === "USD" || category.unit === "USD/person") {
    if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (category.unit === "people" || category.unit === "passengers" || category.unit === "passenger-km" || category.unit === "hectares" || category.unit === "km²") {
    if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B ${category.unit}`;
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M ${category.unit}`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: category.decimals ?? 1 })} ${category.unit}`;
}

function rankRows(dataset: CategoryDataset) {
  return [...dataset.observations].sort((a, b) => dataset.category.direction === "high" ? b.value - a.value : a.value - b.value);
}

function isBetter(category: RoundCategory, a: number, b: number) {
  return category.category.direction === "high" ? a > b : a < b;
}

function observationValue(category: RoundCategory, countryId: string) {
  return category.ranked.find((row) => row.countryId === countryId)?.value;
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

async function buildRound(countryList: CountryInfo[], seed: string): Promise<Round> {
  const rng = seededRandom(seed);
  const available: RoundCategory[] = [];
  const familyCounts = new Map<string, number>();

  for (const category of shuffle(CATEGORIES, rng)) {
    if ((familyCounts.get(category.family) ?? 0) >= 3) continue;
    try {
      const dataset = await fetchCategory(category);
      const ranked = rankRows(dataset).filter((o) => countryList.some((c) => c.id === o.countryId));
      if (ranked.length < 100) continue;
      available.push({ ...dataset, ranked });
      familyCounts.set(category.family, (familyCounts.get(category.family) ?? 0) + 1);
      if (available.length === 14) break;
    } catch {
      // Skip temporarily unavailable indicators and keep selecting.
    }
  }

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
    if (bank.length === 10) return { bank, categories };
  }

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
  const [touchDrag, setTouchDrag] = useState<{ countryId: string; x: number; y: number; targetCategoryId: string | null } | null>(null);
  const touchStart = useRef<{ countryId: string; x: number; y: number } | null>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const used = useMemo(() => new Set(Object.values(assignments)), [assignments]);

  function syncUrl(nextSeed: string, nextMode: GameMode) {
    const url = new URL(window.location.href);
    url.search = "";
    if (nextMode === "daily") url.searchParams.set("mode", "daily");
    else url.searchParams.set("seed", nextSeed);
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
      const generated = await buildRound(existingCountries, nextSeed);
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
    const rows: ScoreRow[] = round.categories.map((category) => {
      const id = assignments[category.category.id];
      const country = round.bank.find((c) => c.id === id)!;
      const bankRows = round.bank
        .map((c) => ({ country: c, observation: category.ranked.find((o) => o.countryId === c.id) }))
        .filter((x) => x.observation)
        .sort((a, b) => category.category.direction === "high" ? b.observation!.value - a.observation!.value : a.observation!.value - b.observation!.value);
      const rank = bankRows.findIndex((x) => x.country.id === id) + 1;
      const pointsByRank = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
      const points = pointsByRank[Math.max(1, Math.min(rank, 10)) - 1];
      const selectedObservation = bankRows.find((x) => x.country.id === id)!.observation!;
      const bestObservation = bankRows[0]!.observation!;
      const globalRank = category.ranked.findIndex((row) => row.countryId === id) + 1;
      const bestGlobalRank = category.ranked.findIndex((row) => row.countryId === bankRows[0]!.country.id) + 1;
      return {
        category,
        country,
        rank,
        globalRank,
        points,
        value: selectedObservation.value,
        best: bankRows[0]!.country,
        bestValue: bestObservation.value,
        bestGlobalRank,
      };
    });
    setScores(rows.sort((a, b) => b.points - a.points));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const total = scores?.reduce((sum, row) => sum + row.points, 0) ?? 0;

  return <div className={`shell ${round && !scores ? "activePlay" : ""}`}>
    <header>
      <div className="brand"><span className="logo">🌍</span><div><h1>Geo: Second Coming</h1><p>Geography, with strategy.</p></div></div>
      <div className="headerButtons"><button onClick={() => setShowRules(true)}>How it works</button><button onClick={() => playDaily()} disabled={!countries.length}>Daily</button><button onClick={() => playRandom()} disabled={!countries.length}>Random</button></div>
    </header>

    <section className="challengeBar">
      <div><span className="kicker">{mode === "daily" ? "Daily challenge" : "Seeded challenge"}</span><strong>{mode === "daily" ? seed.replace("DAILY-", "") : seed}</strong></div>
      <button onClick={copyChallenge} disabled={!round}>{copied ? "Link copied ✓" : "Copy challenge link"}</button>
    </section>

    <section className="hero">
      <div><span className="kicker">Official-data beta</span><h2>Ten countries. Eight categories. You choose where every country goes.</h2><p>Every random link is reproducible, and the daily challenge is identical for everyone. Eight different countries are the best pool choice for the eight categories; the other two are decoys.</p></div>
      <aside><strong>{Object.keys(assignments).length}/8</strong><span>categories assigned</span></aside>
    </section>

    {status && <div className="loading"><div className="spinner"/><strong>{status}</strong><span>World Bank indicators can take a few seconds to load the first time.</span></div>}
    {error && <div className="error"><strong>Couldn’t generate this round.</strong><span>{error}</span><button onClick={() => mode === "daily" ? playDaily() : loadRound(seed || randomSeed(), "random")}>Try again</button></div>}

    {round && !scores && <main className="grid playGrid">
      <section className="panel bankPanel"><div className="panelTitle"><div><span className="kicker">Country bank</span><h3>Choose your 8</h3></div><small>Two will remain unused</small></div>
        <div className="countries">{round.bank.map((country) => <button key={country.id} draggable={!used.has(country.id)} onDragStart={(event)=>event.dataTransfer.setData("text/plain", country.id)} onTouchStart={(event)=>beginTouch(event,country.id)} onTouchMove={moveTouch} onTouchEnd={endTouch} onTouchCancel={endTouch} className={`country ${selected===country.id?"selected":""} ${used.has(country.id)?"used":""}`} disabled={used.has(country.id)} onClick={() => setSelected(selected===country.id?null:country.id)}><span>{country.flag}</span><div><strong>{country.name}</strong></div>{used.has(country.id)&&<b>USED</b>}</button>)}</div>
      </section>
      <section className="panel boardPanel"><div className="panelTitle"><div><span className="kicker">Draft board</span><h3>Match countries to categories</h3></div><small>One use per country</small></div>
        <div className="slots">{round.categories.map((dataset) => { const c = round.bank.find((x)=>x.id===assignments[dataset.category.id]); return <button key={dataset.category.id} data-category-id={dataset.category.id} className={`slot ${selected&&!c?"target":""} ${touchDrag?.targetCategoryId===dataset.category.id?"touchTarget":""}`} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();const dropped=event.dataTransfer.getData("text/plain");if(dropped)assignCountry(dataset.category.id,dropped)}} onClick={()=>assign(dataset.category.id)}><div className="category"><span>{dataset.category.icon}</span><div><strong>{dataset.category.name}</strong><small>{dataset.category.description}</small></div></div><div className="choice">{c?<><span>{c.flag}</span><strong>{c.name}</strong><i onClick={(e)=>{e.stopPropagation();setAssignments((a)=>{const n={...a};delete n[dataset.category.id];return n;});}}>×</i></>:<em>{selected?"Place selected country":"Select a country"}</em>}</div><footer>World Bank · latest available data</footer></button>})}</div>
        <div className="lock"><span>{8-Object.keys(assignments).length>0?`${8-Object.keys(assignments).length} selections remaining`:"Draft complete"}</span><button disabled={Object.keys(assignments).length!==8} onClick={score}>Lock in draft</button></div>
      </section>
    </main>}

    {round && scores && <section className="panel results"><div className="score"><span>Final score</span><strong>{total}</strong><p>{total>=650?"Elite allocation.":total>=520?"Strong draft with room to optimize.":"A few specialists were spent in the wrong places."}</p><button className="shareScore" onClick={copyChallenge}>{copied ? "Challenge link copied ✓" : "Challenge a friend"}</button></div>
      <div className="resultsHeading"><div><span className="kicker">Your draft</span><h3>How each placement scored</h3></div><small>Hover or tap a stat for its global World Bank rank</small></div>
      {scores.map((row)=><div className="result" key={row.category.category.id}><div><span>{row.category.category.icon}</span><div><strong>{row.category.category.name}</strong><small className="statTip" tabIndex={0}>{row.country.flag} {row.country.name} · {formatValue(row.value,row.category.category)} · Data year {row.category.ranked.find(o=>o.countryId===row.country.id)?.year}<span className="tooltip">World Bank list: #{row.globalRank} globally<br/>Actual value: {formatValue(row.value,row.category.category)}</span></small></div></div><b>#{row.rank} / 10</b><strong>{row.points} pts</strong></div>)}
      <div className="perfect"><div className="resultsHeading"><div><span className="kicker">Perfect answer</span><h3>The 800-point allocation</h3></div><small>Each category’s best country among these ten</small></div>
      <div className="perfectGrid">{scores.map((row)=><div className="perfectRow" key={`perfect-${row.category.category.id}`}><span>{row.category.category.icon}</span><div><strong>{row.category.category.name}</strong><small className="statTip" tabIndex={0}>{row.best.flag} {row.best.name} · {formatValue(row.bestValue,row.category.category)}<span className="tooltip">World Bank list: #{row.bestGlobalRank} globally<br/>Actual value: {formatValue(row.bestValue,row.category.category)}</span></small></div><b>100 pts</b></div>)}</div></div>
      <div className="lock"><span>Maximum score: 800</span><div className="resultActions"><button onClick={()=>playDaily()}>Daily challenge</button><button onClick={()=>playRandom()}>New random round</button></div></div></section>}

    {touchDrag && round && <div className="touchGhost" style={{ left: touchDrag.x, top: touchDrag.y }}><span>{round.bank.find((country)=>country.id===touchDrag.countryId)?.flag}</span><strong>{round.bank.find((country)=>country.id===touchDrag.countryId)?.name}</strong></div>}

    <section className="dataNote"><strong>Current data library: {CATEGORIES.length} official categories</strong><p>Population, economy, land, rainfall, agriculture, forests, energy, health, education, labor, transport, technology, and environment. Food-specific categories such as cheese, bread, meat, livestock, and wildfire statistics require separate FAO and satellite datasets and are reserved for the next data expansion so their definitions remain accurate.</p></section>

    {showRules&&<div className="modal" onClick={(e)=>e.currentTarget===e.target&&setShowRules(false)}><div><h2>How Geo: Second Coming works</h2><ol><li>Choose the shared daily challenge or generate a random challenge with its own shareable seed.</li><li>Eight categories are selected deterministically from that seed, with no more than two from the same subject family.</li><li>Each category winner is drawn from that category’s global top 100.</li><li>Within the ten-country pool, eight different countries are each #1 for exactly one of the eight categories. The other two are decoys.</li><li>Assign eight countries and discard two. Each country can be used once.</li><li>Anyone opening the same challenge link receives the same categories, countries, and category order.</li></ol><p>All enabled category values are loaded from World Bank World Development Indicators. The daily challenge changes at midnight UTC.</p><button onClick={()=>setShowRules(false)}>Start drafting</button></div></div>}
  </div>;
}
