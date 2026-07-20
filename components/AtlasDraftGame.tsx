"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, type Category } from "../lib/categories";
import { fetchCategory, fetchCountries, type CategoryDataset, type CountryInfo } from "../lib/worldBank";

type RoundCategory = CategoryDataset & { ranked: CategoryDataset["observations"] };
type Round = { bank: CountryInfo[]; categories: RoundCategory[] };
type Assignment = Record<string, string>;
type ScoreRow = { category: RoundCategory; country: CountryInfo; rank: number; points: number; value: number; best: CountryInfo | null };

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

async function buildRound(countryList: CountryInfo[]): Promise<Round> {
  const chosen: RoundCategory[] = [];
  const familyCounts = new Map<string, number>();
  const shuffledCategories = shuffle(CATEGORIES);

  for (const category of shuffledCategories) {
    if ((familyCounts.get(category.family) ?? 0) >= 2) continue;
    try {
      const dataset = await fetchCategory(category);
      const ranked = rankRows(dataset).filter((o) => countryList.some((c) => c.id === o.countryId));
      if (ranked.length < 100) continue;
      chosen.push({ ...dataset, ranked });
      familyCounts.set(category.family, (familyCounts.get(category.family) ?? 0) + 1);
      if (chosen.length === 8) break;
    } catch {
      // Skip temporarily unavailable indicators and keep selecting.
    }
  }

  if (chosen.length < 8) throw new Error("Not enough official datasets were available to generate a round. Please try again.");

  const byId = new Map(countryList.map((country) => [country.id, country]));
  const selectedIds = new Set<string>();

  // Guarantee each category has at least one globally top-100 country in the bank.
  for (const category of shuffle(chosen)) {
    const candidates = category.ranked.slice(0, 100).filter((row) => byId.has(row.countryId));
    if (candidates.some((row) => selectedIds.has(row.countryId))) continue;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (pick) selectedIds.add(pick.countryId);
  }

  const eligible = countryList.filter((country) => chosen.every((category) => category.ranked.some((row) => row.countryId === country.id)));
  for (const country of shuffle(eligible)) {
    if (selectedIds.size >= 10) break;
    selectedIds.add(country.id);
  }

  // If strict all-category coverage leaves fewer than 10, fill from countries with data in at least 6 categories.
  if (selectedIds.size < 10) {
    const broad = countryList.filter((country) => chosen.filter((category) => category.ranked.some((row) => row.countryId === country.id)).length >= 6);
    for (const country of shuffle(broad)) {
      if (selectedIds.size >= 10) break;
      selectedIds.add(country.id);
    }
  }

  const bank = shuffle([...selectedIds].slice(0, 10).map((id) => byId.get(id)!).filter(Boolean));
  if (bank.length < 10) throw new Error("The official datasets did not contain enough overlapping countries for this round.");
  return { bank, categories: chosen };
}

export default function AtlasDraftGame() {
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [assignments, setAssignments] = useState<Assignment>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreRow[] | null>(null);
  const [status, setStatus] = useState("Loading official country data…");
  const [error, setError] = useState("");
  const [showRules, setShowRules] = useState(false);

  const used = useMemo(() => new Set(Object.values(assignments)), [assignments]);

  async function newRound(existingCountries = countries) {
    setError("");
    setRound(null);
    setScores(null);
    setAssignments({});
    setSelected(null);
    setStatus("Selecting eight official datasets and building a fair country bank…");
    try {
      const generated = await buildRound(existingCountries);
      setRound(generated);
      setStatus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The round could not be generated.");
      setStatus("");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchCountries();
        setCountries(list);
        await newRound(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Official data could not be loaded.");
        setStatus("");
      }
    })();
  }, []);

  function assign(categoryId: string) {
    if (!selected) return;
    setAssignments((current) => {
      const next = { ...current };
      for (const key of Object.keys(next)) if (next[key] === selected) delete next[key];
      next[categoryId] = selected;
      return next;
    });
    setSelected(null);
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
      const points = Math.round(100 - ((Math.max(rank, 1) - 1) * 90) / Math.max(bankRows.length - 1, 1));
      return { category, country, rank, points, value: bankRows.find((x) => x.country.id === id)!.observation!.value, best: bankRows[0]?.country ?? null };
    });
    setScores(rows.sort((a, b) => b.points - a.points));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const total = scores?.reduce((sum, row) => sum + row.points, 0) ?? 0;

  return <div className="shell">
    <header>
      <div className="brand"><span className="logo">🌍</span><div><h1>Atlas Draft</h1><p>Geography, with strategy.</p></div></div>
      <div className="headerButtons"><button onClick={() => setShowRules(true)}>How it works</button><button onClick={() => newRound()} disabled={!countries.length}>New round</button></div>
    </header>

    <section className="hero">
      <div><span className="kicker">Official-data beta</span><h2>Ten countries. Eight categories. You choose where every country goes.</h2><p>Each round is random, but never arbitrary: every category is guaranteed to have at least one globally top-100 country in your bank.</p></div>
      <aside><strong>{Object.keys(assignments).length}/8</strong><span>categories assigned</span></aside>
    </section>

    {status && <div className="loading"><div className="spinner"/><strong>{status}</strong><span>World Bank indicators can take a few seconds to load the first time.</span></div>}
    {error && <div className="error"><strong>Couldn’t generate this round.</strong><span>{error}</span><button onClick={() => newRound()}>Try again</button></div>}

    {round && !scores && <main className="grid">
      <section className="panel"><div className="panelTitle"><div><span className="kicker">Country bank</span><h3>Choose your ten</h3></div><small>Two will remain unused</small></div>
        <div className="countries">{round.bank.map((country) => <button key={country.id} className={`country ${selected===country.id?"selected":""} ${used.has(country.id)?"used":""}`} disabled={used.has(country.id)} onClick={() => setSelected(selected===country.id?null:country.id)}><span>{country.flag}</span><div><strong>{country.name}</strong><small>{country.region}</small></div>{used.has(country.id)&&<b>USED</b>}</button>)}</div>
      </section>
      <section className="panel"><div className="panelTitle"><div><span className="kicker">Draft board</span><h3>Allocate your countries</h3></div><small>One use per country</small></div>
        <div className="slots">{round.categories.map((dataset) => { const c = round.bank.find((x)=>x.id===assignments[dataset.category.id]); return <button key={dataset.category.id} className={`slot ${selected&&!c?"target":""}`} onClick={()=>assign(dataset.category.id)}><div className="category"><span>{dataset.category.icon}</span><div><strong>{dataset.category.name}</strong><small>{dataset.category.description}</small></div></div><div className="choice">{c?<><span>{c.flag}</span><strong>{c.name}</strong><i onClick={(e)=>{e.stopPropagation();setAssignments((a)=>{const n={...a};delete n[dataset.category.id];return n;});}}>×</i></>:<em>{selected?"Place selected country":"Select a country"}</em>}</div><footer>World Bank · latest available data</footer></button>})}</div>
        <div className="lock"><span>{8-Object.keys(assignments).length>0?`${8-Object.keys(assignments).length} selections remaining`:"Draft complete"}</span><button disabled={Object.keys(assignments).length!==8} onClick={score}>Lock in draft</button></div>
      </section>
    </main>}

    {round && scores && <section className="panel results"><div className="score"><span>Final score</span><strong>{total}</strong><p>{total>=650?"Elite allocation.":total>=520?"Strong draft with room to optimize.":"A few specialists were spent in the wrong places."}</p></div>{scores.map((row)=><div className="result" key={row.category.category.id}><div><span>{row.category.category.icon}</span><div><strong>{row.category.category.name}</strong><small>{row.country.flag} {row.country.name} · {formatValue(row.value,row.category.category)} · Data year {row.category.ranked.find(o=>o.countryId===row.country.id)?.year}</small></div></div><b>#{row.rank} / 10</b><strong>{row.points} pts</strong></div>)}<div className="lock"><span>Maximum score: 800</span><button onClick={()=>newRound()}>Play another round</button></div></section>}

    <section className="dataNote"><strong>Current data library: {CATEGORIES.length} official categories</strong><p>Population, economy, land, rainfall, agriculture, forests, energy, health, education, labor, transport, technology, and environment. Food-specific categories such as cheese, bread, meat, livestock, and wildfire statistics require separate FAO and satellite datasets and are reserved for the next data expansion so their definitions remain accurate.</p></section>

    {showRules&&<div className="modal" onClick={(e)=>e.currentTarget===e.target&&setShowRules(false)}><div><h2>How Atlas Draft works</h2><ol><li>Eight categories are selected randomly, with no more than two from the same subject family.</li><li>For each category, the generator guarantees at least one country from that category’s global top 100.</li><li>The remaining bank slots are filled randomly from countries with adequate data coverage.</li><li>Assign eight countries and discard two. Each country can be used once.</li><li>Your score is based on your chosen country’s rank among the ten countries in the bank.</li></ol><p>All enabled category values are loaded from World Bank World Development Indicators. Each result displays the observation year actually used.</p><button onClick={()=>setShowRules(false)}>Start drafting</button></div></div>}
  </div>;
}
