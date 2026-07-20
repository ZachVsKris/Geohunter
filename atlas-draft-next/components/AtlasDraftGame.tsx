"use client";

import { useMemo, useState } from "react";
import { categories, countries, type Category, type CategoryKey, type Country } from "../lib/gameData";

type Assignments = Partial<Record<CategoryKey, number>>;
type ResultRow = { category: Category; pick: Country; rank: number; points: number; best: Country };

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function createRound() {
  return {
    bank: shuffle(countries).slice(0, 10),
    roundCategories: shuffle(categories).slice(0, 8),
  };
}

function formatValue(value: number, category: Category) {
  if (category.key === "gdp" || category.key === "area") {
    return `${value.toFixed(value < 1 ? 3 : 2)} ${category.unit}`;
  }
  return `${value.toLocaleString()} ${category.unit}`;
}

export default function AtlasDraftGame() {
  const [round, setRound] = useState(createRound);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [showHow, setShowHow] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);

  const assignedCount = Object.keys(assignments).length;
  const usedCountries = useMemo(() => new Set(Object.values(assignments)), [assignments]);
  const totalScore = results?.reduce((sum, row) => sum + row.points, 0) ?? 0;

  function startNewRound() {
    setRound(createRound());
    setAssignments({});
    setSelected(null);
    setResults(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function assign(categoryKey: CategoryKey) {
    if (selected === null || assignments[categoryKey] !== undefined) return;
    setAssignments((current) => ({ ...current, [categoryKey]: selected }));
    setSelected(null);
  }

  function remove(categoryKey: CategoryKey) {
    setAssignments((current) => {
      const next = { ...current };
      delete next[categoryKey];
      return next;
    });
  }

  function scoreRound() {
    if (assignedCount !== 8) return;
    const scored = round.roundCategories.map((category) => {
      const index = assignments[category.key];
      if (index === undefined) throw new Error("Draft is incomplete");
      const pick = round.bank[index];
      const ranked = [...round.bank].sort((a, b) => b[category.key] - a[category.key]);
      const rank = ranked.findIndex((country) => country.name === pick.name) + 1;
      const points = Math.round(100 - ((rank - 1) * 90) / 9);
      return { category, pick, rank, points, best: ranked[0] };
    });
    setResults(scored.sort((a, b) => b.points - a.points));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const scoreMessage =
    totalScore >= 680
      ? "Masterful allocation. You squeezed nearly everything from the bank."
      : totalScore >= 560
        ? "Strong draft. A few sharper allocations could push this into elite territory."
        : totalScore >= 430
          ? "Solid instincts, but some premium countries were spent in the wrong places."
          : "The map fought back. Try saving your specialists for the categories they dominate.";

  return (
    <div className="shell">
      <header>
        <div className="brand">
          <div className="mark">🌍</div>
          <div><h1>Atlas Draft</h1><small>Geography, with strategy.</small></div>
        </div>
        <div className="top-actions">
          <button className="btn" onClick={() => setShowHow(true)}>How to play</button>
          <button className="btn" onClick={startNewRound}>New round</button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-card">
          <div className="eyebrow">The strategic geography game</div>
          <h2>Ten countries.<br />Eight categories.<br />No excuses.</h2>
          <p>Draft the best country for each statistical category. Every country can be used once, so save your powerhouses for where they matter most.</p>
        </div>
        <div className="stats">
          <div className="stat-card"><span>Assigned</span><strong>{assignedCount}/8</strong></div>
          <div className="stat-card"><span>Unused</span><strong>{10 - assignedCount}</strong></div>
          <div className="stat-card full"><span>Draft progress</span><div className="progress"><i style={{ width: `${(assignedCount / 8) * 100}%` }} /></div></div>
        </div>
      </section>

      {!results ? (
        <main className="game">
          <section className="panel">
            <div className="panel-head"><div><h3>Country bank</h3><p>Select a country, then choose its slot.</p></div></div>
            <div className="country-bank">
              {round.bank.map((country, index) => {
                const used = usedCountries.has(index);
                return (
                  <button
                    key={country.name}
                    className={`country ${selected === index ? "selected" : ""} ${used ? "used" : ""}`}
                    onClick={() => !used && setSelected(selected === index ? null : index)}
                    disabled={used}
                  >
                    <span className="flag">{country.flag}</span>
                    <span><span className="country-name">{country.name}</span><span className="region">{country.region}</span></span>
                    {used && <span className="pick-badge">DRAFTED</span>}
                  </button>
                );
              })}
            </div>
            <div className="instructions">Tip: A country that dominates one category may still be your second-best choice elsewhere. The puzzle is allocation, not luck.</div>
          </section>

          <section className="panel">
            <div className="panel-head"><div><h3>Your draft board</h3><p>Categories change every round.</p></div></div>
            <div className="slots">
              {round.roundCategories.map((category) => {
                const index = assignments[category.key];
                const country = index === undefined ? null : round.bank[index];
                return (
                  <button key={category.key} className={`slot ${selected !== null && !country ? "target" : ""}`} onClick={() => assign(category.key)}>
                    {country && <span className="remove" role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); remove(category.key); }}>×</span>}
                    <span className="slot-label"><span className="slot-icon">{category.icon}</span>{category.name}</span>
                    <span className="slot-country">
                      {country ? <>{country.flag} {country.name}<small>Assigned to {category.name}</small></> : <span className="placeholder">Choose a country</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="footer-action">
              <span className="unused">{assignedCount === 8 ? "Two countries held back" : `Choose ${8 - assignedCount} more ${8 - assignedCount === 1 ? "country" : "countries"}`}</span>
              <button className="btn primary" disabled={assignedCount !== 8} onClick={scoreRound}>Lock in draft</button>
            </div>
          </section>
        </main>
      ) : (
        <section className="results panel show">
          <div className="score-hero"><div className="eyebrow">Final draft score</div><div className="big">{totalScore}</div><p>{scoreMessage}</p></div>
          <div className="result-list">
            {results.map((row) => (
              <div className="result-row" key={row.category.key}>
                <div><strong>{row.category.icon} {row.category.name}: {row.pick.flag} {row.pick.name}</strong><small>{formatValue(row.pick[row.category.key], row.category)} · Best available: {row.best.flag} {row.best.name}</small></div>
                <div><small>{row.points} points</small></div>
                <div className={`rank ${row.rank <= 3 ? "good" : row.rank <= 6 ? "mid" : "low"}`}>#{row.rank} / 10</div>
              </div>
            ))}
          </div>
          <div className="footer-action"><button className="btn primary" onClick={startNewRound}>Play another round</button></div>
        </section>
      )}

      {showHow && (
        <div className="modal show" onClick={(event) => event.currentTarget === event.target && setShowHow(false)}>
          <div className="modal-card"><h2>How to play</h2><ol><li>You receive a random bank of 10 countries and eight statistical categories.</li><li>Assign exactly one country to each category. A country can only be used once.</li><li>Two countries will remain unused.</li><li>Your pick earns points based on where it ranks among the 10 countries in that category.</li></ol><p>A category winner earns 100 points. Lower-ranked choices earn progressively fewer points. The maximum score is 800.</p><button className="btn primary" onClick={() => setShowHow(false)}>Start drafting</button></div>
        </div>
      )}
    </div>
  );
}
