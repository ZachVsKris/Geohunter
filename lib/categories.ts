export type Direction = "high" | "low";
export type DataSourceId = "worldbank";
export type CertificationGrade = "A" | "B";
export type Category = {
  id: string;
  source: DataSourceId;
  dataset: string;
  name: string;
  shortName: string;
  indicator: string;
  icon: string;
  unit: string;
  family: string;
  direction: Direction;
  description: string;
  decimals?: number;
  minimumYear?: number;
  requireCommonYear?: boolean;
  expectedRange?: [number, number];
  certified: true;
  certificationGrade: CertificationGrade;
  coverageFloor: number;
  enabled?: boolean;
};

const wb = (category: Omit<Category, "source" | "dataset" | "certified" | "certificationGrade" | "coverageFloor"> & Partial<Pick<Category, "certificationGrade" | "coverageFloor">>): Category => ({
  source: "worldbank",
  dataset: "World Development Indicators",
  certified: true,
  certificationGrade: category.certificationGrade ?? "A",
  coverageFloor: category.coverageFloor ?? 100,
  ...category,
  minimumYear: Math.max(2022, category.minimumYear ?? 2022),
});

export const CATEGORIES: Category[] = [
  wb({id:"population",name:"Largest population",shortName:"Population",indicator:"SP.POP.TOTL",icon:"👥",unit:"people",family:"Population",direction:"high",description:"Total resident population"}),
  wb({id:"populationGrowth",name:"Fastest population growth",shortName:"Population growth",indicator:"SP.POP.GROW",icon:"📈",unit:"%",family:"Population",direction:"high",description:"Annual population growth",decimals:2,minimumYear:2022,requireCommonYear:true,expectedRange:[-10,10]}),
  wb({id:"density",name:"Highest population density",shortName:"Population density",indicator:"EN.POP.DNST",icon:"🏙️",unit:"people/km²",family:"Population",direction:"high",description:"People per square kilometer of land area",decimals:1}),
  wb({id:"urban",name:"Most urbanized",shortName:"Urban population",indicator:"SP.URB.TOTL.IN.ZS",icon:"🏢",unit:"%",family:"Population",direction:"high",description:"Share of population living in urban areas",decimals:1,expectedRange:[0,100]}),
  wb({id:"rural",name:"Largest rural population share",shortName:"Rural population",indicator:"SP.RUR.TOTL.ZS",icon:"🏡",unit:"%",family:"Population",direction:"high",description:"Share of population living in rural areas",decimals:1,expectedRange:[0,100]}),
  wb({id:"life",name:"Highest life expectancy",shortName:"Life expectancy",indicator:"SP.DYN.LE00.IN",icon:"❤️",unit:"years",family:"Health",direction:"high",description:"Life expectancy at birth",decimals:1}),
  wb({id:"fertility",name:"Highest fertility rate",shortName:"Fertility rate",indicator:"SP.DYN.TFRT.IN",icon:"👶",unit:"births/woman",family:"Health",direction:"high",description:"Total fertility rate",decimals:2}),
  wb({id:"infantMortality",name:"Lowest infant mortality",shortName:"Infant mortality",indicator:"SP.DYN.IMRT.IN",icon:"🩺",unit:"per 1,000",family:"Health",direction:"low",description:"Infant deaths per 1,000 live births",decimals:1}),
  wb({id:"older",name:"Oldest population",shortName:"Age 65+",indicator:"SP.POP.65UP.TO.ZS",icon:"🧓",unit:"%",family:"Population",direction:"high",description:"Population age 65 and above",decimals:1}),
  wb({id:"young",name:"Youngest population",shortName:"Age 0–14",indicator:"SP.POP.0014.TO.ZS",icon:"🧒",unit:"%",family:"Population",direction:"high",description:"Population age 0 to 14",decimals:1}),
  wb({id:"gdp",name:"Largest economy",shortName:"GDP",indicator:"NY.GDP.MKTP.CD",icon:"💰",unit:"USD",family:"Economy",direction:"high",description:"Gross domestic product in current US dollars"}),
  wb({id:"gdpPc",name:"Highest GDP per person",shortName:"GDP per capita",indicator:"NY.GDP.PCAP.CD",icon:"💵",unit:"USD/person",family:"Economy",direction:"high",description:"GDP per capita in current US dollars"}),
  wb({id:"gdpGrowth",name:"Fastest economic growth",shortName:"GDP growth",indicator:"NY.GDP.MKTP.KD.ZG",icon:"🚀",unit:"%",family:"Economy",direction:"high",description:"Annual real GDP growth",decimals:2,minimumYear:2022,requireCommonYear:true,expectedRange:[-50,50]}),
  wb({id:"exports",name:"Largest exports",shortName:"Exports",indicator:"NE.EXP.GNFS.CD",icon:"📦",unit:"USD",family:"Economy",direction:"high",description:"Exports of goods and services"}),
  wb({id:"imports",name:"Largest imports",shortName:"Imports",indicator:"NE.IMP.GNFS.CD",icon:"🚢",unit:"USD",family:"Economy",direction:"high",description:"Imports of goods and services"}),
  wb({id:"manufacturing",name:"Largest manufacturing output",shortName:"Manufacturing",indicator:"NV.IND.MANF.CD",icon:"🏭",unit:"USD",family:"Economy",direction:"high",description:"Manufacturing value added"}),
  wb({id:"agValue",name:"Largest agricultural economy",shortName:"Agriculture output",indicator:"NV.AGR.TOTL.CD",icon:"🚜",unit:"USD",family:"Agriculture",direction:"high",description:"Agriculture, forestry and fishing value added"}),
  wb({id:"land",name:"Largest land area",shortName:"Land area",indicator:"AG.LND.TOTL.K2",icon:"🗺️",unit:"km²",family:"Land",direction:"high",description:"Total land area"}),
  wb({id:"forestArea",name:"Most forest area",shortName:"Forest area",indicator:"AG.LND.FRST.K2",icon:"🌲",unit:"km²",family:"Land",direction:"high",description:"Land covered by forest"}),
  wb({id:"forestPct",name:"Highest forest coverage",shortName:"Forest coverage",indicator:"AG.LND.FRST.ZS",icon:"🌳",unit:"%",family:"Land",direction:"high",description:"Forest area as a share of land area",decimals:1,expectedRange:[0,100]}),
  wb({id:"leastForest",name:"Least forest coverage",shortName:"Least forest",indicator:"AG.LND.FRST.ZS",icon:"🪵",unit:"%",family:"Land",direction:"low",description:"Lowest forest share of land area",decimals:1,expectedRange:[0,100]}),
  wb({id:"agLand",name:"Most farmland by percentage",shortName:"Agricultural land",indicator:"AG.LND.AGRI.ZS",icon:"🌾",unit:"%",family:"Agriculture",direction:"high",description:"Agricultural land as a share of land area",decimals:1}),
  wb({id:"arablePct",name:"Highest arable-land percentage",shortName:"Arable land",indicator:"AG.LND.ARBL.ZS",icon:"🌱",unit:"%",family:"Agriculture",direction:"high",description:"Arable land as a share of land area",decimals:1}),
  wb({id:"arableHa",name:"Most arable land",shortName:"Arable hectares",indicator:"AG.LND.ARBL.HA",icon:"🧑‍🌾",unit:"hectares",family:"Agriculture",direction:"high",description:"Total hectares of arable land"}),
  wb({id:"rain",name:"Highest average rainfall",shortName:"Rainfall",indicator:"AG.LND.PRCP.MM",icon:"🌧️",unit:"mm/year",family:"Climate",direction:"high",description:"Average annual precipitation in depth",decimals:0}),
  wb({id:"dry",name:"Lowest average rainfall",shortName:"Least rainfall",indicator:"AG.LND.PRCP.MM",icon:"🏜️",unit:"mm/year",family:"Climate",direction:"low",description:"Lowest average annual precipitation",decimals:0}),
  wb({id:"renewable",name:"Highest renewable electricity share",shortName:"Renewable electricity",indicator:"EG.ELC.RNEW.ZS",icon:"⚡",unit:"%",family:"Energy",direction:"high",description:"Renewable sources as a share of electricity output",decimals:1}),
  wb({id:"energyUse",name:"Highest energy use per person",shortName:"Energy use",indicator:"EG.USE.PCAP.KG.OE",icon:"🔌",unit:"kg oil eq./person",family:"Energy",direction:"high",description:"Energy use per capita",decimals:0}),
  wb({id:"electricUse",name:"Highest electricity use per person",shortName:"Electric power use",indicator:"EG.USE.ELEC.KH.PC",icon:"💡",unit:"kWh/person",family:"Energy",direction:"high",description:"Electric power consumption per capita",decimals:0}),
  wb({id:"internet",name:"Highest internet usage",shortName:"Internet usage",indicator:"IT.NET.USER.ZS",icon:"🌐",unit:"%",family:"Technology",direction:"high",description:"Individuals using the internet",decimals:1,expectedRange:[0,100]}),
  wb({id:"mobile",name:"Most mobile subscriptions per person",shortName:"Mobile subscriptions",indicator:"IT.CEL.SETS.P2",icon:"📱",unit:"per 100 people",family:"Technology",direction:"high",description:"Mobile cellular subscriptions per 100 people",decimals:1}),
  wb({id:"airPassengers",name:"Most airline passengers",shortName:"Air passengers",indicator:"IS.AIR.PSGR",icon:"✈️",unit:"passengers",family:"Transport",direction:"high",description:"Passengers carried by air transport carriers"}),
  wb({id:"rail",name:"Most rail passengers",shortName:"Rail passengers",indicator:"IS.RRS.PASG.KM",icon:"🚆",unit:"passenger-km",family:"Transport",direction:"high",description:"Railways passenger traffic"}),
  wb({id:"protected",name:"Highest protected-land share",shortName:"Protected land",indicator:"ER.LND.PTLD.ZS",icon:"🦌",unit:"%",family:"Environment",direction:"high",description:"Terrestrial protected areas as share of land area",decimals:1}),
  wb({id:"freshwater",name:"Most renewable freshwater",shortName:"Freshwater resources",indicator:"ER.H2O.INTR.K3",icon:"💧",unit:"billion m³",family:"Environment",direction:"high",description:"Internal renewable freshwater resources",decimals:1}),
  wb({id:"healthSpend",name:"Highest health spending per person",shortName:"Health spending",indicator:"SH.XPD.CHEX.PC.CD",icon:"🏥",unit:"USD/person",family:"Health",direction:"high",description:"Current health expenditure per capita",decimals:0}),
  wb({id:"education",name:"Highest education spending share",shortName:"Education spending",indicator:"SE.XPD.TOTL.GD.ZS",icon:"🎓",unit:"% of GDP",family:"Education",direction:"high",description:"Government expenditure on education",decimals:2}),
  wb({id:"femaleLabor",name:"Highest female labor participation",shortName:"Female labor force",indicator:"SL.TLF.CACT.FE.ZS",icon:"👩‍💼",unit:"%",family:"Labor",direction:"high",description:"Female labor force participation rate",decimals:1}),
  wb({id:"unemploymentLow",name:"Lowest unemployment",shortName:"Unemployment",indicator:"SL.UEM.TOTL.ZS",icon:"💼",unit:"%",family:"Labor",direction:"low",description:"Unemployment share of total labor force",decimals:1}),
  wb({id:"cerealProduction",name:"Most cereal produced",shortName:"Cereal production",indicator:"AG.PRD.CREL.MT",icon:"🌾",unit:"metric tons",family:"Agriculture",direction:"high",description:"Total cereal production",decimals:0,minimumYear:2020}),
  wb({id:"cerealYield",name:"Highest cereal yield",shortName:"Cereal yield",indicator:"AG.YLD.CREL.KG",icon:"🌽",unit:"kg/hectare",family:"Agriculture",direction:"high",description:"Cereal yield per harvested hectare",decimals:0,minimumYear:2020}),
  wb({id:"foodExportsShare",name:"Highest food share of exports",shortName:"Food exports",indicator:"TX.VAL.FOOD.ZS.UN",icon:"🍎",unit:"% of merchandise exports",family:"Trade",direction:"high",description:"Food exports as a share of merchandise exports",decimals:1,expectedRange:[0,100]}),
  wb({id:"foodImportsShare",name:"Highest food share of imports",shortName:"Food imports",indicator:"TM.VAL.FOOD.ZS.UN",icon:"🥫",unit:"% of merchandise imports",family:"Trade",direction:"high",description:"Food imports as a share of merchandise imports",decimals:1,expectedRange:[0,100]}),
  wb({id:"merchExports",name:"Largest merchandise exports",shortName:"Merchandise exports",indicator:"TX.VAL.MRCH.CD.WT",icon:"🚢",unit:"USD",family:"Trade",direction:"high",description:"Merchandise exports in current US dollars"}),
  wb({id:"highTechExports",name:"Largest high-tech exports",shortName:"High-tech exports",indicator:"TX.VAL.TECH.CD",icon:"🛰️",unit:"USD",family:"Trade",direction:"high",description:"High-technology exports in current US dollars"}),
  wb({id:"co2Total",name:"Highest total CO₂ emissions",shortName:"CO₂ emissions",indicator:"EN.ATM.CO2E.KT",icon:"🏭",unit:"kt CO₂",family:"Environment",direction:"high",description:"Carbon dioxide emissions excluding land-use change"}),
  wb({id:"co2PerCapita",name:"Highest CO₂ emissions per person",shortName:"CO₂ per capita",indicator:"EN.ATM.CO2E.PC",icon:"☁️",unit:"metric tons/person",family:"Environment",direction:"high",description:"Carbon dioxide emissions per capita",decimals:2}),
  wb({id:"electricityAccess",name:"Highest electricity access",shortName:"Electricity access",indicator:"EG.ELC.ACCS.ZS",icon:"🔋",unit:"%",family:"Infrastructure",direction:"high",description:"Population with access to electricity",decimals:1,expectedRange:[0,100]}),
  wb({id:"sanitation",name:"Highest safely managed sanitation access",shortName:"Sanitation access",indicator:"SH.STA.SMSS.ZS",icon:"🚿",unit:"%",family:"Infrastructure",direction:"high",description:"Population using safely managed sanitation services",decimals:1,expectedRange:[0,100]}),
  wb({id:"journalArticles",name:"Most scientific journal articles",shortName:"Scientific articles",indicator:"IP.JRN.ARTC.SC",icon:"🔬",unit:"articles",family:"Knowledge",direction:"high",description:"Scientific and technical journal articles"}),
  wb({id:"patents",name:"Most resident patent applications",shortName:"Patent applications",indicator:"IP.PAT.RESD",icon:"💡",unit:"applications",family:"Knowledge",direction:"high",description:"Patent applications filed by residents"}),
  wb({id:"militarySpend",name:"Highest military spending",shortName:"Military spending",indicator:"MS.MIL.XPND.CD",icon:"🛡️",unit:"USD",family:"Government",direction:"high",description:"Military expenditure in current US dollars"}),
  wb({id:"urbanAbsolute",name:"Largest urban population",shortName:"Urban population total",indicator:"SP.URB.TOTL",icon:"🌆",unit:"people",family:"Population",direction:"high",description:"Total population living in urban areas"}),
  wb({id:"ruralAbsolute",name:"Largest rural population",shortName:"Rural population total",indicator:"SP.RUR.TOTL",icon:"🌄",unit:"people",family:"Population",direction:"high",description:"Total population living in rural areas"}),
  wb({id:"healthSpendShare",name:"Highest health spending share",shortName:"Health spending % GDP",indicator:"SH.XPD.CHEX.GD.ZS",icon:"⚕️",unit:"% of GDP",family:"Health",direction:"high",description:"Current health expenditure as a share of GDP",decimals:1,expectedRange:[0,30]}),
  wb({id:"servicesShare",name:"Largest services sector",shortName:"Services",indicator:"NV.SRV.TOTL.ZS",icon:"🏦",unit:"% of GDP",family:"Economy",direction:"high",description:"Services value added as a share of GDP",decimals:1,expectedRange:[0,100]}),
  wb({id:"industryShare",name:"Largest industrial sector",shortName:"Industry",indicator:"NV.IND.TOTL.ZS",icon:"🏗️",unit:"% of GDP",family:"Economy",direction:"high",description:"Industry value added as a share of GDP",decimals:1,expectedRange:[0,100]}),
  wb({id:"exportsShare",name:"Highest exports share of GDP",shortName:"Exports % GDP",indicator:"NE.EXP.GNFS.ZS",icon:"📤",unit:"% of GDP",family:"Economy",direction:"high",description:"Exports of goods and services as a share of GDP",decimals:1}),
  wb({id:"grossSavings",name:"Highest gross savings rate",shortName:"Gross savings",indicator:"NY.GNS.ICTR.ZS",icon:"🏦",unit:"% of GDP",family:"Economy",direction:"high",description:"Gross domestic savings as a share of GDP",decimals:1,expectedRange:[-100,100]}),
  wb({id:"investmentShare",name:"Highest investment share",shortName:"Investment",indicator:"NE.GDI.TOTL.ZS",icon:"🏗️",unit:"% of GDP",family:"Economy",direction:"high",description:"Gross capital formation as a share of GDP",decimals:1,expectedRange:[0,100]}),
  wb({id:"householdConsumption",name:"Highest household consumption",shortName:"Household consumption",indicator:"NE.CON.PRVT.CD",icon:"🛒",unit:"USD",family:"Economy",direction:"high",description:"Household final consumption expenditure"}),
  wb({id:"governmentConsumption",name:"Highest government consumption",shortName:"Government consumption",indicator:"NE.CON.GOVT.CD",icon:"🏛️",unit:"USD",family:"Government",direction:"high",description:"General government final consumption expenditure"}),
  wb({id:"merchImports",name:"Largest merchandise imports",shortName:"Merchandise imports",indicator:"TM.VAL.MRCH.CD.WT",icon:"📥",unit:"USD",family:"Trade",direction:"high",description:"Merchandise imports in current US dollars"}),
  wb({id:"fixedBroadband",name:"Most fixed broadband subscriptions",shortName:"Fixed broadband",indicator:"IT.NET.BBND.P2",icon:"🛜",unit:"per 100 people",family:"Technology",direction:"high",description:"Fixed broadband subscriptions per 100 people",decimals:1}),
  wb({id:"fixedTelephone",name:"Most fixed telephone subscriptions",shortName:"Fixed telephones",indicator:"IT.MLT.MAIN.P2",icon:"☎️",unit:"per 100 people",family:"Technology",direction:"high",description:"Fixed telephone subscriptions per 100 people",decimals:1}),
  wb({id:"basicWater",name:"Highest basic drinking-water access",shortName:"Drinking water access",indicator:"SH.H2O.BASW.ZS",icon:"🚰",unit:"%",family:"Infrastructure",direction:"high",description:"Population using at least basic drinking-water services",decimals:1,expectedRange:[0,100]}),
  wb({id:"renewableConsumption",name:"Highest renewable energy consumption",shortName:"Renewable consumption",indicator:"EG.FEC.RNEW.ZS",icon:"♻️",unit:"%",family:"Energy",direction:"high",description:"Renewable energy share of total final energy consumption",decimals:1,expectedRange:[0,100]}),
  wb({id:"agLandArea",name:"Largest agricultural land area",shortName:"Agricultural land area",indicator:"AG.LND.AGRI.K2",icon:"🚜",unit:"km²",family:"Agriculture",direction:"high",description:"Total agricultural land area"}),
  wb({id:"airFreight",name:"Most air freight",shortName:"Air freight",indicator:"IS.AIR.GOOD.MT.K1",icon:"🛫",unit:"million ton-km",family:"Transport",direction:"high",description:"Freight carried by registered air carriers",decimals:1}),
  wb({id:"railFreight",name:"Most rail freight",shortName:"Rail freight",indicator:"IS.RRS.GOOD.MT.K6",icon:"🚂",unit:"million ton-km",family:"Transport",direction:"high",description:"Goods transported by railways",decimals:1,coverageFloor:80,certificationGrade:"B"}),
  wb({id:"methane",name:"Highest methane emissions",shortName:"Methane emissions",indicator:"EN.ATM.METH.KT.CE",icon:"🌫️",unit:"kt CO₂ equivalent",family:"Environment",direction:"high",description:"Total methane emissions in CO₂-equivalent terms"}),
  wb({id:"roadFatalities",name:"Lowest road fatality rate",shortName:"Road fatalities",indicator:"SH.STA.TRAF.P5",icon:"🚗",unit:"per 100,000",family:"Transport",direction:"low",description:"Estimated road traffic deaths per 100,000 people",decimals:1}),
  wb({id:"oilRents",name:"Highest oil-rent dependence",shortName:"Oil rents",indicator:"NY.GDP.PETR.RT.ZS",icon:"🛢️",unit:"% of GDP",family:"Resources",direction:"high",description:"Oil rents as a share of GDP",decimals:2}),
  wb({id:"gasRents",name:"Highest natural-gas-rent dependence",shortName:"Natural gas rents",indicator:"NY.GDP.NGAS.RT.ZS",icon:"🔥",unit:"% of GDP",family:"Resources",direction:"high",description:"Natural gas rents as a share of GDP",decimals:2}),
  wb({id:"mineralRents",name:"Highest mineral-rent dependence",shortName:"Mineral rents",indicator:"NY.GDP.MINR.RT.ZS",icon:"⛏️",unit:"% of GDP",family:"Resources",direction:"high",description:"Mineral rents as a share of GDP",decimals:2}),
  wb({id:"militaryShare",name:"Highest military spending share",shortName:"Military spending % GDP",indicator:"MS.MIL.XPND.GD.ZS",icon:"🪖",unit:"% of GDP",family:"Government",direction:"high",description:"Military expenditure as a share of GDP",decimals:2}),
];
