import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { CATEGORY_SET_VERSION, DATASET_VERSION, RULES_VERSION } from "../../../../lib/version";

function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }

export async function GET(_request: Request, context: { params: Promise<{ date: string }> }) {
  const { date } = await context.params;
  if (!validDate(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ configured: false }, { status: 503 });
  const { data, error } = await supabase.from("daily_challenges").select("challenge_date,seed,encoded_board").eq("challenge_date", date).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ found: false }, { status: 404 });
  return NextResponse.json({ found: true, ...data }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" } });
}

export async function POST(request: Request, context: { params: Promise<{ date: string }> }) {
  const { date } = await context.params;
  if (!validDate(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ configured: false }, { status: 503 });
  const body = await request.json().catch(() => null) as { seed?: string; encodedBoard?: string } | null;
  if (!body?.seed || !body.encodedBoard || body.encodedBoard.length > 30000) return NextResponse.json({ error: "Invalid board." }, { status: 400 });
  const boardHash = createHash("sha256").update(body.encodedBoard).digest("hex");
  const { data: existing } = await supabase.from("daily_challenges").select("seed,encoded_board").eq("challenge_date", date).maybeSingle();
  if (existing) return NextResponse.json({ created: false, seed: existing.seed, encoded_board: existing.encoded_board });
  const { data, error } = await supabase.from("daily_challenges").insert({
    challenge_date: date,
    seed: body.seed,
    encoded_board: body.encodedBoard,
    board_hash: boardHash,
    dataset_version: DATASET_VERSION,
    rules_version: RULES_VERSION,
    category_set_version: CATEGORY_SET_VERSION,
  }).select("seed,encoded_board").single();
  if (error) {
    const { data: raced } = await supabase.from("daily_challenges").select("seed,encoded_board").eq("challenge_date", date).maybeSingle();
    if (raced) return NextResponse.json({ created: false, seed: raced.seed, encoded_board: raced.encoded_board });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ created: true, ...data });
}
