"use client";

import { useEffect, useState } from "react";
import type { DailyDifficulty } from "../lib/gameRules";

type TodayLeader = { username: string; displayName: string | null; score: number; averagePlacement: number; firsts: number; topFinishes: number };
type AllTimeLeader = { username: string; displayName: string | null; games: number; average: number; averagePlacement: number; rating: number };

export default function LeaderboardView() {
  const [difficulty, setDifficulty] = useState<DailyDifficulty>("easy");
  const [tab, setTab] = useState<"today" | "alltime">("today");
  const [today, setToday] = useState<TodayLeader[]>([]);
  const [alltime, setAlltime] = useState<AllTimeLeader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("difficulty");
    if (requested === "expert") setDifficulty("expert");
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?view=${tab}&difficulty=${difficulty}`)
      .then((response) => response.json())
      .then((data) => tab === "today" ? setToday(data.leaders ?? []) : setAlltime(data.leaders ?? []))
      .catch(() => tab === "today" ? setToday([]) : setAlltime([]))
      .finally(() => setLoading(false));
  }, [tab, difficulty]);

  const rows = tab === "today" ? today : alltime;
  const modeLabel = difficulty === "expert" ? "Expert" : "Normal";
  return <section className="leaderboardPage panel">
    <div className="leaderboardPageIntro">
      <span className="kicker">Daily competition</span>
      <h1>Leaderboard</h1>
      <p>Normal and Expert have separate verified standings. Normal uses 8 countries and 6 categories; Expert uses 10 countries and 8 categories.</p>
    </div>
    <div className="leaderboardModeTabs" role="tablist" aria-label="Daily difficulty">
      <button className={difficulty === "easy" ? "active" : ""} onClick={() => setDifficulty("easy")}>Normal</button>
      <button className={difficulty === "expert" ? "active" : ""} onClick={() => setDifficulty("expert")}>Expert</button>
    </div>
    <div className="leaderboardTabs" role="tablist" aria-label="Leaderboard period">
      <button className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}>Today</button>
      <button className={tab === "alltime" ? "active" : ""} onClick={() => setTab("alltime")}>All time</button>
    </div>
    {loading ? <div className="leaderboardEmpty">Loading {modeLabel} leaderboard…</div> : rows.length ? <div className="publicLeaderboard">
      <div className="publicLeaderboardHeader"><span>#</span><span>Player</span>{tab === "today" ? <><span>Score</span><span>Avg. place</span><span>{difficulty === "expert" ? "Top 5" : "Top 3"}</span></> : <><span>Average</span><span>Dailies</span><span>Rating</span></>}</div>
      {tab === "today" ? today.map((leader, index) => <div key={`${leader.username}-${index}`}><b>{index + 1}</b><span>{leader.displayName || leader.username}</span><strong>{leader.score}</strong><span>{leader.averagePlacement.toFixed(1)}</span><span>{leader.topFinishes}</span></div>) : alltime.map((leader, index) => <div key={leader.username}><b>{index + 1}</b><span>{leader.displayName || leader.username}</span><strong>{leader.average}</strong><span>{leader.games}</span><span>{leader.rating}</span></div>)}
    </div> : <div className="leaderboardEmpty">{tab === "today" ? `No verified ${modeLabel} scores yet today.` : `No one has qualified for the ${modeLabel} leaderboard yet. Five completed Dailies are required.`}</div>}
    <div className="leaderboardPageActions"><a href={difficulty === "expert" ? "/daily/expert" : "/daily"}>Play today’s {modeLabel} Daily</a></div>
  </section>;
}
