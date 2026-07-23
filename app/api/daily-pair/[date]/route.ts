import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { decodeRound, type Round } from "../../../../lib/challengeCodec";
import { fetchCountries, type CountryInfo } from "../../../../lib/worldBank";
import { ROUND_CONFIGS, type DailyDifficulty } from "../../../../lib/gameRules";
import { CATEGORY_SET_VERSION, DATASET_VERSION, RULES_VERSION } from "../../../../lib/version";

function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }
type PackedBoard = { seed?: string; encodedBoard?: string };
type PairBody = Partial<Record<DailyDifficulty, PackedBoard>>;
type StoredRow = { challenge_date: string; difficulty: DailyDifficulty; seed: string; encoded_board: string };
type StoredShape = Partial<Record<DailyDifficulty, { seed: string; encoded_board: string }>>;
type RoundShape = Partial<Record<DailyDifficulty, Round>>;

function shape(rows: StoredRow[]) {
  const result: StoredShape = {};
  for (const row of rows) result[row.difficulty] = { seed: row.seed, encoded_board: row.encoded_board };
  return result;
}

function hasExpectedDimensions(round: Round, difficulty: DailyDifficulty) {
  const config = ROUND_CONFIGS[difficulty];
  return round.categories.length === config.categoryCount && round.bank.length === config.countryCount;
}

function pairIsDistinct(easy: Round, expert: Round) {
  const easyCategories = new Set(easy.categories.map((dataset) => dataset.category.id));
  if (expert.categories.some((dataset) => easyCategories.has(dataset.category.id))) return false;
  const easyCountries = new Set(easy.bank.map((country) => country.id));
  return expert.bank.filter((country) => easyCountries.has(country.id)).length <= 2;
}

function validateStoredRows(rows: StoredRow[], countries: CountryInfo[]) {
  const validRows: StoredRow[] = [];
  const rounds: RoundShape = {};

  for (const row of rows) {
    try {
      const round = decodeRound(row.encoded_board, countries);
      if (!hasExpectedDimensions(round, row.difficulty)) continue;
      validRows.push(row);
      rounds[row.difficulty] = round;
    } catch {
      // Malformed or legacy rows are ignored and can be repaired by POST.
    }
  }

  if (rounds.easy && rounds.expert && !pairIsDistinct(rounds.easy, rounds.expert)) {
    return { rows: [] as StoredRow[], rounds: {} as RoundShape };
  }

  return { rows: validRows, rounds };
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

  try {
    const countries = await fetchCountries();
    const validated = validateStoredRows(rows, countries);
    const result = shape(validated.rows);
    return NextResponse.json({ found: Boolean(result.easy && result.expert), ...result }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Daily boards could not be validated." }, { status: 500 });
  }
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

  const { supabase, rows: storedRows, error: storedError } = await readStored(date);
  if (!supabase) return NextResponse.json({ configured: false }, { status: 503 });
  if (storedError) return NextResponse.json({ error: storedError.message }, { status: 500 });

  try {
    const countries = await fetchCountries();
    const validatedExisting = validateStoredRows(storedRows, countries);
    const existing = shape(validatedExisting.rows);

    if (existing.easy && existing.expert) {
      return NextResponse.json({ created: false, repaired: false, ...existing });
    }

    const easyPacked = existing.easy?.encoded_board ?? body.easy.encodedBoard;
    const expertPacked = existing.expert?.encoded_board ?? body.expert.encodedBoard;
    const easy = decodeRound(easyPacked, countries);
    const expert = decodeRound(expertPacked, countries);

    if (!hasExpectedDimensions(easy, "easy")) {
      throw new Error("The Normal board must contain 8 countries and 6 categories.");
    }
    if (!hasExpectedDimensions(expert, "expert")) {
      throw new Error("The Expert board must contain 10 countries and 8 categories.");
    }
    if (!pairIsDistinct(easy, expert)) {
      throw new Error("The Daily boards must have no repeated categories and no more than two shared countries.");
    }

    const repairedDifficulties = (["easy", "expert"] as DailyDifficulty[])
      .filter((difficulty) => storedRows.some((row) => row.difficulty === difficulty) && !existing[difficulty]);

    if (repairedDifficulties.length) {
      const { error: scoreCleanupError } = await supabase
        .from("daily_scores")
        .delete()
        .eq("challenge_date", date)
        .in("difficulty", repairedDifficulties);
      if (scoreCleanupError) return NextResponse.json({ error: scoreCleanupError.message }, { status: 500 });
    }

    const replacements = (["easy", "expert"] as DailyDifficulty[])
      .filter((difficulty) => !existing[difficulty])
      .map((difficulty) => {
        const supplied = body[difficulty]!;
        const encodedBoard = difficulty === "easy" ? easyPacked : expertPacked;
        const seed = existing[difficulty]?.seed ?? supplied.seed!;
        return {
          challenge_date: date,
          difficulty,
          seed,
          encoded_board: encodedBoard,
          board_hash: createHash("sha256").update(encodedBoard).digest("hex"),
          dataset_version: DATASET_VERSION,
          rules_version: RULES_VERSION,
          category_set_version: CATEGORY_SET_VERSION,
        };
      });

    if (replacements.length) {
      const { error } = await supabase
        .from("daily_challenges")
        .upsert(replacements, { onConflict: "challenge_date,difficulty" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const latest = await readStored(date);
    if (latest.error) return NextResponse.json({ error: latest.error.message }, { status: 500 });
    const validatedLatest = validateStoredRows(latest.rows, countries);
    const result = shape(validatedLatest.rows);
    if (!result.easy || !result.expert) {
      return NextResponse.json({ error: "The repaired Daily pair could not be verified." }, { status: 500 });
    }

    return NextResponse.json({ created: true, repaired: storedRows.length > validatedExisting.rows.length, ...result }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Daily pair validation failed." }, { status: 400 });
  }
}
