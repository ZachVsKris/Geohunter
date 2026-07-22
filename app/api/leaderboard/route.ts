import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/server";

export async function GET() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ configured: false, leaders: [] });
  const { data, error } = await supabase.from("daily_scores").select("user_id,score,profiles(username,display_name)");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const byUser = new Map<string, { username: string; displayName: string | null; scores: number[] }>();
  for (const row of data ?? []) {
    const profileRaw = row.profiles as unknown;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw as { username?: string; display_name?: string | null } | null;
    const current = byUser.get(row.user_id) ?? { username: profile?.username ?? "player", displayName: profile?.display_name ?? null, scores: [] };
    current.scores.push(row.score);
    byUser.set(row.user_id, current);
  }
  const allScores = [...byUser.values()].flatMap((entry) => entry.scores);
  const baseline = allScores.length ? allScores.reduce((a,b)=>a+b,0)/allScores.length : 500;
  const confidenceGames = 20;
  const leaders = [...byUser.values()].map((entry) => {
    const games = entry.scores.length;
    const average = entry.scores.reduce((a,b)=>a+b,0)/games;
    const rating = (average * games + baseline * confidenceGames) / (games + confidenceGames);
    return { username: entry.username, displayName: entry.displayName, games, average: Math.round(average), rating: Math.round(rating) };
  }).filter((entry)=>entry.games>=5).sort((a,b)=>b.rating-a.rating || b.games-a.games || b.average-a.average).slice(0,100);
  return NextResponse.json({ baseline: Math.round(baseline), leaders }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
