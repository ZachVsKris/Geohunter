import { CATEGORIES, type Category } from "./categories";
import { canonicalizeDataset, poolLeaderboard, validateRound } from "./dataEngine";
import { fetchCategory } from "./dataSources";
import { scoreCategoryQuality } from "./categoryQuality";
import type { Round, RoundCategory } from "./challengeCodec";
import type { CountryInfo } from "./worldBank";
import { DAILY_DIFFICULTIES, ROUND_CONFIGS, canAddCategory, measureKind, roundHasRequiredDiversity, roundType, type DailyDifficulty, type RoundConfig } from "./gameRules";

export type DailyTrio = Record<DailyDifficulty, Round>;
export type ScoreBreakdown = { overall:number; quality:number; variety:number; geography:number; difficultyFit:number; competitiveness:number };
export type GenerationDiagnostics = { eligibleDatasets:number; requiredDatasets:number; attempts:number; validCandidates:Record<DailyDifficulty,number>; failureStage?:string; message?:string };
type Rng=()=>number;
function hashSeed(seed:string){let hash=2166136261;for(let i=0;i<seed.length;i++){hash^=seed.charCodeAt(i);hash=Math.imul(hash,16777619);}return hash>>>0;}
function seededRandom(seed:string):Rng{let value=hashSeed(seed);return()=>{value+=0x6d2b79f5;let t=value;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function shuffle<T>(items:T[],rng:Rng){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
function observationValue(category:RoundCategory,countryId:string){return category.byCountry.get(countryId)?.value;}
function isBetter(category:RoundCategory,a:number,b:number){return category.category.direction==="high"?a>b:a<b;}

async function loadCandidateDatasets(seed:string,targetCount=52):Promise<RoundCategory[]>{
 const rng=seededRandom(`${seed}:datasets`); const shuffled=shuffle(CATEGORIES.filter(c=>c.enabled!==false),rng); const loaded:RoundCategory[]=[]; const ids=new Set<string>(); const typeCounts=new Map<string,number>();
 for(let offset=0;offset<shuffled.length&&loaded.length<targetCount;offset+=10){
  const batch=shuffled.slice(offset,offset+10).filter(c=>!ids.has(c.id));
  const results=await Promise.allSettled(batch.map(async c=>canonicalizeDataset(await fetchCategory(c))));
  for(const result of results){if(result.status!=="fulfilled")continue;const d=result.value;const q=scoreCategoryQuality(d);if(!q.eligible)continue;const type=roundType(d.category);if((typeCounts.get(type)??0)>=6)continue;loaded.push(d);ids.add(d.category.id);typeCounts.set(type,(typeCounts.get(type)??0)+1);}
 }
 return loaded;
}
function chooseDiverseCategories(available:RoundCategory[],rng:Rng,config:RoundConfig,forbidden=new Set<string>()){
 const ordered=shuffle(available.filter(d=>!forbidden.has(d.category.id)),rng); const selected:RoundCategory[]=[];
 while(selected.length<config.categoryCount){
  const options=ordered.filter(d=>!selected.includes(d)&&canAddCategory(selected.map(x=>x.category),d.category)); if(!options.length)return null;
  const types=new Set(selected.map(x=>roundType(x.category))); const measures=new Set(selected.map(x=>measureKind(x.category)));
  const scored=options.map(d=>({d,score:(types.has(roundType(d.category))?0:14)+(measures.has(measureKind(d.category))?0:4)+scoreCategoryQuality(d).score/25+rng()})).sort((a,b)=>b.score-a.score);
  selected.push(scored[0].d);
 }
 return roundHasRequiredDiversity(selected.map(d=>d.category),config)?selected:null;
}
function findDistinctWinners(categories:RoundCategory[],countries:CountryInfo[],rng:Rng,config:RoundConfig,overlapBanks:Set<string>[]=[],maxOverlap=Infinity){
 const countryIds=new Set(countries.map(c=>c.id)); const complete=countries.filter(c=>categories.every(cat=>observationValue(cat,c.id)!==undefined)); const completeIds=new Set(complete.map(c=>c.id));
 const candidates=categories.map(cat=>shuffle(cat.ranked.slice(0,120).map(r=>r.countryId).filter(id=>countryIds.has(id)&&completeIds.has(id)),rng)); if(candidates.some(x=>!x.length))return null;
 const order=categories.map((_,i)=>i).sort((a,b)=>candidates[a].length-candidates[b].length); const winners=new Array<string>(categories.length); const used=new Set<string>(); let steps=0;
 const overlapCount=(bank:Set<string>)=>[...used].filter(id=>bank.has(id)).length;
 function search(depth:number):boolean{if(++steps>260000)return false;if(depth===order.length)return true;const ci=order[depth],cat=categories[ci];for(const id of candidates[ci].slice(0,100)){if(used.has(id))continue;if(overlapBanks.some(b=>b.has(id)&&overlapCount(b)>=maxOverlap))continue;const own=observationValue(cat,id);if(own===undefined)continue;let ok=true;for(let p=0;p<depth;p++){const pi=order[p],pc=categories[pi],pid=winners[pi];const pOwn=observationValue(pc,pid),candPrev=observationValue(pc,id),prevCur=observationValue(cat,pid);if(pOwn===undefined||candPrev===undefined||prevCur===undefined||!isBetter(pc,pOwn,candPrev)||!isBetter(cat,own,prevCur)){ok=false;break;}}if(!ok)continue;winners[ci]=id;used.add(id);if(search(depth+1))return true;used.delete(id);winners[ci]="";}return false;}
 if(!search(0))return null;
 const decoys=shuffle(complete,rng).filter(c=>!used.has(c.id)&&categories.every((cat,i)=>{const w=observationValue(cat,winners[i]),v=observationValue(cat,c.id);return w!==undefined&&v!==undefined&&isBetter(cat,w,v);})).sort((a,b)=>overlapBanks.filter(x=>x.has(a.id)).length-overlapBanks.filter(x=>x.has(b.id)).length);
 const picked:string[]=[];const totals=overlapBanks.map(b=>overlapCount(b));for(const c of decoys){if(overlapBanks.some((b,i)=>b.has(c.id)&&totals[i]>=maxOverlap))continue;picked.push(c.id);overlapBanks.forEach((b,i)=>{if(b.has(c.id))totals[i]++;});if(picked.length===config.decoyCount)break;}return picked.length===config.decoyCount?{winners,decoys:picked}:null;
}
export function scoreBoard(round:Round,config:RoundConfig):ScoreBreakdown{
 const qualities=round.categories.map(d=>scoreCategoryQuality(d).score);const quality=qualities.reduce((a,b)=>a+b,0)/Math.max(1,qualities.length);
 const familyCount=new Set(round.categories.map(d=>roundType(d.category))).size;const measureCount=new Set(round.categories.map(d=>measureKind(d.category))).size;const variety=Math.min(100,(familyCount/config.minRoundTypes)*65+(measureCount/Math.min(config.categoryCount,4))*35);
 const regions=new Set(round.bank.map(c=>c.region)).size;const geography=Math.min(100,regions*18);
 const ranks:number[]=[];const gaps:number[]=[];for(const d of round.categories){const lb=poolLeaderboard(d,round.bank);if(!lb.length)continue;ranks.push(lb[0].observation.globalRank);if(lb.length>1){const a=lb[0].observation.value,b=lb[1].observation.value;gaps.push(Math.abs(a-b)/(Math.abs(a)+Math.abs(b)+1e-9));}}
 const avgRank=ranks.reduce((a,b)=>a+b,0)/Math.max(1,ranks.length);const avgGap=gaps.reduce((a,b)=>a+b,0)/Math.max(1,gaps.length);const rankTarget=config.difficulty==="easy"?14:config.difficulty==="normal"?34:58;const gapTarget=config.difficulty==="easy"?.30:config.difficulty==="normal"?.15:.07;
 const difficultyFit=Math.max(0,100-Math.abs(avgRank-rankTarget)*1.4);const competitiveness=Math.max(0,100-Math.abs(avgGap-gapTarget)*260);
 const overall=.30*quality+.20*variety+.15*geography+.20*difficultyFit+.15*competitiveness;
 return {overall:Number(overall.toFixed(1)),quality:Number(quality.toFixed(1)),variety:Number(variety.toFixed(1)),geography:Number(geography.toFixed(1)),difficultyFit:Number(difficultyFit.toFixed(1)),competitiveness:Number(competitiveness.toFixed(1))};
}
function composeRound(available:RoundCategory[],countries:CountryInfo[],seed:string,config:RoundConfig,forbidden=new Set<string>(),overlap:Set<string>[]=[],maxOverlap=Infinity){
 const rng=seededRandom(seed);const attempted=new Set<string>();let best:Round|null=null,bestScore=-Infinity,valid=0;
 for(let attempt=0;attempt<650;attempt++){const cats=chooseDiverseCategories(available,rng,config,forbidden);if(!cats)continue;const sig=cats.map(d=>d.category.id).sort().join("|");if(attempted.has(sig))continue;attempted.add(sig);const solution=findDistinctWinners(cats,countries,rng,config,overlap,maxOverlap);if(!solution)continue;const byId=new Map(countries.map(c=>[c.id,c]));const bank=shuffle([...solution.winners,...solution.decoys].map(id=>byId.get(id)!).filter(Boolean),rng);if(bank.length!==config.countryCount||validateRound(cats,bank).length)continue;const round={bank,categories:cats};const score=scoreBoard(round,config).overall;valid++;if(score>bestScore){bestScore=score;best=round;}if(valid>=60)break;}
 return {round:best,validCandidates:valid};
}
export async function generateDailyTrio(countries:CountryInfo[],date:string,fixed:Partial<DailyTrio>={}):Promise<{trio:DailyTrio;diagnostics:GenerationDiagnostics;scores:Record<DailyDifficulty,ScoreBreakdown>}>{
 const seed=`DAILY-TRIO-${date}`;const available=await loadCandidateDatasets(seed,52);const required=DAILY_DIFFICULTIES.reduce((n,d)=>n+ROUND_CONFIGS[d].categoryCount,0);const diagnostics:GenerationDiagnostics={eligibleDatasets:available.length,requiredDatasets:required,attempts:0,validCandidates:{easy:0,normal:0,expert:0}};
 if(available.length<required){diagnostics.failureStage="dataset-pool";diagnostics.message=`Only ${available.length} Daily-eligible datasets loaded; ${required} are required.`;throw Object.assign(new Error(diagnostics.message),{diagnostics});}
 for(let attempt=0;attempt<110;attempt++){diagnostics.attempts=attempt+1;const rounds:Partial<DailyTrio>={...fixed};for(const difficulty of ["expert","normal","easy"] as DailyDifficulty[]){if(rounds[difficulty])continue;const existing=DAILY_DIFFICULTIES.map(k=>rounds[k]).filter((r):r is Round=>Boolean(r));const forbidden=new Set(existing.flatMap(r=>r.categories.map(d=>d.category.id)));const overlap=existing.map(r=>new Set(r.bank.map(c=>c.id)));const result=composeRound(available,countries,`${seed}:${difficulty}:${attempt}`,ROUND_CONFIGS[difficulty],forbidden,overlap,1);diagnostics.validCandidates[difficulty]+=result.validCandidates;if(!result.round)break;rounds[difficulty]=result.round;}
  if(rounds.easy&&rounds.normal&&rounds.expert){const trio=rounds as DailyTrio;return {trio,diagnostics,scores:{easy:scoreBoard(trio.easy,ROUND_CONFIGS.easy),normal:scoreBoard(trio.normal,ROUND_CONFIGS.normal),expert:scoreBoard(trio.expert,ROUND_CONFIGS.expert)}};}
 }
 diagnostics.failureStage="trio-constraints";diagnostics.message="No trio satisfied category uniqueness and the one-country overlap limit.";throw Object.assign(new Error(diagnostics.message),{diagnostics});
}
