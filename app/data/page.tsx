import { CATEGORIES } from "../../lib/categories";
import { DATASET_VERSION, RULES_VERSION } from "../../lib/version";
import { sourceUrl } from "../../lib/dataEngine";
import { SOURCE_REGISTRY } from "../../lib/sourceRegistry";

export default function DataPage(){return <main style={{maxWidth:1000,margin:"40px auto",padding:20}}>
  <h1>Data & methodology</h1>
  <p>Dataset release: {DATASET_VERSION}. Rules version: {RULES_VERSION}. Each category uses one documented indicator from one authoritative source. Only observations from 2022 onward are accepted. A category is automatically excluded from playable rounds when its 2022+ observations do not meet the configured country-coverage floor.</p>
  <p>The source-agnostic engine supports World Bank WDI, FAOSTAT QCL, WHO, UNESCO UIS, and UN Tourism. WHO, UNESCO, and UN Tourism series are official source-agency indicators distributed through the World Bank WDI API, avoiding blended values from competing mirrors. Every adapter rejects contradictory country-year duplicates and pre-2022 observations. Natural Earth is registered for future use, but has no playable categories because timeless geometry does not satisfy the annual 2022+ rule.</p>
  <p><a href="/">Back to game</a> · <a href="/audit">Open audit page</a></p>
  {CATEGORIES.map(c=><section key={c.id} style={{padding:"14px 0",borderBottom:"1px solid #333"}}>
    <h2>{c.icon} {c.name}</h2><p>{c.description}</p>
    <code>{c.indicator}</code> · {c.direction === "high" ? "highest wins" : "lowest wins"} · {c.unit}<br/>
    <small>{SOURCE_REGISTRY[c.source].name} · certification {c.certificationGrade} · minimum 2022+ coverage {c.coverageFloor}</small><br/>
    <a href={sourceUrl(c.indicator,c.source)} target="_blank" rel="noreferrer">Official source ↗</a>
  </section>)}
</main>}
