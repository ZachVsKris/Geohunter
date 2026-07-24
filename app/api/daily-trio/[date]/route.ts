import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { decodeRound, type Round } from "../../../../lib/challengeCodec";
import { fetchCountries, type CountryInfo } from "../../../../lib/worldBank";
import { DAILY_DIFFICULTIES, ROUND_CONFIGS, type DailyDifficulty } from "../../../../lib/gameRules";
import { CATEGORY_SET_VERSION, DATASET_VERSION, RULES_VERSION } from "../../../../lib/version";

function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }
type PackedBoard = { seed?: string; encodedBoard?: string };
type TrioBody = Partial<Record<DailyDifficulty, PackedBoard>>;
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

function roundsAreDistinct(first: Round, second: Round) {
  const firstCategories = new Set(first.categories.map((dataset) => dataset.category.id));
  if (second.categories.some((dataset) => firstCategories.has(dataset.category.id))) return false;
  const firstCountries = new Set(first.bank.map((country) => country.id));
  return second.bank.filter((country) => firstCountries.has(country.id)).length <= 1;
}

function trioIsDistinct(rounds: Record<DailyDifficulty, Round>) {
  for (let i = 0; i < DAILY_DIFFICULTIES.length; i++) {
    for (let j = i + 1; j < DAILY_DIFFICULTIES.length; j++) {
      if (!roundsAreDistinct(rounds[DAILY_DIFFICULTIES[i]], rounds[DAILY_DIFFICULTIES[j]])) return false;
    }
  }
  return true;
}

function validateStoredRows(rows: StoredRow[], countries: CountryInfo[]) {
  const decoded: RoundShape = {};
  const rowByDifficulty = new Map<DailyDifficulty, StoredRow>();
  for (const row of rows) {
    try {
      const round = decodeRound(row.encoded_board, countries);
      if (!hasExpectedDimensions(round, row.difficulty)) continue;
      decoded[row.difficulty] = round;
      rowByDifficulty.set(row.difficulty, row);
    } catch {
      // Malformed or legacy rows are omitted and repaired by POST.
    }
  }

  // Preserve the established Normal board first, then retain only boards compatible with it.
  const acceptedRows: StoredRow[] = [];
  const acceptedRounds: RoundShape = {};
  for (const difficulty of ["normal", "expert", "easy"] as const) {
    const round = decoded[difficulty];
    const row = rowByDifficulty.get(difficulty);
    if (!round || !row) continue;
    const compatible = Object.values(acceptedRounds).every((accepted) => !accepted || roundsAreDistinct(accepted, round));
    if (!compatible) continue;
    acceptedRows.push(row);
    acceptedRounds[difficulty] = round;
  }
  return { rows: acceptedRows, rounds: acceptedRounds };
}

async function readStored(date: string) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { supabase: null, rows: [] as StoredRow[], error: null };
  const { data, error } = await supabase
    .from("daily_challenges")
    .select("challenge_date,difficulty,seed,encoded_board")
    .eq("challenge_date", date)
    .in("difficulty", [...DAILY_DIFFICULTIES]);
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
    return NextResponse.json({ found: Boolean(result.easy && result.normal && result.expert), ...result }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Daily boards could not be validated." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ date: string }> }) {
  const { date } = await context.params;
  if (!validDate(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  const body = await request.json().catch(() => null) as TrioBody | null;
  if (!body || DAILY_DIFFICULTIES.some((difficulty) => !body[difficulty]?.seed || !body[difficulty]?.encodedBoard)) {
    return NextResponse.json({ error: "All three Daily boards are required." }, { status: 400 });
  }
  if (DAILY_DIFFICULTIES.some((difficulty) => body[difficulty]!.encodedBoard!.length > 30000)) {
    return NextResponse.json({ error: "Invalid board." }, { status: 400 });
  }

  const { supabase, rows: storedRows, error: storedError } = await readStored(date);
  if (!supabase) return NextResponse.json({ configured: false }, { status: 503 });
  if (storedError) return NextResponse.json({ error: storedError.message }, { status: 500 });

  try {
    const countries = await fetchCountries();
    const validatedExisting = validateStoredRows(storedRows, countries);
    const existing = shape(validatedExisting.rows);
    if (existing.easy && existing.normal && existing.expert) {
      return NextResponse.json({ created: false, repaired: false, ...existing });
    }

    const packed = Object.fromEntries(DAILY_DIFFICULTIES.map((difficulty) => [
      difficulty,
      existing[difficulty]?.encoded_board ?? body[difficulty]!.encodedBoard!,
    ])) as Record<DailyDifficulty, string>;
    const rounds = Object.fromEntries(DAILY_DIFFICULTIES.map((difficulty) => [
      difficulty,
      decodeRound(packed[difficulty], countries),
    ])) as Record<DailyDifficulty, Round>;

    for (const difficulty of DAILY_DIFFICULTIES) {
      if (!hasExpectedDimensions(rounds[difficulty], difficulty)) {
        const config = ROUND_CONFIGS[difficulty];
        throw new Error(`The ${config.label} board must contain ${config.countryCount} countries and ${config.categoryCount} categories.`);
      }
    }
    if (!trioIsDistinct(rounds)) {
      throw new Error("The three Daily boards must have distinct categories and no more than one shared country between any two modes.");
    }

    const acceptedDifficulties = new Set(validatedExisting.rows.map((row) => row.difficulty));
    const repairedDifficulties = DAILY_DIFFICULTIES.filter((difficulty) =>
      storedRows.some((row) => row.difficulty === difficulty) && !acceptedDifficulties.has(difficulty),
    );
    if (repairedDifficulties.length) {
      const { error: scoreCleanupError } = await supabase
        .from("daily_scores")
        .delete()
        .eq("challenge_date", date)
        .in("difficulty", repairedDifficulties);
      if (scoreCleanupError) return NextResponse.json({ error: scoreCleanupError.message }, { status: 500 });
    }

    const replacements = DAILY_DIFFICULTIES
      .filter((difficulty) => !existing[difficulty])
      .map((difficulty) => ({
        challenge_date: date,
        difficulty,
        seed: body[difficulty]!.seed!,
        encoded_board: packed[difficulty],
        board_hash: createHash("sha256").update(packed[difficulty]).digest("hex"),
        dataset_version: DATASET_VERSION,
        rules_version: RULES_VERSION,
        category_set_version: CATEGORY_SET_VERSION,
      }));

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
    if (!result.easy || !result.normal || !result.expert) {
      return NextResponse.json({ error: "The repaired Daily trio could not be verified." }, { status: 500 });
    }

    return NextResponse.json({ created: true, repaired: repairedDifficulties.length > 0, ...result }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Daily trio validation failed." }, { status: 400 });
  }
}
