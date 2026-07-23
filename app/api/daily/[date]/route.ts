import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { decodeRound } from "../../../../lib/challengeCodec";
import { fetchCountries } from "../../../../lib/worldBank";
import { ROUND_CONFIGS } from "../../../../lib/gameRules";
import { CATEGORY_SET_VERSION, DATASET_VERSION, RULES_VERSION } from "../../../../lib/version";

function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }

async function validNormalBoard(encodedBoard: string) {
  const countries = await fetchCountries();
  const round = decodeRound(encodedBoard, countries);
  const config = ROUND_CONFIGS.easy;
  return round.categories.length === config.categoryCount && round.bank.length === config.countryCount;
}

export async function GET(_request: Request, context: { params: Promise<{ date: string }> }) {
  const { date } = await context.params;
  if (!validDate(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ configured: false }, { status: 503 });
  const { data, error } = await supabase.from("daily_challenges").select("challenge_date,seed,encoded_board").eq("challenge_date", date).eq("difficulty", "easy").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ found: false }, { status: 404 });

  try {
    if (!await validNormalBoard(data.encoded_board)) {
      return NextResponse.json({ found: false, repairRequired: true }, { status: 404, headers: { "Cache-Control": "private, no-store, max-age=0" } });
    }
    return NextResponse.json({ found: true, ...data }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ found: false, repairRequired: true }, { status: 404, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
}

export async function POST(request: Request, context: { params: Promise<{ date: string }> }) {
  const { date } = await context.params;
  if (!validDate(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ configured: false }, { status: 503 });
  const body = await request.json().catch(() => null) as { seed?: string; encodedBoard?: string } | null;
  if (!body?.seed || !body.encodedBoard || body.encodedBoard.length > 30000) return NextResponse.json({ error: "Invalid board." }, { status: 400 });

  try {
    if (!await validNormalBoard(body.encodedBoard)) {
      return NextResponse.json({ error: "The Normal Daily must contain 8 countries and 6 categories." }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid board." }, { status: 400 });
  }

  const boardHash = createHash("sha256").update(body.encodedBoard).digest("hex");
  const { data: existing } = await supabase.from("daily_challenges").select("seed,encoded_board").eq("challenge_date", date).eq("difficulty", "easy").maybeSingle();
  if (existing) {
    try {
      if (await validNormalBoard(existing.encoded_board)) {
        return NextResponse.json({ created: false, repaired: false, seed: existing.seed, encoded_board: existing.encoded_board });
      }
    } catch {
      // Replace malformed legacy board below.
    }
  }

  if (existing) {
    const { error: scoreCleanupError } = await supabase
      .from("daily_scores")
      .delete()
      .eq("challenge_date", date)
      .eq("difficulty", "easy");
    if (scoreCleanupError) return NextResponse.json({ error: scoreCleanupError.message }, { status: 500 });
  }

  const row = {
    challenge_date: date,
    difficulty: "easy",
    seed: body.seed,
    encoded_board: body.encodedBoard,
    board_hash: boardHash,
    dataset_version: DATASET_VERSION,
    rules_version: RULES_VERSION,
    category_set_version: CATEGORY_SET_VERSION,
  };
  const { data, error } = await supabase.from("daily_challenges")
    .upsert(row, { onConflict: "challenge_date,difficulty" })
    .select("seed,encoded_board")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ created: !existing, repaired: Boolean(existing), ...data });
}
