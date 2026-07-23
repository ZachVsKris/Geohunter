import LeaderboardView from "../../components/LeaderboardView";
import AccountControls from "../../components/AccountControls";

export const metadata = { title: "Leaderboard | GeoStats" };

export default function LeaderboardPage() {
  return <main className="shell standalonePage">
    <header>
      <a href="/daily" className="brand brandLink"><span className="logo">🌍</span><div><h1>GeoStats</h1><p>Geography, with strategy.</p></div></a>
      <div className="headerButtons"><a className="headerButtonLink" href="/daily">Daily</a><AccountControls /></div>
    </header>
    <LeaderboardView />
  </main>;
}
