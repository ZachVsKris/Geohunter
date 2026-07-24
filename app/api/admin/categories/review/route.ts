import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

type Decision = "approved" | "rejected" | "reset";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
  const decision = body.decision as Decision;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
  if (!categoryId || !["approved", "rejected", "reset"].includes(decision)) {
    return NextResponse.json({ error: "A category and valid review decision are required." }, { status: 400 });
  }

  const { data: category, error } = await auth.admin
    .from("stat_categories")
    .select("id,title,auto_qualified,quality_score,review_status,evidence_tier,common_year,common_year_coverage,official_observation_share,modeled_observation_share,clustering_score,stability_score,quality_details")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!category) return NextResponse.json({ error: "Category not found." }, { status: 404 });
  if (decision === "approved" && !category.auto_qualified) {
    return NextResponse.json(
      { error: "This category has not passed the strict automated gate, so it cannot be approved for Daily use." },
      { status: 409 },
    );
  }

  const update = decision === "approved"
    ? { review_status: "approved", enabled: true, eligible_daily: true }
    : decision === "rejected"
      ? { review_status: "rejected", enabled: false, eligible_daily: false }
      : {
          review_status: category.auto_qualified ? "needs_review" : "candidate",
          enabled: false,
          eligible_daily: false,
        };

  const { error: updateError } = await auth.admin.from("stat_categories").update(update).eq("id", categoryId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { error: auditError } = await auth.admin.from("stat_category_reviews").insert({
    category_id: categoryId,
    reviewer_user_id: auth.user.id,
    decision,
    notes,
    quality_snapshot: {
      qualityScore: category.quality_score,
      previousReviewStatus: category.review_status,
      autoQualified: category.auto_qualified,
      evidenceTier: category.evidence_tier,
      commonYear: category.common_year,
      commonYearCoverage: category.common_year_coverage,
      officialObservationShare: category.official_observation_share,
      modeledObservationShare: category.modeled_observation_share,
      clusteringScore: category.clustering_score,
      stabilityScore: category.stability_score,
      details: category.quality_details,
    },
  });
  if (auditError) return NextResponse.json({ error: auditError.message }, { status: 500 });

  return NextResponse.json({ ok: true, categoryId, reviewStatus: update.review_status });
}
