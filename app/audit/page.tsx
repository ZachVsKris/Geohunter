import { CATEGORIES } from "../../lib/categories";
import { sourceUrl } from "../../lib/dataEngine";

export default function AuditPage() {
  return <main style={{maxWidth:1200,margin:"0 auto",padding:"32px 20px",color:"#f4f7ef"}}>
    <a href="/" style={{color:"#b9f45a"}}>← Back to game</a>
    <h1>Data audit</h1>
    <p>Every category is defined once. Display values, pool ranks, scores, perfect answers, and global ranks are derived from the same World Bank observation object.</p>
    <div style={{display:"grid",gap:12}}>
      {CATEGORIES.map((category)=><article key={category.id} style={{border:"1px solid #294a3d",borderRadius:14,padding:16,background:"#0c211a"}}>
        <strong>{category.icon} {category.name}</strong>
        <div style={{opacity:.8,marginTop:6}}>{category.description}</div>
        <code style={{display:"inline-block",marginTop:10}}>{category.indicator}</code>
        <div><a href={sourceUrl(category.indicator)} target="_blank" rel="noreferrer" style={{color:"#b9f45a"}}>Open official World Bank list ↗</a></div>
      </article>)}
    </div>
  </main>;
}
