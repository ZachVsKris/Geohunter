export type Direction = "high" | "low";
export type DataSourceId = "worldbank" | "faostat" | "who" | "unesco" | "untourism" | "naturalearth";
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

// Every playable category is certified against one authoritative dataset.
// External-source categories can use the same schema once their independent adapter and verifier ship.
const wb = (category: Omit<Category, "source" | "dataset" | "certified" | "certificationGrade" | "coverageFloor"> & Partial<Pick<Category, "certificationGrade" | "coverageFloor">>): Category => ({
  source: "worldbank",
  dataset: "World Development Indicators",
  certified: true,
  certificationGrade: category.certificationGrade ?? "A",
  coverageFloor: category.coverageFloor ?? 100,
  ...category,
  minimumYear: Math.max(2022, category.minimumYear ?? 2022),
});


const fao = (category: Omit<Category, "source" | "dataset" | "certified" | "certificationGrade" | "coverageFloor"> & Partial<Pick<Category, "certificationGrade" | "coverageFloor">>): Category => ({
  source: "faostat",
  dataset: "Crops and livestock products (QCL)",
  certified: true,
  certificationGrade: category.certificationGrade ?? "A",
  coverageFloor: category.coverageFloor ?? 70,
  ...category,
  minimumYear: Math.max(2022, category.minimumYear ?? 2022),
});


const distributed = (source: Extract<DataSourceId, "who" | "unesco" | "untourism">, dataset: string, category: Omit<Category, "source" | "dataset" | "certified" | "certificationGrade" | "coverageFloor"> & Partial<Pick<Category, "certificationGrade" | "coverageFloor">>): Category => ({
  source,
  dataset,
  certified: true,
  certificationGrade: category.certificationGrade ?? "A",
  coverageFloor: category.coverageFloor ?? 90,
  ...category,
  minimumYear: Math.max(2022, category.minimumYear ?? 2022),
});

const who = (category: Parameters<typeof distributed>[2]) => distributed("who", "WHO Global Health Observatory (distributed through WDI)", category);
const unesco = (category: Parameters<typeof distributed>[2]) => distributed("unesco", "UNESCO Institute for Statistics (distributed through WDI)", category);
const tourism = (category: Parameters<typeof distributed>[2]) => distributed("untourism", "UN Tourism statistics (distributed through WDI)", category);

export const CATEGORIES: Category[] = [
  wb({id:"waterStress",name:"Highest agricultural share of freshwater withdrawals",shortName:"Agricultural water share",indicator:"ER.H2O.FWAG.ZS",icon:"🚰",unit:"% for agriculture",family:"Environment",direction:"high",description:"Agriculture share of total freshwater withdrawals",decimals:1}),
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
  // FAOSTAT QCL. Indicator format is item-code:element-filter-code. Production uses filter element 2510 and tonnes.

  fao({id:"faoWheat",name:"Largest wheat producer",shortName:"Wheat production",indicator:"15:2510",icon:"🌾",unit:"tonnes",family:"FAOSTAT cereals",direction:"high",description:"Production quantity of wheat",minimumYear:2019,requireCommonYear:false,expectedRange:[0,1000000000],coverageFloor:100}),
  fao({id:"faoRice",name:"Largest rice producer",shortName:"Rice production",indicator:"27:2510",icon:"🍚",unit:"tonnes",family:"FAOSTAT cereals",direction:"high",description:"Production quantity of rice",minimumYear:2019,expectedRange:[0,1000000000],coverageFloor:95}),
  fao({id:"faoMaize",name:"Largest maize producer",shortName:"Maize production",indicator:"56:2510",icon:"🌽",unit:"tonnes",family:"FAOSTAT cereals",direction:"high",description:"Production quantity of maize (corn)",minimumYear:2019,expectedRange:[0,2000000000],coverageFloor:100}),
  fao({id:"faoBarley",name:"Largest barley producer",shortName:"Barley production",indicator:"44:2510",icon:"🌾",unit:"tonnes",family:"FAOSTAT cereals",direction:"high",description:"Production quantity of barley",minimumYear:2019,expectedRange:[0,500000000],coverageFloor:80}),
  fao({id:"faoOats",name:"Largest oat producer",shortName:"Oat production",indicator:"75:2510",icon:"🥣",unit:"tonnes",family:"FAOSTAT cereals",direction:"high",description:"Production quantity of oats",minimumYear:2019,expectedRange:[0,100000000],coverageFloor:60}),
  fao({id:"faoSorghum",name:"Largest sorghum producer",shortName:"Sorghum production",indicator:"83:2510",icon:"🌾",unit:"tonnes",family:"FAOSTAT cereals",direction:"high",description:"Production quantity of sorghum",minimumYear:2019,expectedRange:[0,100000000],coverageFloor:75}),
  fao({id:"faoMillet",name:"Largest millet producer",shortName:"Millet production",indicator:"79:2510",icon:"🌾",unit:"tonnes",family:"FAOSTAT cereals",direction:"high",description:"Production quantity of millet",minimumYear:2019,expectedRange:[0,100000000],coverageFloor:70}),
  fao({id:"faoPotatoes",name:"Largest potato producer",shortName:"Potato production",indicator:"116:2510",icon:"🥔",unit:"tonnes",family:"FAOSTAT roots",direction:"high",description:"Production quantity of potatoes",minimumYear:2019,expectedRange:[0,500000000],coverageFloor:100}),
  fao({id:"faoSweetPotatoes",name:"Largest sweet-potato producer",shortName:"Sweet-potato production",indicator:"122:2510",icon:"🍠",unit:"tonnes",family:"FAOSTAT roots",direction:"high",description:"Production quantity of sweet potatoes",minimumYear:2019,expectedRange:[0,200000000],coverageFloor:70}),
  fao({id:"faoCassava",name:"Largest cassava producer",shortName:"Cassava production",indicator:"125:2510",icon:"🌱",unit:"tonnes",family:"FAOSTAT roots",direction:"high",description:"Production quantity of cassava",minimumYear:2019,expectedRange:[0,500000000],coverageFloor:75}),
  fao({id:"faoYams",name:"Largest yam producer",shortName:"Yam production",indicator:"137:2510",icon:"🍠",unit:"tonnes",family:"FAOSTAT roots",direction:"high",description:"Production quantity of yams",minimumYear:2019,expectedRange:[0,200000000],coverageFloor:55}),
  fao({id:"faoTomatoes",name:"Largest tomato producer",shortName:"Tomato production",indicator:"388:2510",icon:"🍅",unit:"tonnes",family:"FAOSTAT vegetables",direction:"high",description:"Production quantity of tomatoes",minimumYear:2019,expectedRange:[0,300000000],coverageFloor:100}),
  fao({id:"faoOnions",name:"Largest dry-onion producer",shortName:"Dry onion production",indicator:"403:2510",icon:"🧅",unit:"tonnes",family:"FAOSTAT vegetables",direction:"high",description:"Production quantity of onions and shallots, dry",minimumYear:2019,expectedRange:[0,200000000],coverageFloor:90}),
  fao({id:"faoApples",name:"Largest apple producer",shortName:"Apple production",indicator:"515:2510",icon:"🍎",unit:"tonnes",family:"FAOSTAT fruit",direction:"high",description:"Production quantity of apples",minimumYear:2019,expectedRange:[0,200000000],coverageFloor:80}),
  fao({id:"faoBananas",name:"Largest banana producer",shortName:"Banana production",indicator:"486:2510",icon:"🍌",unit:"tonnes",family:"FAOSTAT fruit",direction:"high",description:"Production quantity of bananas",minimumYear:2019,expectedRange:[0,300000000],coverageFloor:100}),
  fao({id:"faoGrapes",name:"Largest grape producer",shortName:"Grape production",indicator:"560:2510",icon:"🍇",unit:"tonnes",family:"FAOSTAT fruit",direction:"high",description:"Production quantity of grapes",minimumYear:2019,expectedRange:[0,200000000],coverageFloor:80}),
  fao({id:"faoOranges",name:"Largest orange producer",shortName:"Orange production",indicator:"490:2510",icon:"🍊",unit:"tonnes",family:"FAOSTAT fruit",direction:"high",description:"Production quantity of oranges",minimumYear:2019,expectedRange:[0,200000000],coverageFloor:80}),
  fao({id:"faoAvocados",name:"Largest avocado producer",shortName:"Avocado production",indicator:"572:2510",icon:"🥑",unit:"tonnes",family:"FAOSTAT fruit",direction:"high",description:"Production quantity of avocados",minimumYear:2019,expectedRange:[0,50000000],coverageFloor:60}),
  fao({id:"faoCoffee",name:"Largest coffee producer",shortName:"Coffee production",indicator:"656:2510",icon:"☕",unit:"tonnes",family:"FAOSTAT cash crops",direction:"high",description:"Production quantity of green coffee",minimumYear:2019,expectedRange:[0,20000000],coverageFloor:65}),
  fao({id:"faoCocoa",name:"Largest cocoa-bean producer",shortName:"Cocoa production",indicator:"661:2510",icon:"🍫",unit:"tonnes",family:"FAOSTAT cash crops",direction:"high",description:"Production quantity of cocoa beans",minimumYear:2019,expectedRange:[0,20000000],coverageFloor:45}),

];
