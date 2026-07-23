"use client";

import { useEffect, useState } from "react";

type TodayLeader = { username: string; displayName: string | null; score: number; averagePlacement: number; firsts: number; topThrees: number };
type AllTimeLeader = { username: string; displayName: string | null; games: number; average: number; rating: number };

export default function LeaderboardView() {
  const [tab, setTab] = useState<"today" | "alltime">("today");
  const [today, setToday] = useState<TodayLeader[]>([]);
  const [alltime, setAlltime] = useState<AllTimeLeader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?view=${tab}`)
      .then((response) => response.json())
      .then((data) => tab === "today" ? setToday(data.leaders ?? []) : setAlltime(data.leaders ?? []))
      .catch(() => tab === "today" ? setToday([]) : setAlltime([]))
      .finally(() => setLoading(false));
  }, [tab]);

  const rows = tab === "today" ? today : alltime;
  return <section className="leaderboardPage panel">
    <div className="leaderboardPageIntro">
      <span className="kicker">Daily competition</span>
      <h1>Leaderboard</h1>
      <p>Daily games only. Scores are verified against the saved challenge board. All-time standings use the current 600-point format.</p>
    </div>
    <div className="leaderboardTabs" role="tablist">
      <button className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}>Today</button>
      <button className={tab === "alltime" ? "active" : ""} onClick={() => setTab("alltime")}>All time</button>
    </div>
    {loading ? <div className="leaderboardEmpty">Loading leaderboard…</div> : rows.length ? <div className="publicLeaderboard">
      <div className="publicLeaderboardHeader"><span>#</span><span>Player</span>{tab === "today" ? <><span>Score</span><span>Avg. place</span><span>Top 3</span></> : <><span>Average</span><span>Dailies</span><span>Rating</span></>}</div>
      {tab === "today" ? today.map((leader, index) => <div key={`${leader.username}-${index}`}><b>{index + 1}</b><span>{leader.displayName || leader.username}</span><strong>{leader.score}</strong><span>{leader.averagePlacement.toFixed(1)}</span><span>{leader.topThrees}</span></div>) : alltime.map((leader, index) => <div key={leader.username}><b>{index + 1}</b><span>{leader.displayName || leader.username}</span><strong>{leader.average}</strong><span>{leader.games}</span><span>{leader.rating}</span></div>)}
    </div> : <div className="leaderboardEmpty">{tab === "today" ? "No verified scores yet today." : "No one has qualified yet. Five completed Dailies are required."}</div>}
    <div className="leaderboardPageActions"><a href="/daily">Play today’s Daily</a></div>
  </section>;
}
