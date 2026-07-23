import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const categoryText = read("../lib/categories.ts");
const rulesText = read("../lib/gameRules.ts");
const componentText = read("../components/GeoSecondComingGame.tsx");
const migrationText = read("../supabase/migrations/003_three_daily_modes.sql");
const homePageText = read("../app/page.tsx");
const easyPageText = read("../app/daily/easy/page.tsx");
const dailyPageText = read("../app/daily/page.tsx");
const expertPageText = read("../app/daily/expert/page.tsx");
const cssText = read("../app/globals.css");
const dailyTrioRouteText = read("../app/api/daily-trio/[date]/route.ts");
const scoreRouteText = read("../app/api/scores/route.ts");
const leaderboardText = read("../components/LeaderboardView.tsx");
const leaderboardRouteText = read("../app/api/leaderboard/route.ts");
const sourceRegistryText = read("../lib/sourceRegistry.ts");

const ids = [...categoryText.matchAll(/id:"([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "Category IDs must be unique");
assert.equal(ids.length, 76, "Expected 76 category definitions");
assert.equal((categoryText.match(/wb\(\{id:/g) || []).length, 76);
assert.equal((categoryText.match(/fao\(\{id:/g) || []).length, 0);

assert.match(rulesText, /DailyDifficulty = "easy" \| "normal" \| "expert"/);
assert.match(rulesText, /categoryCount: 4/);
assert.match(rulesText, /countryCount: 5/);
assert.match(rulesText, /pointsByRank: \[100, 75, 50, 25, 0\]/);
assert.match(rulesText, /categoryCount: 6/);
assert.match(rulesText, /countryCount: 8/);
assert.match(rulesText, /pointsByRank: \[100, 85, 70, 55, 40, 25, 10, 0\]/);
assert.match(rulesText, /categoryCount: 8/);
assert.match(rulesText, /countryCount: 10/);
assert.match(rulesText, /pointsByRank: \[100, 90, 80, 70, 60, 50, 40, 30, 20, 10\]/);
assert.match(rulesText, /DEFAULT_DIFFICULTY: DailyDifficulty = "normal"/);

assert.match(componentText, /buildDailyTrio/);
assert.match(componentText, /overlapBanks/);
assert.match(componentText, /overlapBanks,\n\s*1,/);
assert.match(componentText, /Easy Daily/);
assert.match(componentText, /Normal Daily/);
assert.match(componentText, /Expert Daily/);
assert.match(componentText, /href="\/daily\/easy"/);
assert.match(componentText, /href="\/daily"/);
assert.match(componentText, /href="\/daily\/expert"/);
assert.doesNotMatch(componentText, /New random round|Seeded challenge|playRandom/);
assert.match(componentText, /Each category has a different winner/);
assert.doesNotMatch(componentText, /The two Dailies stay fresh/);

assert.match(homePageText, /redirect\("\/daily"\)/);
assert.match(easyPageText, /initialDifficulty="easy"/);
assert.match(dailyPageText, /initialDifficulty="normal"/);
assert.match(expertPageText, /initialDifficulty="expert"/);
assert.equal(fs.existsSync(new URL("../app/random/page.tsx", import.meta.url)), false, "Random route should be removed");

assert.match(cssText, /dailyModeButton\.active/);
assert.match(cssText, /compactRound/);
assert.match(cssText, /leaderboardModeTabs\{display:grid;grid-template-columns:repeat\(3,1fr\)/);
assert.match(leaderboardText, /setDifficulty\("easy"\)/);
assert.match(leaderboardText, /setDifficulty\("normal"\)/);
assert.match(leaderboardText, /setDifficulty\("expert"\)/);

assert.match(dailyTrioRouteText, /All three Daily boards are required/);
assert.match(dailyTrioRouteText, /no more than one shared country/);
assert.match(dailyTrioRouteText, /upsert\(replacements, \{ onConflict: "challenge_date,difficulty" \}\)/);
assert.match(dailyTrioRouteText, /from\("daily_scores"\)/);
assert.match(dailyTrioRouteText, /Cache-Control": "private, no-store, max-age=0"/);
assert.match(scoreRouteText, /wrong dimensions and must be reloaded before scoring/);
assert.match(migrationText, /set difficulty = 'normal' where difficulty = 'easy'/);
assert.match(migrationText, /difficulty in \('easy','normal','expert'\)/);
assert.match(migrationText, /drop constraint if exists daily_scores_challenge_date_difficulty_fkey/);
assert.match(migrationText, /add constraint daily_scores_challenge_date_difficulty_fkey/);
assert.match(migrationText, /foreign key \(challenge_date, difficulty\)/);
assert.match(leaderboardRouteText, /query = query\.lte\("score", ROUND_CONFIGS\[difficulty\]\.maxScore\)/);
assert.doesNotMatch(leaderboardRouteText, /RULES_VERSION/);
assert.match(sourceRegistryText, /scripts\/verify-worldbank\.mjs/);
assert.doesNotMatch(sourceRegistryText, /verify-seed/);
assert.equal(fs.existsSync(new URL("../scripts/verify-worldbank.mjs", import.meta.url)), true);

console.log(`Invariant tests passed (${ids.length} definitions; Easy, Normal, and Expert Dailies with separate scoring and leaderboards).`);
