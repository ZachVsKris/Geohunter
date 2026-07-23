import { CATEGORIES } from "../../lib/categories";
import { sourceUrl } from "../../lib/dataEngine";
import { SOURCE_REGISTRY } from "../../lib/sourceRegistry";

export default function AuditPage(){
  return <main style={{maxWidth:1100,margin:"40px auto",padding:20}}>
    <h1>Category audit</h1>
    <p>Every playable category is tied to one authoritative source, one indicator, one direction, one unit, and an independent verification path. All accepted observations must be dated 2022 or later. Categories that fail their 2022+ coverage floor are removed from round generation. Natural Earth remains non-playable under this rule.</p>
    <p><a href="/">Back to game</a> · <a href="/data">Data methodology</a></p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
      {CATEGORIES.map((category)=><article key={category.id} style={{border:"1px solid #294a3d",borderRadius:14,padding:16,background:"#0c211a"}}>
        <h2 style={{fontSize:18}}>{category.icon} {category.name}</h2>
        <p>{category.description}</p>
        <p><strong>{SOURCE_REGISTRY[category.source].name}</strong><br/>Certification: {category.certificationGrade} · 2022+ coverage floor: {category.coverageFloor} countries</p>
        <code style={{display:"inline-block",marginTop:10}}>{category.indicator}</code>
        <div><a href={sourceUrl(category.indicator, category.source)} target="_blank" rel="noreferrer" style={{color:"#b9f45a"}}>Open official source ↗</a></div>
      </article>)}
    </div>
  </main>
}
