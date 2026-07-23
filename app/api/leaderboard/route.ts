import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/server";
import { newYorkDate } from "../../../lib/time";
import { RULES_VERSION } from "../../../lib/version";

type Profile = { username?: string; display_name?: string | null };
type ScoreRow = {
  user_id: string;
  challenge_date: string;
  score: number;
  average_placement: number | string;
  firsts: number;
  top_fives: number;
  profiles: Profile | Profile[] | null;
};

type LeaderEntry = { username: string; displayName: string | null; scores: number[] };
const dailyDate = () => newYorkDate();
const profileOf = (raw: ScoreRow["profiles"]) => Array.isArray(raw) ? raw[0] : raw;

export async function GET(request: Request) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ configured: false, leaders: [] });
  const url = new URL(request.url);
  const view = url.searchParams.get("view") === "today" ? "today" : "alltime";
  let query = supabase.from("daily_scores").select("user_id,challenge_date,score,average_placement,firsts,top_fives,profiles(username,display_name)");

  if (view === "today") {
    query = query.eq("challenge_date", url.searchParams.get("date") || dailyDate());
  } else {
    // Raw 800-point scores from the former 10-country / 8-category format are
    // not mixed with the new 600-point era.
    const { data: currentChallenges, error: challengeError } = await supabase
      .from("daily_challenges")
      .select("challenge_date")
      .eq("rules_version", RULES_VERSION);
    if (challengeError) return NextResponse.json({ error: challengeError.message }, { status: 500 });
    const dates = ((currentChallenges ?? []) as { challenge_date: string }[]).map((row) => row.challenge_date);
    if (!dates.length) return NextResponse.json({ view, baseline: 375, leaders: [] });
    query = query.in("challenge_date", dates);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as ScoreRow[];

  if (view === "today") {
    const leaders = rows.map((row) => {
      const profile = profileOf(row.profiles);
      return {
        username: profile?.username ?? "player",
        displayName: profile?.display_name ?? null,
        score: row.score,
        averagePlacement: Number(row.average_placement),
        firsts: row.firsts,
        topThrees: row.top_fives,
      };
    }).sort((a, b) => b.score - a.score || a.averagePlacement - b.averagePlacement || b.firsts - a.firsts || b.topThrees - a.topThrees).slice(0, 100);
    return NextResponse.json({ view, date: url.searchParams.get("date") || dailyDate(), leaders }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
  }

  const byUser = new Map<string, LeaderEntry>();
  for (const row of rows) {
    const profile = profileOf(row.profiles);
    const current: LeaderEntry = byUser.get(row.user_id) ?? { username: profile?.username ?? "player", displayName: profile?.display_name ?? null, scores: [] };
    current.scores.push(row.score);
    byUser.set(row.user_id, current);
  }
  const allScores = [...byUser.values()].flatMap((entry) => entry.scores);
  const baseline = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 375;
  const confidenceGames = 20;
  const leaders = [...byUser.values()].map((entry) => {
    const games = entry.scores.length;
    const average = entry.scores.reduce((a, b) => a + b, 0) / games;
    const rating = (average * games + baseline * confidenceGames) / (games + confidenceGames);
    return { username: entry.username, displayName: entry.displayName, games, average: Math.round(average), rating: Math.round(rating) };
  }).filter((entry) => entry.games >= 5).sort((a, b) => b.rating - a.rating || b.games - a.games || b.average - a.average).slice(0, 100);
  return NextResponse.json({ view, baseline: Math.round(baseline), leaders }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
