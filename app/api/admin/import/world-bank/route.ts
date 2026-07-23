import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/adminAuth";
import { CATEGORIES, type Category } from "../../../../../lib/categories";
import { fetchWorldBankCategory } from "../../../../../lib/worldBank";

export const dynamic='force-dynamic'; export const maxDuration=60;
const worldBankCategories=CATEGORIES.filter(c=>c.source==='worldbank' && c.enabled!==false);
function valueType(c:Category){const d=`${c.description} ${c.unit}`.toLowerCase();if(d.includes('per person')||d.includes('per capita'))return 'per_capita';if(d.includes('percent')||c.unit.includes('%'))return 'percentage';if(d.includes(' per 100')||d.includes('rate'))return 'rate';return 'total';}
function metadata(c:Category){return {shortName:c.shortName,decimals:c.decimals??null,coverageFloor:c.coverageFloor,certificationGrade:c.certificationGrade,requireCommonYear:c.requireCommonYear??false,expectedRange:c.expectedRange??null,roundType:c.roundType??null,similarityGroup:c.similarityGroup??null};}
async function bump(admin:any,runId:number,deltaObs:number){const {data}=await admin.from('stat_import_runs').select('categories_processed,observations_inserted').eq('id',runId).single();await admin.from('stat_import_runs').update({categories_processed:(data?.categories_processed??0)+1,observations_inserted:(data?.observations_inserted??0)+deltaObs}).eq('id',runId);}
export async function POST(req:Request){
 const auth=await requireAdmin();if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});const {admin}=auth;
 const body=await req.json().catch(()=>({}));
 if(body.action==='start'){
  const rows=worldBankCategories.map(c=>({id:c.id,title:c.name,short_title:c.shortName,description:c.description,icon:c.icon,unit:c.unit,value_type:valueType(c),ranking_direction:c.direction,family:c.family,source_organization:'World Bank',source_dataset:c.dataset,source_indicator_code:c.indicator,source_url:`https://data.worldbank.org/indicator/${c.indicator}`,enabled:true,minimum_year:c.minimumYear??2022,metadata:metadata(c)}));
  const {error}=await admin.from('stat_categories').upsert(rows,{onConflict:'id'});if(error)return NextResponse.json({error:error.message},{status:500});
  const {data:run,error:runError}=await admin.from('stat_import_runs').insert({source_organization:'World Bank',source_dataset:'World Development Indicators',status:'running',details:{requested_by:auth.user.id,total_categories:rows.length}}).select('id').single();if(runError)return NextResponse.json({error:runError.message},{status:500});
  await admin.from('data_sources').update({status:'importing'}).eq('id','worldbank');
  return NextResponse.json({runId:run.id,categories:worldBankCategories.map(c=>({id:c.id,shortName:c.shortName}))});
 }
 if(body.action==='category'){
  const c=worldBankCategories.find(x=>x.id===body.categoryId);if(!c)return NextResponse.json({error:'Unknown World Bank category.'},{status:400});
  try{const dataset=await fetchWorldBankCategory(c);const rows=dataset.observations.map(o=>({category_id:c.id,country_iso3:o.countryId,country_name:o.countryName,data_year:Number(o.year),value:o.value,source_url:`https://data.worldbank.org/indicator/${c.indicator}`,source_record_id:`${c.indicator}:${o.countryId}:${o.year}`,metadata:{indicator:c.indicator}}));
   const {error}=await admin.from('stat_observations').upsert(rows,{onConflict:'category_id,country_iso3,data_year'});if(error)throw error;
   const latest=Math.max(...rows.map(r=>r.data_year));await admin.from('stat_categories').update({country_coverage:rows.length,latest_available_year:latest,enabled:true}).eq('id',c.id);await bump(admin,Number(body.runId),rows.length);return NextResponse.json({ok:true,category:c.id,observations:rows.length,year:latest});
  }catch(e:any){await bump(admin,Number(body.runId),0);return NextResponse.json({error:e?.message||'Category import failed.'},{status:500});}
 }
 if(body.action==='finish'){
  const failures=Array.isArray(body.failures)?body.failures:[];const status=failures.length===worldBankCategories.length?'failed':'completed';
  await admin.from('stat_import_runs').update({status,completed_at:new Date().toISOString(),error_message:status==='failed'?'All categories failed.':null,details:{failures}}).eq('id',Number(body.runId));
  await admin.from('data_sources').update({status:status==='completed'?'active':'error',last_import_at:new Date().toISOString()}).eq('id','worldbank');return NextResponse.json({ok:true,status,failures:failures.length});
 }
 return NextResponse.json({error:'Unknown import action.'},{status:400});
}
