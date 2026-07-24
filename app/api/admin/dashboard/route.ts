import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/supabase/adminAuth";
import { newYorkDate } from "../../../../lib/time";

export const dynamic = "force-dynamic";

export async function GET(){
 const auth=await requireAdmin(); if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
 const {admin}=auth;
 const today=newYorkDate();
 const [cats,obsCount,imports,sources,boards,scoreCount]=await Promise.all([
  admin.from('stat_categories').select('id,title,source_organization,source_indicator_code,enabled,eligible_daily,quality_score,country_coverage,latest_available_year,family',{count:'exact'}).order('title'),
  admin.from('stat_observations').select('country_iso3',{count:'exact',head:true}),
  admin.from('stat_import_runs').select('*').order('started_at',{ascending:false}).limit(20),
  admin.from('data_sources').select('*').order('display_order'),
  admin.from('daily_challenges').select('difficulty').eq('challenge_date',today),
  admin.from('daily_scores').select('id',{count:'exact',head:true}).eq('challenge_date',today)
 ]);
 const errors=[cats.error,obsCount.error,imports.error,sources.error,boards.error,scoreCount.error].filter(Boolean); if(errors.length)return NextResponse.json({error:errors[0]?.message||'Warehouse query failed.'},{status:500});
 const countrySet=new Set<string>();
 for(let from=0;;from+=1000){const {data:page,error}=await admin.from('stat_observations').select('country_iso3').range(from,from+999);if(error)return NextResponse.json({error:error.message},{status:500});for(const row of page??[])countrySet.add(row.country_iso3);if((page??[]).length<1000)break;}
 const boardMap={easy:false,normal:false,expert:false}; for(const b of boards.data??[]){if(b.difficulty in boardMap)(boardMap as any)[b.difficulty]=true;}
 return NextResponse.json({stats:{categories:cats.count??0,observations:obsCount.count??0,countries:countrySet.size},sources:sources.data??[],imports:imports.data??[],categories:cats.data??[],boards:boardMap,todayScoreCount:scoreCount.count??0});
}
