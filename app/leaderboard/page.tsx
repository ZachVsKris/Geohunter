import LeaderboardView from "../../components/LeaderboardView";
import AccountControls from "../../components/AccountControls";

export const metadata = { title: "Leaderboard | GeoStats" };

export default function LeaderboardPage() {
  return <main className="shell standalonePage">
    <header>
      <a href="/daily" className="brand brandLink"><span className="logo">🌍</span><div><h1>GeoStats</h1><p>Geography, with strategy.</p></div></a>
      <div className="headerButtons"><a className="headerButtonLink" href="/daily/easy">Easy Daily</a><a className="headerButtonLink" href="/daily">Normal Daily</a><a className="headerButtonLink" href="/daily/expert">Expert Daily</a><AccountControls /></div>
    </header>
    <LeaderboardView />
  </main>;
}
