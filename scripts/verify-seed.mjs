#!/usr/bin/env node

/**
 * Geo: Second Coming data auditor
 *
 * Usage:
 *   npm run verify-seed -- PYBM35HM
 *   npm run verify-seed -- DAILY-2026-07-20
 *   npm run verify-seed -- PYBM35HM --json
 *
 * The script independently downloads current World Bank observations,
 * deterministically rebuilds the requested round, and verifies every value,
 * year, pool rank, point value, winner, and global rank.
 */

const CATEGORIES = [
  ["population","Largest population","SP.POP.TOTL","Population","high"],
  ["populationGrowth","Fastest population growth","SP.POP.GROW","Population","high"],
  ["density","Highest population density","EN.POP.DNST","Population","high"],
  ["urban","Most urbanized","SP.URB.TOTL.IN.ZS","Population","high"],
  ["rural","Largest rural population share","SP.RUR.TOTL.ZS","Population","high"],
  ["life","Highest life expectancy","SP.DYN.LE00.IN","Health","high"],
  ["fertility","Highest fertility rate","SP.DYN.TFRT.IN","Health","high"],
  ["infantMortality","Lowest infant mortality","SP.DYN.IMRT.IN","Health","low"],
  ["older","Oldest population","SP.POP.65UP.TO.ZS","Population","high"],
  ["young","Youngest population","SP.POP.0014.TO.ZS","Population","high"],
  ["gdp","Largest economy","NY.GDP.MKTP.CD","Economy","high"],
  ["gdpPc","Highest GDP per person","NY.GDP.PCAP.CD","Economy","high"],
  ["gdpGrowth","Fastest economic growth","NY.GDP.MKTP.KD.ZG","Economy","high"],
  ["exports","Largest exports","NE.EXP.GNFS.CD","Economy","high"],
  ["imports","Largest imports","NE.IMP.GNFS.CD","Economy","high"],
  ["manufacturing","Largest manufacturing output","NV.IND.MANF.CD","Economy","high"],
  ["agValue","Largest agricultural economy","NV.AGR.TOTL.CD","Agriculture","high"],
  ["land","Largest land area","AG.LND.TOTL.K2","Land","high"],
  ["forestArea","Most forest area","AG.LND.FRST.K2","Land","high"],
  ["forestPct","Highest forest coverage","AG.LND.FRST.ZS","Land","high"],
  ["leastForest","Least forest coverage","AG.LND.FRST.ZS","Land","low"],
  ["agLand","Most farmland by percentage","AG.LND.AGRI.ZS","Agriculture","high"],
  ["arablePct","Highest arable-land percentage","AG.LND.ARBL.ZS","Agriculture","high"],
  ["arableHa","Most arable land","AG.LND.ARBL.HA","Agriculture","high"],
  ["rain","Highest average rainfall","AG.LND.PRCP.MM","Climate","high"],
  ["dry","Lowest average rainfall","AG.LND.PRCP.MM","Climate","low"],
  ["renewable","Highest renewable electricity share","EG.ELC.RNEW.ZS","Energy","high"],
  ["energyUse","Highest energy use per person","EG.USE.PCAP.KG.OE","Energy","high"],
  ["electricUse","Highest electricity use per person","EG.USE.ELEC.KH.PC","Energy","high"],
  ["internet","Highest internet usage","IT.NET.USER.ZS","Technology","high"],
  ["mobile","Most mobile subscriptions per person","IT.CEL.SETS.P2","Technology","high"],
  ["airPassengers","Most airline passengers","IS.AIR.PSGR","Transport","high"],
  ["rail","Most rail passengers","IS.RRS.PASG.KM","Transport","high"],
  ["protected","Highest protected-land share","ER.LND.PTLD.ZS","Environment","high"],
  ["freshwater","Most renewable freshwater","ER.H2O.INTR.K3","Environment","high"],
  ["healthSpend","Highest health spending per person","SH.XPD.CHEX.PC.CD","Health","high"],
  ["education","Highest education spending share","SE.XPD.TOTL.GD.ZS","Education","high"],
  ["femaleLabor","Highest female labor participation","SL.TLF.CACT.FE.ZS","Labor","high"],
  ["unemploymentLow","Lowest unemployment","SL.UEM.TOTL.ZS","Labor","low"],
  ["cerealProduction","Most cereal produced","AG.PRD.CREL.MT","Agriculture","high"],
  ["cerealYield","Highest cereal yield","AG.YLD.CREL.KG","Agriculture","high"],
  ["foodExportsShare","Highest food share of exports","TX.VAL.FOOD.ZS.UN","Trade","high"],
  ["foodImportsShare","Highest food share of imports","TM.VAL.FOOD.ZS.UN","Trade","high"],
  ["merchExports","Largest merchandise exports","TX.VAL.MRCH.CD.WT","Trade","high"],
  ["highTechExports","Largest high-tech exports","TX.VAL.TECH.CD","Trade","high"],
  ["touristArrivals","Most international tourist arrivals","ST.INT.ARVL","Tourism","high"],
  ["tourismReceipts","Highest tourism receipts","ST.INT.RCPT.CD","Tourism","high"],
  ["co2Total","Highest total CO₂ emissions","EN.ATM.CO2E.KT","Environment","high"],
  ["co2PerCapita","Highest CO₂ emissions per person","EN.ATM.CO2E.PC","Environment","high"],
  ["electricityAccess","Highest electricity access","EG.ELC.ACCS.ZS","Infrastructure","high"],
  ["sanitation","Highest safely managed sanitation access","SH.STA.SMSS.ZS","Infrastructure","high"],
  ["physicians","Most physicians per person","SH.MED.PHYS.ZS","Health","high"],
  ["hospitalBeds","Most hospital beds per person","SH.MED.BEDS.ZS","Health","high"],
  ["journalArticles","Most scientific journal articles","IP.JRN.ARTC.SC","Knowledge","high"],
  ["patents","Most resident patent applications","IP.PAT.RESD","Knowledge","high"],
  ["militarySpend","Highest military spending","MS.MIL.XPND.CD","Government","high"],
  ["urbanAbsolute","Largest urban population","SP.URB.TOTL","Population","high"],
  ["ruralAbsolute","Largest rural population","SP.RUR.TOTL","Population","high"],
  ["under5Mortality","Lowest under-5 mortality","SH.DYN.MORT","Health","low"],
  ["maternalMortality","Lowest maternal mortality","SH.STA.MMRT","Health","low"],
  ["healthSpendShare","Highest health spending share","SH.XPD.CHEX.GD.ZS","Health","high"],
  ["servicesShare","Largest services sector","NV.SRV.TOTL.ZS","Economy","high"],
  ["industryShare","Largest industrial sector","NV.IND.TOTL.ZS","Economy","high"],
  ["exportsShare","Highest exports share of GDP","NE.EXP.GNFS.ZS","Economy","high"],
  ["grossSavings","Highest gross savings rate","NY.GNS.ICTR.ZS","Economy","high"],
  ["investmentShare","Highest investment share","NE.GDI.TOTL.ZS","Economy","high"],
  ["householdConsumption","Highest household consumption","NE.CON.PRVT.CD","Economy","high"],
  ["governmentConsumption","Highest government consumption","NE.CON.GOVT.CD","Government","high"],
  ["merchImports","Largest merchandise imports","TM.VAL.MRCH.CD.WT","Trade","high"],
  ["fixedBroadband","Most fixed broadband subscriptions","IT.NET.BBND.P2","Technology","high"],
  ["fixedTelephone","Most fixed telephone subscriptions","IT.MLT.MAIN.P2","Technology","high"],
  ["basicWater","Highest basic drinking-water access","SH.H2O.BASW.ZS","Infrastructure","high"],
  ["secondaryEnrollment","Highest secondary enrollment","SE.SEC.ENRR","Education","high"],
  ["tertiaryEnrollment","Highest tertiary enrollment","SE.TER.ENRR","Education","high"],
  ["renewableConsumption","Highest renewable energy consumption","EG.FEC.RNEW.ZS","Energy","high"],
  ["agLandArea","Largest agricultural land area","AG.LND.AGRI.K2","Agriculture","high"],
  ["airFreight","Most air freight","IS.AIR.GOOD.MT.K1","Transport","high"],
  ["railFreight","Most rail freight","IS.RRS.GOOD.MT.K6","Transport","high"],
  ["methane","Highest methane emissions","EN.ATM.METH.KT.CE","Environment","high"],
  ["roadFatalities","Lowest road fatality rate","SH.STA.TRAF.P5","Transport","low"],
  ["oilRents","Highest oil-rent dependence","NY.GDP.PETR.RT.ZS","Resources","high"],
  ["gasRents","Highest natural-gas-rent dependence","NY.GDP.NGAS.RT.ZS","Resources","high"],
  ["mineralRents","Highest mineral-rent dependence","NY.GDP.MINR.RT.ZS","Resources","high"],
  ["militaryShare","Highest military spending share","MS.MIL.XPND.GD.ZS","Government","high"],
].map(([id, name, indicator, family, direction]) => ({ id, name, indicator, family, direction }));

const POINTS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
const API = "https://api.worldbank.org/v2";
const args = process.argv.slice(2);
const seed = args.find((arg) => !arg.startsWith("--"));
const asJson = args.includes("--json");

if (!seed || args.includes("--help")) {
  console.log(`\nGeo: Second Coming seed verifier\n\nUsage:\n  npm run verify-seed -- <SEED>\n  npm run verify-seed -- <SEED> --json\n\nExamples:\n  npm run verify-seed -- PYBM35HM\n  npm run verify-seed -- DAILY-2026-07-20\n`);
  process.exit(seed ? 0 : 1);
}

function hashSeed(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(input) {
  let value = hashSeed(input);
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function fetchJson(url, label) {
  const response = await fetch(url, { headers: { "User-Agent": "geo-second-coming-auditor/1.0" } });
  if (!response.ok) throw new Error(`${label} failed (${response.status} ${response.statusText}).`);
  return response.json();
}

async function fetchCountries() {
  const json = await fetchJson(`${API}/country?format=json&per_page=400`, "Country list request");
  return (json?.[1] ?? [])
    .filter((row) => row.region?.id && row.region.id !== "NA" && row.capitalCity)
    .map((row) => ({ id: row.id, name: row.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchCategory(category) {
  const url = `${API}/country/all/indicator/${category.indicator}?format=json&per_page=20000&mrnev=8`;
  const json = await fetchJson(url, `${category.name} request`);
  const latest = new Map();
  for (const row of json?.[1] ?? []) {
    const id = row.countryiso3code;
    const value = Number(row.value);
    const year = String(row.date ?? "");
    if (!id || id.length !== 3 || !Number.isFinite(value) || !/^\d{4}$/.test(year) || Number(year) < 2022) continue;
    if (!latest.has(id)) latest.set(id, { countryId: id, countryName: row.country?.value ?? id, value, year });
  }
  const ranked = [...latest.values()]
    .sort((a, b) => category.direction === "high" ? b.value - a.value : a.value - b.value)
    .map((row, index) => ({ ...row, globalRank: index + 1 }));
  return { category, ranked, byCountry: new Map(ranked.map((row) => [row.countryId, row])) };
}

function value(dataset, countryId) {
  return dataset.byCountry.get(countryId)?.value;
}

function isBetter(dataset, a, b) {
  return dataset.category.direction === "high" ? a > b : a < b;
}

function leaderboard(dataset, bank) {
  return bank
    .map((country) => {
      const observation = dataset.byCountry.get(country.id);
      return observation ? { country, observation } : null;
    })
    .filter(Boolean)
    .sort((a, b) => dataset.category.direction === "high"
      ? b.observation.value - a.observation.value
      : a.observation.value - b.observation.value)
    .map((row, index) => ({ ...row, poolRank: index + 1, points: POINTS[index] ?? 0 }));
}

function findDistinctWinners(categories, countryList, rng) {
  const countryIds = new Set(countryList.map((country) => country.id));
  const completeCountries = countryList.filter((country) =>
    categories.every((category) => value(category, country.id) !== undefined));
  const completeIds = new Set(completeCountries.map((country) => country.id));
  const candidates = categories.map((category) => shuffle(
    category.ranked.slice(0, 100).map((row) => row.countryId)
      .filter((id) => countryIds.has(id) && completeIds.has(id)), rng));
  if (candidates.some((list) => list.length === 0)) return null;

  const order = categories.map((_, index) => index)
    .sort((a, b) => candidates[a].length - candidates[b].length);
  const winnerByCategory = new Array(categories.length);
  const used = new Set();
  let steps = 0;

  function search(depth) {
    if (++steps > 120000) return false;
    if (depth === order.length) return true;
    const categoryIndex = order[depth];
    const category = categories[categoryIndex];
    for (const candidateId of candidates[categoryIndex].slice(0, 70)) {
      if (used.has(candidateId)) continue;
      const own = value(category, candidateId);
      if (own === undefined) continue;
      let valid = true;
      for (let previousDepth = 0; previousDepth < depth; previousDepth++) {
        const previousIndex = order[previousDepth];
        const previousCategory = categories[previousIndex];
        const previousWinnerId = winnerByCategory[previousIndex];
        const previousOwn = value(previousCategory, previousWinnerId);
        const candidateOnPrevious = value(previousCategory, candidateId);
        const previousOnCurrent = value(category, previousWinnerId);
        if (previousOwn === undefined || candidateOnPrevious === undefined || previousOnCurrent === undefined ||
            !isBetter(previousCategory, previousOwn, candidateOnPrevious) ||
            !isBetter(category, own, previousOnCurrent)) {
          valid = false;
          break;
        }
      }
      if (!valid) continue;
      winnerByCategory[categoryIndex] = candidateId;
      used.add(candidateId);
      if (search(depth + 1)) return true;
      used.delete(candidateId);
      winnerByCategory[categoryIndex] = "";
    }
    return false;
  }

  if (!search(0)) return null;
  const decoys = shuffle(completeCountries, rng).filter((country) => {
    if (used.has(country.id)) return false;
    return categories.every((category, index) => {
      const winnerValue = value(category, winnerByCategory[index]);
      const decoyValue = value(category, country.id);
      return winnerValue !== undefined && decoyValue !== undefined && isBetter(category, winnerValue, decoyValue);
    });
  });
  if (decoys.length < 2) return null;
  return { winners: winnerByCategory, decoys: decoys.slice(0, 2).map((country) => country.id) };
}

async function buildRound(countryList, inputSeed) {
  const rng = seededRandom(inputSeed.toUpperCase());
  const available = [];
  const familyCounts = new Map();
  for (const category of shuffle(CATEGORIES, rng)) {
    if ((familyCounts.get(category.family) ?? 0) >= 3) continue;
    try {
      const dataset = await fetchCategory(category);
      if (dataset.ranked.length < 100) continue;
      available.push(dataset);
      familyCounts.set(category.family, (familyCounts.get(category.family) ?? 0) + 1);
      if (available.length === 14) break;
    } catch (error) {
      console.error(`Warning: ${error.message}`);
    }
  }
  if (available.length < 6) throw new Error(`Only ${available.length} usable datasets loaded; six are required.`);

  for (let attempt = 0; attempt < 180; attempt++) {
    const categories = [];
    const counts = new Map();
    for (const category of shuffle(available, rng)) {
      if ((counts.get(category.category.family) ?? 0) >= 2) continue;
      categories.push(category);
      counts.set(category.category.family, (counts.get(category.category.family) ?? 0) + 1);
      if (categories.length === 6) break;
    }
    if (categories.length < 6) continue;
    const solution = findDistinctWinners(categories, countryList, rng);
    if (!solution) continue;
    const byId = new Map(countryList.map((country) => [country.id, country]));
    const bank = shuffle([...solution.winners, ...solution.decoys]
      .map((id) => byId.get(id)).filter(Boolean), rng);
    if (bank.length === 8) return { bank, categories };
  }
  throw new Error("The seed could not produce a balanced round using the current World Bank dataset.");
}

function auditRound(round) {
  const failures = [];
  const winners = new Set();
  const categories = round.categories.map((dataset) => {
    const rows = leaderboard(dataset, round.bank);
    if (rows.length !== 8) failures.push(`${dataset.category.name}: expected 8 observations, found ${rows.length}.`);
    rows.forEach((row, index) => {
      if (row.poolRank !== index + 1) failures.push(`${dataset.category.name}: pool rank mismatch for ${row.country.name}.`);
      if (row.points !== POINTS[index]) failures.push(`${dataset.category.name}: points mismatch for rank ${index + 1}.`);
      const canonical = dataset.ranked[row.observation.globalRank - 1];
      if (!canonical || canonical.countryId !== row.country.id || canonical.value !== row.observation.value || canonical.year !== row.observation.year) {
        failures.push(`${dataset.category.name}: global rank/value/year mismatch for ${row.country.name}.`);
      }
      if (index > 0) {
        const prior = rows[index - 1].observation.value;
        const current = row.observation.value;
        const sorted = dataset.category.direction === "high" ? prior >= current : prior <= current;
        if (!sorted) failures.push(`${dataset.category.name}: leaderboard is not correctly sorted.`);
      }
    });
    if (rows[0]) winners.add(rows[0].country.id);
    return {
      id: dataset.category.id,
      category: dataset.category.name,
      indicator: dataset.category.indicator,
      direction: dataset.category.direction,
      source: `https://data.worldbank.org/indicator/${dataset.category.indicator}?name_desc=false`,
      leaderboard: rows.map((row) => ({
        poolRank: row.poolRank,
        points: row.points,
        country: row.country.name,
        iso3: row.country.id,
        value: row.observation.value,
        year: row.observation.year,
        globalRank: row.observation.globalRank,
      })),
    };
  });
  if (winners.size !== 6) failures.push(`Expected six distinct category winners; found ${winners.size}.`);
  return { passed: failures.length === 0, failures, categories };
}

function printReport(inputSeed, round, report) {
  console.log(`\nGeoStats audit — ${inputSeed.toUpperCase()}`);
  console.log("=".repeat(72));
  console.log(`Country bank: ${round.bank.map((country) => country.name).join(", ")}\n`);
  for (const category of report.categories) {
    console.log(`${category.category} [${category.indicator}]`);
    console.table(category.leaderboard.map((row) => ({
      Rank: `#${row.poolRank}/8`,
      Points: row.points,
      Country: row.country,
      Value: row.value,
      Year: row.year,
      "World rank": `#${row.globalRank}`,
    })));
    console.log(`Source: ${category.source}\n`);
  }
  if (report.passed) {
    console.log("PASS: Every displayed value, year, pool rank, point value, winner, and global rank is internally consistent with the current World Bank response.\n");
  } else {
    console.error(`FAIL: ${report.failures.length} problem(s) found:`);
    report.failures.forEach((failure) => console.error(`  - ${failure}`));
    console.error();
  }
}

try {
  const countries = await fetchCountries();
  const round = await buildRound(countries, seed);
  const report = auditRound(round);
  const result = {
    seed: seed.toUpperCase(),
    checkedAt: new Date().toISOString(),
    countryBank: round.bank,
    ...report,
  };
  if (asJson) console.log(JSON.stringify(result, null, 2));
  else printReport(seed, round, report);
  process.exit(report.passed ? 0 : 2);
} catch (error) {
  console.error(`\nAudit could not run: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
