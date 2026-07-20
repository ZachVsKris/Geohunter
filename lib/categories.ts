export type Direction = "high" | "low";
export type Category = {
  id: string;
  name: string;
  shortName: string;
  indicator: string;
  icon: string;
  unit: string;
  family: string;
  direction: Direction;
  description: string;
  decimals?: number;
};

// All enabled categories use World Bank World Development Indicators.
export const CATEGORIES: Category[] = [
  {id:"population",name:"Largest population",shortName:"Population",indicator:"SP.POP.TOTL",icon:"👥",unit:"people",family:"Population",direction:"high",description:"Total resident population"},
  {id:"populationGrowth",name:"Fastest population growth",shortName:"Population growth",indicator:"SP.POP.GROW",icon:"📈",unit:"%",family:"Population",direction:"high",description:"Annual population growth",decimals:2},
  {id:"density",name:"Highest population density",shortName:"Population density",indicator:"EN.POP.DNST",icon:"🏙️",unit:"people/km²",family:"Population",direction:"high",description:"People per square kilometer of land area",decimals:1},
  {id:"urban",name:"Most urbanized",shortName:"Urban population",indicator:"SP.URB.TOTL.IN.ZS",icon:"🏢",unit:"%",family:"Population",direction:"high",description:"Share of population living in urban areas",decimals:1},
  {id:"rural",name:"Largest rural population share",shortName:"Rural population",indicator:"SP.RUR.TOTL.ZS",icon:"🏡",unit:"%",family:"Population",direction:"high",description:"Share of population living in rural areas",decimals:1},
  {id:"life",name:"Highest life expectancy",shortName:"Life expectancy",indicator:"SP.DYN.LE00.IN",icon:"❤️",unit:"years",family:"Health",direction:"high",description:"Life expectancy at birth",decimals:1},
  {id:"fertility",name:"Highest fertility rate",shortName:"Fertility rate",indicator:"SP.DYN.TFRT.IN",icon:"👶",unit:"births/woman",family:"Health",direction:"high",description:"Total fertility rate",decimals:2},
  {id:"infantMortality",name:"Lowest infant mortality",shortName:"Infant mortality",indicator:"SP.DYN.IMRT.IN",icon:"🩺",unit:"per 1,000",family:"Health",direction:"low",description:"Infant deaths per 1,000 live births",decimals:1},
  {id:"older",name:"Oldest population",shortName:"Age 65+",indicator:"SP.POP.65UP.TO.ZS",icon:"🧓",unit:"%",family:"Population",direction:"high",description:"Population age 65 and above",decimals:1},
  {id:"young",name:"Youngest population",shortName:"Age 0–14",indicator:"SP.POP.0014.TO.ZS",icon:"🧒",unit:"%",family:"Population",direction:"high",description:"Population age 0 to 14",decimals:1},
  {id:"gdp",name:"Largest economy",shortName:"GDP",indicator:"NY.GDP.MKTP.CD",icon:"💰",unit:"USD",family:"Economy",direction:"high",description:"Gross domestic product in current US dollars"},
  {id:"gdpPc",name:"Highest GDP per person",shortName:"GDP per capita",indicator:"NY.GDP.PCAP.CD",icon:"💵",unit:"USD/person",family:"Economy",direction:"high",description:"GDP per capita in current US dollars"},
  {id:"gdpGrowth",name:"Fastest economic growth",shortName:"GDP growth",indicator:"NY.GDP.MKTP.KD.ZG",icon:"🚀",unit:"%",family:"Economy",direction:"high",description:"Annual real GDP growth",decimals:2},
  {id:"exports",name:"Largest exports",shortName:"Exports",indicator:"NE.EXP.GNFS.CD",icon:"📦",unit:"USD",family:"Economy",direction:"high",description:"Exports of goods and services"},
  {id:"imports",name:"Largest imports",shortName:"Imports",indicator:"NE.IMP.GNFS.CD",icon:"🚢",unit:"USD",family:"Economy",direction:"high",description:"Imports of goods and services"},
  {id:"manufacturing",name:"Largest manufacturing output",shortName:"Manufacturing",indicator:"NV.IND.MANF.CD",icon:"🏭",unit:"USD",family:"Economy",direction:"high",description:"Manufacturing value added"},
  {id:"agValue",name:"Largest agricultural economy",shortName:"Agriculture output",indicator:"NV.AGR.TOTL.CD",icon:"🚜",unit:"USD",family:"Agriculture",direction:"high",description:"Agriculture, forestry and fishing value added"},
  {id:"land",name:"Largest land area",shortName:"Land area",indicator:"AG.LND.TOTL.K2",icon:"🗺️",unit:"km²",family:"Land",direction:"high",description:"Total land area"},
  {id:"forestArea",name:"Most forest area",shortName:"Forest area",indicator:"AG.LND.FRST.K2",icon:"🌲",unit:"km²",family:"Land",direction:"high",description:"Land covered by forest"},
  {id:"forestPct",name:"Highest forest coverage",shortName:"Forest coverage",indicator:"AG.LND.FRST.ZS",icon:"🌳",unit:"%",family:"Land",direction:"high",description:"Forest area as a share of land area",decimals:1},
  {id:"leastForest",name:"Least forest coverage",shortName:"Least forest",indicator:"AG.LND.FRST.ZS",icon:"🪵",unit:"%",family:"Land",direction:"low",description:"Lowest forest share of land area",decimals:1},
  {id:"agLand",name:"Most farmland by percentage",shortName:"Agricultural land",indicator:"AG.LND.AGRI.ZS",icon:"🌾",unit:"%",family:"Agriculture",direction:"high",description:"Agricultural land as a share of land area",decimals:1},
  {id:"arablePct",name:"Highest arable-land percentage",shortName:"Arable land",indicator:"AG.LND.ARBL.ZS",icon:"🌱",unit:"%",family:"Agriculture",direction:"high",description:"Arable land as a share of land area",decimals:1},
  {id:"arableHa",name:"Most arable land",shortName:"Arable hectares",indicator:"AG.LND.ARBL.HA",icon:"🧑‍🌾",unit:"hectares",family:"Agriculture",direction:"high",description:"Total hectares of arable land"},
  {id:"rain",name:"Highest average rainfall",shortName:"Rainfall",indicator:"AG.LND.PRCP.MM",icon:"🌧️",unit:"mm/year",family:"Climate",direction:"high",description:"Average annual precipitation in depth",decimals:0},
  {id:"dry",name:"Lowest average rainfall",shortName:"Least rainfall",indicator:"AG.LND.PRCP.MM",icon:"🏜️",unit:"mm/year",family:"Climate",direction:"low",description:"Lowest average annual precipitation",decimals:0},
  {id:"renewable",name:"Highest renewable electricity share",shortName:"Renewable electricity",indicator:"EG.ELC.RNEW.ZS",icon:"⚡",unit:"%",family:"Energy",direction:"high",description:"Renewable sources as a share of electricity output",decimals:1},
  {id:"energyUse",name:"Highest energy use per person",shortName:"Energy use",indicator:"EG.USE.PCAP.KG.OE",icon:"🔌",unit:"kg oil eq./person",family:"Energy",direction:"high",description:"Energy use per capita",decimals:0},
  {id:"electricUse",name:"Highest electricity use per person",shortName:"Electric power use",indicator:"EG.USE.ELEC.KH.PC",icon:"💡",unit:"kWh/person",family:"Energy",direction:"high",description:"Electric power consumption per capita",decimals:0},
  {id:"internet",name:"Highest internet usage",shortName:"Internet usage",indicator:"IT.NET.USER.ZS",icon:"🌐",unit:"%",family:"Technology",direction:"high",description:"Individuals using the internet",decimals:1},
  {id:"mobile",name:"Most mobile subscriptions per person",shortName:"Mobile subscriptions",indicator:"IT.CEL.SETS.P2",icon:"📱",unit:"per 100 people",family:"Technology",direction:"high",description:"Mobile cellular subscriptions per 100 people",decimals:1},
  {id:"airPassengers",name:"Most airline passengers",shortName:"Air passengers",indicator:"IS.AIR.PSGR",icon:"✈️",unit:"passengers",family:"Transport",direction:"high",description:"Passengers carried by air transport carriers"},
  {id:"rail",name:"Most rail passengers",shortName:"Rail passengers",indicator:"IS.RRS.PASG.KM",icon:"🚆",unit:"passenger-km",family:"Transport",direction:"high",description:"Railways passenger traffic"},
  {id:"protected",name:"Highest protected-land share",shortName:"Protected land",indicator:"ER.LND.PTLD.ZS",icon:"🦌",unit:"%",family:"Environment",direction:"high",description:"Terrestrial protected areas as share of land area",decimals:1},
  {id:"freshwater",name:"Most renewable freshwater",shortName:"Freshwater resources",indicator:"ER.H2O.INTR.K3",icon:"💧",unit:"billion m³",family:"Environment",direction:"high",description:"Internal renewable freshwater resources",decimals:1},
  {id:"waterStress",name:"Highest freshwater withdrawals",shortName:"Water withdrawals",indicator:"ER.H2O.FWAG.ZS",icon:"🚰",unit:"% for agriculture",family:"Environment",direction:"high",description:"Agricultural freshwater withdrawals share",decimals:1},
  {id:"healthSpend",name:"Highest health spending per person",shortName:"Health spending",indicator:"SH.XPD.CHEX.PC.CD",icon:"🏥",unit:"USD/person",family:"Health",direction:"high",description:"Current health expenditure per capita",decimals:0},
  {id:"education",name:"Highest education spending share",shortName:"Education spending",indicator:"SE.XPD.TOTL.GD.ZS",icon:"🎓",unit:"% of GDP",family:"Education",direction:"high",description:"Government expenditure on education",decimals:2},
  {id:"femaleLabor",name:"Highest female labor participation",shortName:"Female labor force",indicator:"SL.TLF.CACT.FE.ZS",icon:"👩‍💼",unit:"%",family:"Labor",direction:"high",description:"Female labor force participation rate",decimals:1},
  {id:"unemploymentLow",name:"Lowest unemployment",shortName:"Unemployment",indicator:"SL.UEM.TOTL.ZS",icon:"💼",unit:"%",family:"Labor",direction:"low",description:"Unemployment share of total labor force",decimals:1}
];
