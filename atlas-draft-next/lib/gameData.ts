export type Country = {
  name: string;
  flag: string;
  region: string;
  population: number;
  gdp: number;
  area: number;
  life: number;
  coast: number;
  forest: number;
  elevation: number;
  military: number;
  renewable: number;
  urban: number;
  literacy: number;
  tourism: number;
};

export type CategoryKey = Exclude<keyof Country, "name" | "flag" | "region">;
export type Category = { key: CategoryKey; name: string; icon: string; unit: string };

export const countries: Country[] = [
  {name:'United States',flag:'🇺🇸',region:'North America',population:335,gdp:29.2,area:9.83,life:77.5,coast:19924,forest:33.9,elevation:6190,military:997,renewable:21.4,urban:83.3,literacy:99,tourism:66.5},
  {name:'China',flag:'🇨🇳',region:'Asia',population:1408,gdp:18.5,area:9.60,life:78.0,coast:14500,forest:23.4,elevation:8849,military:314,renewable:30.7,urban:66.2,literacy:97,tourism:35.5},
  {name:'India',flag:'🇮🇳',region:'Asia',population:1450,gdp:3.9,area:3.29,life:67.7,coast:7000,forest:24.6,elevation:8586,military:83.6,renewable:20.5,urban:36.9,literacy:77.7,tourism:9.5},
  {name:'Brazil',flag:'🇧🇷',region:'South America',population:212,gdp:2.3,area:8.52,life:75.8,coast:7491,forest:59.4,elevation:2995,military:20.7,renewable:89.0,urban:87.6,literacy:94.7,tourism:6.8},
  {name:'Japan',flag:'🇯🇵',region:'Asia',population:124,gdp:4.1,area:.378,life:84.5,coast:29751,forest:68.4,elevation:3776,military:55.3,renewable:24.0,urban:92.0,literacy:99,tourism:36.9},
  {name:'Germany',flag:'🇩🇪',region:'Europe',population:84.5,gdp:4.7,area:.357,life:81.2,coast:2389,forest:32.7,elevation:2962,military:66.8,renewable:52.0,urban:77.8,literacy:99,tourism:37.5},
  {name:'France',flag:'🇫🇷',region:'Europe',population:68.4,gdp:3.2,area:.552,life:82.4,coast:4853,forest:31.5,elevation:4809,military:61.3,renewable:27.0,urban:81.5,literacy:99,tourism:100},
  {name:'United Kingdom',flag:'🇬🇧',region:'Europe',population:68.3,gdp:3.6,area:.244,life:81.0,coast:12429,forest:13.2,elevation:1345,military:74.9,renewable:46.4,urban:84.6,literacy:99,tourism:38},
  {name:'Italy',flag:'🇮🇹',region:'Europe',population:58.9,gdp:2.4,area:.301,life:83.7,coast:7600,forest:32.5,elevation:4809,military:35.5,renewable:36.8,urban:71.9,literacy:99.2,tourism:57.3},
  {name:'Canada',flag:'🇨🇦',region:'North America',population:41,gdp:2.2,area:9.98,life:82.3,coast:202080,forest:38.7,elevation:5959,military:29.0,renewable:67.1,urban:82.7,literacy:99,tourism:18.3},
  {name:'Mexico',flag:'🇲🇽',region:'North America',population:130,gdp:1.8,area:1.96,life:75.0,coast:9330,forest:33.9,elevation:5636,military:11.8,renewable:24.1,urban:81.6,literacy:95.2,tourism:45},
  {name:'Australia',flag:'🇦🇺',region:'Oceania',population:27.2,gdp:1.8,area:7.69,life:83.2,coast:25760,forest:17.4,elevation:2228,military:33.8,renewable:39.4,urban:86.5,literacy:99,tourism:9.5},
  {name:'Indonesia',flag:'🇮🇩',region:'Asia',population:281,gdp:1.5,area:1.91,life:71.1,coast:54716,forest:49.1,elevation:4884,military:9.5,renewable:19.6,urban:58.6,literacy:96,tourism:13.9},
  {name:'Turkey',flag:'🇹🇷',region:'Asia / Europe',population:85.4,gdp:1.3,area:.784,life:78.3,coast:7200,forest:28.9,elevation:5137,military:15.8,renewable:42.0,urban:77,literacy:97.6,tourism:55.2},
  {name:'Saudi Arabia',flag:'🇸🇦',region:'Middle East',population:33.7,gdp:1.1,area:2.15,life:78.8,coast:2640,forest:.5,elevation:3000,military:75.8,renewable:1.4,urban:85,literacy:98,tourism:27.4},
  {name:'South Korea',flag:'🇰🇷',region:'Asia',population:51.7,gdp:1.9,area:.100,life:83.4,coast:2413,forest:64.5,elevation:1950,military:47.9,renewable:9.6,urban:81.5,literacy:99,tourism:16.4},
  {name:'Argentina',flag:'🇦🇷',region:'South America',population:46.1,gdp:.64,area:2.78,life:76.1,coast:4989,forest:10.4,elevation:6961,military:3.1,renewable:39.1,urban:92.3,literacy:99,tourism:7.3},
  {name:'South Africa',flag:'🇿🇦',region:'Africa',population:63.2,gdp:.40,area:1.22,life:66.1,coast:2798,forest:14.1,elevation:3450,military:2.8,renewable:10.4,urban:68.8,literacy:95,tourism:8.9},
  {name:'Egypt',flag:'🇪🇬',region:'Africa',population:114.5,gdp:.40,area:1.00,life:70.2,coast:2450,forest:.1,elevation:2629,military:5.2,renewable:11.8,urban:43,literacy:74.5,tourism:15.7},
  {name:'Nigeria',flag:'🇳🇬',region:'Africa',population:229,gdp:.36,area:.924,life:54.5,coast:853,forest:23.7,elevation:2419,military:3.2,renewable:23.1,urban:54.3,literacy:62,tourism:1.2},
  {name:'Kenya',flag:'🇰🇪',region:'Africa',population:55.3,gdp:.12,area:.580,life:63.6,coast:536,forest:6.3,elevation:5199,military:1.3,renewable:89.6,urban:29.5,literacy:82.6,tourism:2.1},
  {name:'Norway',flag:'🇳🇴',region:'Europe',population:5.6,gdp:.53,area:.385,life:83.3,coast:58133,forest:33.5,elevation:2469,military:8.7,renewable:98.5,urban:83.7,literacy:99,tourism:6.2},
  {name:'Sweden',flag:'🇸🇪',region:'Europe',population:10.6,gdp:.59,area:.450,life:83.4,coast:3218,forest:68.7,elevation:2097,military:12.0,renewable:69.2,urban:88.5,literacy:99,tourism:7.5},
  {name:'Finland',flag:'🇫🇮',region:'Europe',population:5.6,gdp:.30,area:.338,life:81.9,coast:1250,forest:73.7,elevation:1324,military:7.3,renewable:52.4,urban:85.7,literacy:100,tourism:4.9},
  {name:'New Zealand',flag:'🇳🇿',region:'Oceania',population:5.3,gdp:.25,area:.268,life:82.1,coast:15134,forest:38.6,elevation:3724,military:3.0,renewable:87.9,urban:87,literacy:99,tourism:3.2},
  {name:'Chile',flag:'🇨🇱',region:'South America',population:19.8,gdp:.34,area:.756,life:81.2,coast:6435,forest:24.3,elevation:6893,military:5.5,renewable:63.0,urban:88.0,literacy:96.4,tourism:5.2},
  {name:'Peru',flag:'🇵🇪',region:'South America',population:34.2,gdp:.27,area:1.29,life:73.4,coast:2414,forest:57.7,elevation:6768,military:3.8,renewable:58.2,urban:79.1,literacy:94.5,tourism:2.5},
  {name:'Mongolia',flag:'🇲🇳',region:'Asia',population:3.5,gdp:.020,area:1.56,life:71.0,coast:0,forest:8.0,elevation:4374,military:.15,renewable:9.2,urban:69.1,literacy:98.4,tourism:.65},
  {name:'Iceland',flag:'🇮🇸',region:'Europe',population:.39,gdp:.033,area:.103,life:83.0,coast:4970,forest:.5,elevation:2110,military:0,renewable:99.9,urban:94,literacy:99,tourism:2.2},
  {name:'Vietnam',flag:'🇻🇳',region:'Asia',population:101,gdp:.47,area:.331,life:74.6,coast:3444,forest:47.2,elevation:3143,military:7.8,renewable:44.0,urban:40.4,literacy:95.8,tourism:17.6}
];

export const categories: Category[] = [
  {key:'population',name:'Population',icon:'👥',unit:'M people'},
  {key:'gdp',name:'GDP',icon:'💰',unit:'$T'},
  {key:'area',name:'Land area',icon:'🗺️',unit:'M km²'},
  {key:'life',name:'Life expectancy',icon:'❤️',unit:'years'},
  {key:'coast',name:'Coastline',icon:'🌊',unit:'km'},
  {key:'forest',name:'Forest coverage',icon:'🌲',unit:'%'},
  {key:'elevation',name:'Highest point',icon:'⛰️',unit:'m'},
  {key:'military',name:'Military spending',icon:'🛡️',unit:'$B'},
  {key:'renewable',name:'Renewable electricity',icon:'⚡',unit:'%'},
  {key:'urban',name:'Urban population',icon:'🏙️',unit:'%'},
  {key:'literacy',name:'Literacy rate',icon:'📚',unit:'%'},
  {key:'tourism',name:'International visitors',icon:'✈️',unit:'M'}
];
