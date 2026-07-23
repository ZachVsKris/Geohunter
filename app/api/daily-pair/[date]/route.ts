import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { decodeRound } from "../../../../lib/challengeCodec";
import { fetchCountries } from "../../../../lib/worldBank";
import { ROUND_CONFIGS, type DailyDifficulty } from "../../../../lib/gameRules";
import { CATEGORY_SET_VERSION, DATASET_VERSION, RULES_VERSION } from "../../../../lib/version";

function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }
type PackedBoard = { seed?: string; encodedBoard?: string };
type PairBody = Partial<Record<DailyDifficulty, PackedBoard>>;
type StoredRow = { challenge_date: string; difficulty: DailyDifficulty; seed: string; encoded_board: string };

function shape(rows: StoredRow[]) {
  const result: Partial<Record<DailyDifficulty, { seed: string; encoded_board: string }>> = {};
  for (const row of rows) result[row.difficulty] = { seed: row.seed, encoded_board: row.encoded_board };
  return result;
}

async function readStored(date: string) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { supabase: null, rows: [] as StoredRow[], error: null };
  const { data, error } = await supabase
    .from("daily_challenges")
    .select("challenge_date,difficulty,seed,encoded_board")
    .eq("challenge_date", date)
    .in("difficulty", ["easy", "expert"]);
  return { supabase, rows: (data ?? []) as StoredRow[], error };
}

export async function GET(_request: Request, context: { params: Promise<{ date: string }> }) {
  const { date } = await context.params;
  if (!validDate(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  const { supabase, rows, error } = await readStored(date);
  if (!supabase) return NextResponse.json({ configured: false }, { status: 503 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = shape(rows);
  return NextResponse.json({ found: Boolean(result.easy && result.expert), ...result }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" },
  });
}

export async function POST(request: Request, context: { params: Promise<{ date: string }> }) {
  const { date } = await context.params;
  if (!validDate(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  const body = await request.json().catch(() => null) as PairBody | null;
  if (!body?.easy?.seed || !body.easy.encodedBoard || !body?.expert?.seed || !body.expert.encodedBoard) {
    return NextResponse.json({ error: "Both Daily boards are required." }, { status: 400 });
  }
  if (body.easy.encodedBoard.length > 30000 || body.expert.encodedBoard.length > 30000) {
    return NextResponse.json({ error: "Invalid board." }, { status: 400 });
  }

  const { supabase, rows: existingRows, error: existingError } = await readStored(date);
  if (!supabase) return NextResponse.json({ configured: false }, { status: 503 });
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  const existing = shape(existingRows);
  if (existing.easy && existing.expert) return NextResponse.json({ created: false, ...existing });

  try {
    const countries = await fetchCountries();
    const easyPacked = existing.easy?.encoded_board ?? body.easy.encodedBoard;
    const expertPacked = existing.expert?.encoded_board ?? body.expert.encodedBoard;
    const easy = decodeRound(easyPacked, countries);
    const expert = decodeRound(expertPacked, countries);
    if (easy.categories.length !== ROUND_CONFIGS.easy.categoryCount || easy.bank.length !== ROUND_CONFIGS.easy.countryCount) {
      throw new Error("The Easy board has incorrect dimensions.");
    }
    if (expert.categories.length !== ROUND_CONFIGS.expert.categoryCount || expert.bank.length !== ROUND_CONFIGS.expert.countryCount) {
      throw new Error("The Expert board has incorrect dimensions.");
    }
    const easyCategories = new Set(easy.categories.map((dataset) => dataset.category.id));
    if (expert.categories.some((dataset) => easyCategories.has(dataset.category.id))) {
      throw new Error("The Daily boards repeat a category.");
    }
    const easyCountries = new Set(easy.bank.map((country) => country.id));
    if (expert.bank.filter((country) => easyCountries.has(country.id)).length > 2) {
      throw new Error("The Daily boards share more than two countries.");
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Daily pair validation failed." }, { status: 400 });
  }

  const missing = (["easy", "expert"] as DailyDifficulty[]).filter((difficulty) => !existing[difficulty]);
  const insertRows = missing.map((difficulty) => {
    const packed = body[difficulty]!;
    return {
      challenge_date: date,
      difficulty,
      seed: packed.seed,
      encoded_board: packed.encodedBoard,
      board_hash: createHash("sha256").update(packed.encodedBoard!).digest("hex"),
      dataset_version: DATASET_VERSION,
      rules_version: RULES_VERSION,
      category_set_version: CATEGORY_SET_VERSION,
    };
  });

  if (insertRows.length) {
    const { error } = await supabase.from("daily_challenges").insert(insertRows);
    if (error) {
      const latest = await readStored(date);
      const raced = shape(latest.rows);
      if (raced.easy && raced.expert) return NextResponse.json({ created: false, ...raced });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const latest = await readStored(date);
  if (latest.error) return NextResponse.json({ error: latest.error.message }, { status: 500 });
  return NextResponse.json({ created: true, ...shape(latest.rows) });
}
