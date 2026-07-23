import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "../../../lib/supabase/server";
import { decodeRound } from "../../../lib/challengeCodec";
import { fetchCountries } from "../../../lib/worldBank";
import { scorePlacements } from "../../../lib/dataEngine";
import { ROUND_CONFIGS, type DailyDifficulty } from "../../../lib/gameRules";

function parseDifficulty(value: unknown): DailyDifficulty {
  return value === "easy" || value === "expert" ? value : "normal";
}

export async function POST(request: Request) {
  const authClient = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!authClient || !admin) return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to save your score." }, { status: 401 });
  const body = await request.json().catch(() => null) as {
    challengeDate?: string;
    difficulty?: DailyDifficulty;
    assignments?: Record<string,string>;
  } | null;
  const difficulty = parseDifficulty(body?.difficulty);
  if (!body?.challengeDate || !body.assignments || Object.keys(body.assignments).length === 0) {
    return NextResponse.json({ error: "Invalid score submission." }, { status: 400 });
  }
  const { data: challenge, error: challengeError } = await admin
    .from("daily_challenges")
    .select("encoded_board")
    .eq("challenge_date", body.challengeDate)
    .eq("difficulty", difficulty)
    .single();
  if (challengeError || !challenge) return NextResponse.json({ error: "Daily challenge not found." }, { status: 404 });
  try {
    const countries = await fetchCountries();
    const round = decodeRound(challenge.encoded_board, countries);
    const config = ROUND_CONFIGS[difficulty];
    if (round.categories.length !== config.categoryCount || round.bank.length !== config.countryCount) {
      return NextResponse.json({ error: "This Daily board has the wrong dimensions and must be reloaded before scoring." }, { status: 409 });
    }
    if (Object.keys(body.assignments).length !== round.categories.length) {
      return NextResponse.json({ error: "Invalid score submission." }, { status: 400 });
    }
    const rows = scorePlacements(round.categories, round.bank, body.assignments);
    const score = rows.reduce((sum, row) => sum + row.selected.points, 0);
    const averagePlacement = rows.reduce((sum, row) => sum + row.selected.poolRank, 0) / rows.length;
    const firsts = rows.filter((row) => row.selected.poolRank === 1).length;
    const topFinishes = rows.filter((row) => row.selected.poolRank <= config.topFinishRank).length;
    const { data, error } = await admin.from("daily_scores").upsert({
      user_id: user.id,
      challenge_date: body.challengeDate,
      difficulty,
      score,
      average_placement: averagePlacement,
      firsts,
      top_fives: topFinishes,
      assignments: body.assignments,
    }, { onConflict: "user_id,challenge_date,difficulty", ignoreDuplicates: true })
      .select("score,average_placement,firsts,top_fives,difficulty")
      .single();
    if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      saved: true,
      result: data ?? { score, average_placement: averagePlacement, firsts, top_fives: topFinishes, difficulty },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Score verification failed." }, { status: 400 });
  }
}
