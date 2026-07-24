import type { Category } from "./categories";
import type { CategoryDataset } from "./worldBank";
import { UN_RECOGNIZED_COUNTRY_COUNT } from "./playableCountries";

export type CategoryQuality = { score:number; eligible:boolean; coverage:number; coverageScore:number; freshnessScore:number; variationScore:number; reliabilityScore:number; latestYear:number|null };

function clamp(value:number,min=0,max=1){return Math.max(min,Math.min(max,value));}

export function scoreCategoryQuality(dataset: CategoryDataset, nowYear=new Date().getUTCFullYear()): CategoryQuality {
  const values=dataset.observations.map(row=>row.value).filter(Number.isFinite);
  const years=dataset.observations.map(row=>Number(row.year)).filter(Number.isFinite);
  const coverage=values.length;
  const coverageScore=Math.round(45*clamp(coverage/UN_RECOGNIZED_COUNTRY_COUNT));
  const latestYear=years.length?Math.max(...years):null;
  const age=latestYear===null?99:Math.max(0,nowYear-latestYear);
  const freshnessScore=age<=1?25:age===2?21:age===3?16:age===4?10:age===5?5:0;
  const sorted=[...values].sort((a,b)=>a-b);
  const distinctRatio=values.length?new Set(values.map(v=>Number(v.toPrecision(10)))).size/values.length:0;
  const q10=sorted[Math.floor(sorted.length*.1)]??0; const q90=sorted[Math.floor(sorted.length*.9)]??0;
  const median=Math.abs(sorted[Math.floor(sorted.length*.5)]??0);
  const spread=Math.abs(q90-q10);
  const spreadSignal=spread===0?0:clamp(spread/(median+spread));
  const variationScore=Math.round(20*clamp(.55*distinctRatio+.45*spreadSignal));
  const grade=dataset.category.certificationGrade??"A";
  const reliabilityScore=grade==="A"?10:grade==="B"?7:4;
  const score=Math.min(100,coverageScore+freshnessScore+variationScore+reliabilityScore);
  const floor=Math.max(175,dataset.category.coverageFloor??0);
  return {score,eligible:score>=80&&coverage>=floor,coverage,coverageScore,freshnessScore,variationScore,reliabilityScore,latestYear};
}

export function runtimeQualityScore(category: Category, coverage:number, latestYear:number|null, variation=0.8){
 const coverageScore=45*clamp(coverage/UN_RECOGNIZED_COUNTRY_COUNT); const age=latestYear===null?99:Math.max(0,new Date().getUTCFullYear()-latestYear);
 const freshness=age<=1?25:age===2?21:age===3?16:age===4?10:age===5?5:0; const reliability=(category.certificationGrade??"A")==="A"?10:7;
 return Math.round(Math.min(100,coverageScore+freshness+20*clamp(variation)+reliability));
}
