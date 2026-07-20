import Link from "next/link";
import { CATEGORIES } from "../../lib/categories";
import { categorySourceUrl } from "../../lib/sourceRegistry";

export default function AuditPage() {
  return <main className="legalPage">
    <Link href="/">← Back to game</Link>
    <h1>Data audit</h1>
    <p>{CATEGORIES.length} playable category definitions, all sourced from World Bank World Development Indicators.</p>
    <div className="auditList">{CATEGORIES.map((category) => <article key={category.id}>
      <h2>{category.icon} {category.name}</h2>
      <p>{category.description}</p>
      <p><strong>World Bank World Development Indicators</strong><br/>Certification: {category.certificationGrade} · 2022+ coverage floor: {category.coverageFloor} countries</p>
      <p>Indicator: <code>{category.indicator}</code> · Direction: {category.direction}</p>
      <a href={categorySourceUrl("worldbank", category.indicator)} target="_blank" rel="noreferrer">View official data source ↗</a>
    </article>)}</div>
  </main>;
}
