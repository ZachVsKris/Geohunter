import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/supabase/adminAuth";
import { newYorkDate } from "../../../../lib/time";

export const dynamic = "force-dynamic";

const CATEGORY_COLUMNS = "id,title,source_organization,source_dataset,source_indicator_code,enabled,eligible_daily,quality_score,country_coverage,latest_available_year,family,review_status,evidence_tier,auto_qualified,common_year,common_year_coverage,official_observation_share,modeled_observation_share,clustering_score,stability_score,quality_standard_version";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { admin } = auth;
  const today = newYorkDate();
  const [obsCount, countryCount, imports, sources, boards, scoreCount] = await Promise.all([
    admin.from("stat_observations").select("country_iso3", { count: "exact", head: true }),
    admin.from("countries").select("iso3", { count: "exact", head: true }).eq("playable", true),
    admin.from("stat_import_runs").select("*").order("started_at", { ascending: false }).limit(20),
    admin.from("data_sources").select("*").order("display_order"),
    admin.from("daily_challenges").select("difficulty").eq("challenge_date", today),
    admin.from("daily_scores").select("id", { count: "exact", head: true }).eq("challenge_date", today),
  ]);
  const errors = [obsCount.error, countryCount.error, imports.error, sources.error, boards.error, scoreCount.error].filter(Boolean);
  if (errors.length) return NextResponse.json({ error: errors[0]?.message || "Warehouse query failed." }, { status: 500 });

  // Supabase projects often cap a single response at 1,000 rows. Page through the
  // category library so future sources cannot silently disappear from Admin.
  const categoryRows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await admin
      .from("stat_categories")
      .select(CATEGORY_COLUMNS)
      .order("title")
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    categoryRows.push(...(page ?? []));
    if ((page ?? []).length < 1000) break;
  }

  const boardMap = { easy: false, normal: false, expert: false };
  for (const board of boards.data ?? []) {
    if (board.difficulty in boardMap) (boardMap as Record<string, boolean>)[board.difficulty] = true;
  }
  const reviewCounts = { candidate: 0, needs_review: 0, approved: 0, rejected: 0 };
  for (const category of categoryRows) {
    if (category.review_status in reviewCounts) reviewCounts[category.review_status as keyof typeof reviewCounts] += 1;
  }

  return NextResponse.json({
    stats: { categories: categoryRows.length, observations: obsCount.count ?? 0, countries: countryCount.count ?? 0 },
    reviewCounts,
    sources: sources.data ?? [],
    imports: imports.data ?? [],
    categories: categoryRows,
    boards: boardMap,
    todayScoreCount: scoreCount.count ?? 0,
  });
}
