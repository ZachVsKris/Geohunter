#!/usr/bin/env node
import fs from "node:fs";

const API = "https://fenixservices.fao.org/faostat/api/v1/en/data/QCL";
const source = fs.readFileSync(new URL("../lib/categories.ts", import.meta.url), "utf8");
const categories = [...source.matchAll(/fao\(\{id:"([^"]+)",name:"([^"]+)",shortName:"[^"]+",indicator:"(\d+):(2510)"[\s\S]*?coverageFloor:(\d+)\}\)/g)]
  .map(([, id, name, item, element, floor]) => ({ id, name, item, element, floor: Number(floor) }));

function rows(payload) {
  const data = payload?.data;
  if (!Array.isArray(data)) return [];
  if (Array.isArray(data[0])) {
    const [header, ...body] = data;
    return body.map((row) => Object.fromEntries(header.map((key, i) => [String(key), row[i]])));
  }
  return data;
}
function pick(row, ...keys) { for (const key of keys) if (row?.[key] != null) return row[key]; }

async function verify(category) {
  const now = new Date().getUTCFullYear();
  const years = Array.from({length:9},(_,i)=>now-i-1).join(",");
  const url = new URL(API);
  Object.entries({element:category.element,item:category.item,year:years,area_cs:"ISO3",show_code:"1",show_unit:"1",show_flags:"1",null_values:"0",limit:"-1",output_type:"objects"})
    .forEach(([key,value])=>url.searchParams.set(key,value));
  const response = await fetch(url,{headers:{"User-Agent":"geo-second-coming-faostat-verifier/2.3"}});
  if(!response.ok) throw new Error(`${category.name}: HTTP ${response.status}`);
  const latest=new Map(), seen=new Map();
  for(const row of rows(await response.json())){
    const iso=String(pick(row,"Area Code (ISO3)","area_code_iso3")??"").trim();
    const year=String(pick(row,"Year","year")??"");
    const value=Number(pick(row,"Value","value"));
    const unit=String(pick(row,"Unit","unit")??"").toLowerCase();
    if(!/^[A-Z]{3}$/.test(iso)||!/^\d{4}$/.test(year)||!Number.isFinite(value)) continue;
    if(unit && unit!=="t" && !unit.includes("tonne")) throw new Error(`${category.name}: unexpected unit ${unit}`);
    const key=`${iso}:${year}`;
    if(seen.has(key)&&Math.abs(seen.get(key)-value)>1e-9) throw new Error(`${category.name}: contradictory ${key}`);
    seen.set(key,value);
    if(!latest.has(iso)||Number(year)>Number(latest.get(iso).year)) latest.set(iso,{year,value});
  }
  if(latest.size<category.floor) throw new Error(`${category.name}: coverage ${latest.size} below ${category.floor}`);
  return {id:category.id,coverage:latest.size,latestYear:[...latest.values()].map(x=>x.year).sort().at(-1)};
}

if(!categories.length) throw new Error("No FAOSTAT categories found.");
const results=[];
for(const category of categories){
  const result=await verify(category); results.push(result); console.log(`✓ ${category.name}: ${result.coverage} countries, latest ${result.latestYear}`);
}
console.log(`FAOSTAT verification passed (${results.length} categories).`);
