import Link from "next/link";
import { CATEGORIES } from "../../lib/categories";
import { categorySourceUrl } from "../../lib/sourceRegistry";

export default function DataPage() {
  return <main className="legalPage">
    <Link href="/">← Back to game</Link>
    <h1>Data & methodology</h1>
    <p>Geo: Second Coming uses World Bank World Development Indicators as its single authoritative source. Every playable category applies the same recency, coverage, contradiction, tie, and ranking rules.</p>
    <p>Country observations before 2022 are excluded. Categories that cannot meet their stated coverage floor after that filter are not playable. Rankings use the latest qualifying observation for each country, while categories marked as common-year comparisons require the same year across the ten-country pool.</p>
    <h2>Verified category library ({CATEGORIES.length})</h2>
    <div className="auditList">{CATEGORIES.map((c) => <article key={c.id}>
      <h3>{c.icon} {c.name}</h3>
      <p>{c.description}</p>
      <small>World Bank WDI · certification {c.certificationGrade} · 2022+ coverage floor {c.coverageFloor}</small><br/>
      <a href={categorySourceUrl("worldbank", c.indicator)} target="_blank" rel="noreferrer">Open indicator {c.indicator} ↗</a>
    </article>)}</div>
  </main>;
}
