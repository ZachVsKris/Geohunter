import { CATEGORIES } from "../../lib/categories";
import { DATASET_VERSION, RULES_VERSION } from "../../lib/version";
import { sourceUrl } from "../../lib/dataEngine";
import { SOURCE_REGISTRY } from "../../lib/sourceRegistry";

export default function DataPage(){return <main style={{maxWidth:1000,margin:"40px auto",padding:20}}>
  <h1>Data & methodology</h1>
  <p>Dataset release: {DATASET_VERSION}. Rules version: {RULES_VERSION}. Each category uses one documented indicator from one authoritative source. Only observations from 2022 onward are accepted. A category is automatically excluded from playable rounds when its 2022+ observations do not meet the configured country-coverage floor.</p>
  <p>This experimental build keeps the original fast v9 World Bank category set and adds 20 FAOSTAT food-production categories. It is designed to isolate whether FAOSTAT requests or the expanded World Bank library causes the slowdown.</p>
  <p><a href="/">Back to game</a> · <a href="/audit">Open audit page</a></p>
  {CATEGORIES.map(c=><section key={c.id} style={{padding:"14px 0",borderBottom:"1px solid #333"}}>
    <h2>{c.icon} {c.name}</h2><p>{c.description}</p>
    <code>{c.indicator}</code> · {c.direction === "high" ? "highest wins" : "lowest wins"} · {c.unit}<br/>
    <small>{SOURCE_REGISTRY[c.source].name} · certification {c.certificationGrade} · minimum 2022+ coverage {c.coverageFloor}</small><br/>
    <a href={sourceUrl(c.indicator,c.source)} target="_blank" rel="noreferrer">Official source ↗</a>
  </section>)}
</main>}
