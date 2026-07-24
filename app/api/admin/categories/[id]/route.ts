import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;

  const { data: category, error } = await auth.admin
    .from("stat_categories")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!category) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  const year = category.common_year ?? category.latest_available_year;
  if (!year) return NextResponse.json({ category, year: null, top: [], bottom: [], reviews: [] });

  const [top, bottom, reviews] = await Promise.all([
    auth.admin
      .from("stat_observations")
      .select("country_iso3,country_name,value,data_year,metadata")
      .eq("category_id", id)
      .eq("data_year", year)
      .order("value", { ascending: false })
      .limit(12),
    auth.admin
      .from("stat_observations")
      .select("country_iso3,country_name,value,data_year,metadata")
      .eq("category_id", id)
      .eq("data_year", year)
      .order("value", { ascending: true })
      .limit(12),
    auth.admin
      .from("stat_category_reviews")
      .select("decision,notes,created_at")
      .eq("category_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const firstError = top.error ?? bottom.error ?? reviews.error;
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });
  return NextResponse.json({ category, year, top: top.data ?? [], bottom: bottom.data ?? [], reviews: reviews.data ?? [] });
}
