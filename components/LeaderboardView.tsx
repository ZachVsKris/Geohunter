"use client";

import { useEffect, useState } from "react";
import { ROUND_CONFIGS, type DailyDifficulty } from "../lib/gameRules";

type TodayLeader = { username: string; displayName: string | null; score: number; averagePlacement: number; firsts: number; topFinishes: number };
type AllTimeLeader = { username: string; displayName: string | null; games: number; average: number; averagePlacement: number; rating: number };

function requestedDifficulty(): DailyDifficulty {
  if (typeof window === "undefined") return "normal";
  const value = new URLSearchParams(window.location.search).get("difficulty");
  return value === "easy" || value === "expert" ? value : "normal";
}

export default function LeaderboardView() {
  const [difficulty, setDifficulty] = useState<DailyDifficulty>("normal");
  const [tab, setTab] = useState<"today" | "alltime">("today");
  const [today, setToday] = useState<TodayLeader[]>([]);
  const [alltime, setAlltime] = useState<AllTimeLeader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => setDifficulty(requestedDifficulty()), []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?view=${tab}&difficulty=${difficulty}`)
      .then((response) => response.json())
      .then((data) => tab === "today" ? setToday(data.leaders ?? []) : setAlltime(data.leaders ?? []))
      .catch(() => tab === "today" ? setToday([]) : setAlltime([]))
      .finally(() => setLoading(false));
  }, [tab, difficulty]);

  const rows = tab === "today" ? today : alltime;
  const config = ROUND_CONFIGS[difficulty];
  return <section className="leaderboardPage panel">
    <div className="leaderboardPageIntro">
      <span className="kicker">Daily competition</span>
      <h1>Leaderboard</h1>
      <p>Easy, Normal, and Expert each have separate verified standings.</p>
    </div>
    <div className="leaderboardModeTabs" role="tablist" aria-label="Daily difficulty">
      <button className={difficulty === "easy" ? "active" : ""} onClick={() => setDifficulty("easy")}>Easy</button>
      <button className={difficulty === "normal" ? "active" : ""} onClick={() => setDifficulty("normal")}>Normal</button>
      <button className={difficulty === "expert" ? "active" : ""} onClick={() => setDifficulty("expert")}>Expert</button>
    </div>
    <div className="leaderboardTabs" role="tablist" aria-label="Leaderboard period">
      <button className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}>Today</button>
      <button className={tab === "alltime" ? "active" : ""} onClick={() => setTab("alltime")}>All time</button>
    </div>
    {loading ? <div className="leaderboardEmpty">Loading {config.label} leaderboard…</div> : rows.length ? <div className="publicLeaderboard">
      <div className="publicLeaderboardHeader"><span>#</span><span>Player</span>{tab === "today" ? <><span>Score</span><span>Avg. place</span><span>Top {config.topFinishRank}</span></> : <><span>Average</span><span>Dailies</span><span>Rating</span></>}</div>
      {tab === "today" ? today.map((leader, index) => <div key={`${leader.username}-${index}`}><b>{index + 1}</b><span>{leader.displayName || leader.username}</span><strong>{leader.score}</strong><span>{leader.averagePlacement.toFixed(1)}</span><span>{leader.topFinishes}</span></div>) : alltime.map((leader, index) => <div key={leader.username}><b>{index + 1}</b><span>{leader.displayName || leader.username}</span><strong>{leader.average}</strong><span>{leader.games}</span><span>{leader.rating}</span></div>)}
    </div> : <div className="leaderboardEmpty">{tab === "today" ? `No verified ${config.label} scores yet today.` : `No one has qualified for the ${config.label} leaderboard yet. Five completed Dailies are required.`}</div>}
    <div className="leaderboardPageActions"><a href={config.path}>Play today’s {config.label} Daily</a></div>
  </section>;
}
