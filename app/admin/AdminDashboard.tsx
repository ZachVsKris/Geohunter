"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type MouseEvent } from "react";

type ReviewStatus = "candidate" | "needs_review" | "approved" | "rejected";
type CategoryRow = {
  id: string;
  title: string;
  source_organization: string;
  source_dataset: string;
  source_indicator_code: string;
  enabled: boolean;
  eligible_daily: boolean;
  quality_score: number;
  country_coverage: number;
  latest_available_year: number | null;
  family: string;
  review_status: ReviewStatus;
  evidence_tier: "A" | "B" | "C" | null;
  auto_qualified: boolean;
  common_year: number | null;
  common_year_coverage: number;
  official_observation_share: number | null;
  modeled_observation_share: number | null;
  clustering_score: number | null;
  stability_score: number | null;
  quality_standard_version: string;
};
type ImportRow = {
  id: number;
  source_organization: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  categories_processed: number;
  observations_inserted: number;
  error_message: string | null;
  details?: Record<string, unknown>;
};
type Dashboard = {
  stats: { categories: number; observations: number; countries: number };
  reviewCounts: Record<ReviewStatus, number>;
  sources: any[];
  imports: ImportRow[];
  categories: CategoryRow[];
  boards: Record<string, boolean>;
  todayScoreCount: number;
};
type DailyMode = "easy" | "normal" | "expert";
type GeneratedBoard = { countries: string[]; categories: string[] };
type ScoreBreakdown = { overall: number; quality: number; variety: number; geography: number; difficultyFit: number; competitiveness: number };
type GenerationDiagnostics = {
  eligibleDatasets: number;
  requiredDatasets: number;
  attempts: number;
  validCandidates: Partial<Record<DailyMode, number>>;
  failureStage?: string;
  message?: string;
};
type GenerationResult = {
  date: string;
  diagnostics: GenerationDiagnostics;
  scores: Record<DailyMode, ScoreBreakdown>;
  boards: Record<DailyMode, GeneratedBoard>;
};
type Observation = { country_iso3: string; country_name: string; value: number; data_year: number; metadata?: Record<string, unknown> };
type CategoryDetail = { category: CategoryRow & Record<string, any>; year: number | null; top: Observation[]; bottom: Observation[]; reviews: { decision: string; notes: string | null; created_at: string }[] };

const FAOSTAT_WORKFLOW = "https://github.com/ZachVsKris/Geohunter/actions/workflows/import-faostat.yml";

function percentage(value: number | null) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}
function formatValue(value: number, unit?: string) {
  const magnitude = Math.abs(value);
  const formatted = magnitude >= 1_000_000_000
    ? `${(value / 1_000_000_000).toFixed(2)}B`
    : magnitude >= 1_000_000
      ? `${(value / 1_000_000).toFixed(2)}M`
      : magnitude >= 1_000
        ? value.toLocaleString(undefined, { maximumFractionDigits: 1 })
        : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return unit ? `${formatted} ${unit}` : formatted;
}

export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [review, setReview] = useState("all");
  const [running, setRunning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [detail, setDetail] = useState<CategoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generation, setGeneration] = useState<GenerationResult | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Dashboard could not load.");
    setData(json);
  }, []);
  useEffect(() => { load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Dashboard could not load.")); }, [load]);

  const boardsLocked = (data?.todayScoreCount ?? 0) > 0;
  const validCandidateCount = generation
    ? (["easy", "normal", "expert"] as const).reduce((sum, mode) => sum + (generation.diagnostics.validCandidates[mode] ?? 0), 0)
    : 0;
  const filtered = useMemo(() => data?.categories.filter((category: CategoryRow) =>
    (source === "all" || category.source_organization === source)
    && (review === "all" || category.review_status === review)
    && `${category.title} ${category.source_indicator_code} ${category.family}`.toLowerCase().includes(query.toLowerCase())) ?? [], [data, query, source, review]);

  async function postWorldBank(body: any) {
    const response = await fetch("/api/admin/import/world-bank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Import failed.");
    return json;
  }
  async function generateBoards() {
    if (generating) return;
    setGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/admin/daily/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await response.json();
      if (!response.ok) throw Object.assign(new Error(json.error || "Daily generation failed."), { diagnostics: json.diagnostics });
      setGeneration(json);
      await load();
    } catch (cause: any) {
      const diagnostics = cause.diagnostics;
      setError(diagnostics
        ? `${cause.message} Eligible datasets: ${diagnostics.eligibleDatasets ?? "—"}; attempts: ${diagnostics.attempts ?? "—"}; stage: ${diagnostics.failureStage ?? "unknown"}.`
        : cause.message);
    } finally {
      setGenerating(false);
    }
  }
  async function importWorldBank() {
    if (running) return;
    setRunning(true);
    setError("");
    try {
      const start = await postWorldBank({ action: "start" });
      setProgress({ done: 0, total: start.categories.length, label: "Preparing World Bank categories" });
      const failures: any[] = [];
      for (let index = 0; index < start.categories.length; index += 1) {
        const category = start.categories[index];
        setProgress({ done: index, total: start.categories.length, label: category.shortName });
        try { await postWorldBank({ action: "category", runId: start.runId, categoryId: category.id }); }
        catch (cause: any) { failures.push({ id: category.id, error: cause.message }); }
      }
      await postWorldBank({ action: "finish", runId: start.runId, failures });
      setProgress({
        done: start.categories.length,
        total: start.categories.length,
        label: failures.length ? `Completed with ${failures.length} warning${failures.length === 1 ? "" : "s"}` : "Import completed",
      });
      await load();
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setRunning(false);
    }
  }
  async function inspectCategory(categoryId: string) {
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/categories/${encodeURIComponent(categoryId)}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Category details could not load.");
      setDetail(json);
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setDetailLoading(false);
    }
  }
  async function decide(categoryId: string, decision: "approved" | "rejected" | "reset") {
    setReviewing(categoryId);
    setError("");
    try {
      const response = await fetch("/api/admin/categories/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, decision }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Review decision failed.");
      setDetail(null);
      await load();
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setReviewing(null);
    }
  }

  if (!data) return <section className="adminLoading">{error || "Loading warehouse…"}</section>;
  return <>
    {error && <div className="adminError">{error}</div>}
    <section className="adminStatGrid">
      <article><span>Categories</span><strong>{data.stats.categories.toLocaleString()}</strong></article>
      <article><span>Countries</span><strong>{data.stats.countries.toLocaleString()}</strong></article>
      <article><span>Observations</span><strong>{data.stats.observations.toLocaleString()}</strong></article>
      <article><span>Needs review</span><strong>{data.reviewCounts.needs_review.toLocaleString()}</strong><small>Strict gate passed</small></article>
      <article><span>Today’s boards</span><strong>{Object.values(data.boards).filter(Boolean).length}/3</strong><small>Easy · Normal · Expert</small></article>
    </section>

    <section className="adminPanel puzzleIntelligence">
      <div className="adminPanelHead"><div><span className="kicker">Puzzle intelligence</span><h2>Today’s optimized boards</h2><p>Searches hundreds of valid candidates per mode, scores them, and saves the strongest distinct trio.</p></div><button className="adminPrimary" disabled={generating || running || boardsLocked} onClick={generateBoards}>{generating ? "Optimizing boards…" : boardsLocked ? "Boards locked after play" : Object.values(data.boards).some(Boolean) ? "Regenerate today’s boards" : "Generate today’s boards"}</button></div>
      {boardsLocked && <p className="adminEmpty">Today’s boards already have saved scores, so regeneration is disabled to protect the leaderboard and one-attempt rule.</p>}
      {generation ? <><div className="diagnosticStrip"><strong>{generation.diagnostics.eligibleDatasets} eligible datasets</strong><span>{generation.diagnostics.attempts} trio attempts</span><span>{validCandidateCount} valid candidates evaluated</span></div><div className="boardPreviewGrid">{(["easy", "normal", "expert"] as const).map((mode) => <article className="boardPreview" key={mode}><div className="boardPreviewHead"><div><span>{mode}</span><strong>{generation.scores[mode].overall}</strong></div><small>Optimization score</small></div><div className="scoreBars"><span>Quality {generation.scores[mode].quality}</span><span>Variety {generation.scores[mode].variety}</span><span>Geography {generation.scores[mode].geography}</span><span>Difficulty {generation.scores[mode].difficultyFit}</span></div><h3>Countries</h3><p>{generation.boards[mode].countries.join(" · ")}</p><h3>Categories</h3><p>{generation.boards[mode].categories.join(" · ")}</p></article>)}</div></> : <p className="adminEmpty">Generate the trio to see candidate diagnostics and previews here. Existing saved boards remain playable until replaced.</p>}
    </section>

    <section className="adminPanel">
      <div className="adminPanelHead"><div><span className="kicker">Data sources</span><h2>Warehouse imports</h2><p>New sources enter quarantine. No external category becomes playable merely because it imported successfully.</p></div></div>
      <div className="sourceGrid">{data.sources.map((item: any) => <article className="sourceCard" key={item.id}><div><h3>{item.name}</h3><span className={`statusPill ${item.status === "active" ? "active" : ""}`}>{item.status === "active" ? "Ready" : item.status === "importing" ? "Importing" : item.status === "error" ? "Error" : "Coming soon"}</span></div><p>{item.description}</p>{item.id === "worldbank" ? <button disabled={running} onClick={importWorldBank}>{running ? "Importing…" : "Refresh World Bank"}</button> : item.id === "faostat" ? <a className="sourceAction" href={FAOSTAT_WORKFLOW} target="_blank" rel="noreferrer">Run FAOSTAT import in GitHub</a> : <button disabled>Not available yet</button>}</article>)}</div>
      {progress.total > 0 && <div className="importProgress"><div><strong>{progress.label}</strong><span>{progress.done}/{progress.total}</span></div><progress max={progress.total} value={progress.done} /></div>}
    </section>

    <section className="adminPanel"><span className="kicker">Import history</span><h2>Recent runs</h2>{data.imports.length ? <div className="adminTableWrap"><table><thead><tr><th>Source</th><th>Status</th><th>Started</th><th>Categories</th><th>Observations</th></tr></thead><tbody>{data.imports.map((item) => <tr key={item.id}><td>{item.source_organization}</td><td><span className={`runStatus ${item.status}`}>{item.status}</span></td><td>{new Date(item.started_at).toLocaleString()}</td><td>{item.categories_processed}</td><td>{item.observations_inserted.toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="adminEmpty">No imports yet.</p>}</section>

    <section className="adminPanel">
      <div className="adminPanelHead"><div><span className="kicker">Category library</span><h2>{filtered.length} categories</h2><p>Only categories that pass the strict automated gate and receive administrator approval can enter Daily.</p></div><div className="categoryFilters"><input aria-label="Search categories" placeholder="Search categories…" value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} /><select value={source} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSource(event.target.value)}><option value="all">All sources</option>{[...new Set(data.categories.map((category) => category.source_organization))].map((organization) => <option key={organization}>{organization}</option>)}</select><select value={review} onChange={(event: ChangeEvent<HTMLSelectElement>) => setReview(event.target.value)}><option value="all">All review states</option><option value="needs_review">Needs review</option><option value="approved">Approved</option><option value="candidate">Quarantined</option><option value="rejected">Rejected</option></select></div></div>
      <div className="reviewSummary"><span><strong>{data.reviewCounts.approved}</strong> approved</span><span><strong>{data.reviewCounts.needs_review}</strong> need review</span><span><strong>{data.reviewCounts.candidate}</strong> quarantined</span><span><strong>{data.reviewCounts.rejected}</strong> rejected</span></div>
      <div className="adminTableWrap"><table><thead><tr><th>Review</th><th>Category</th><th>Source</th><th>Quality</th><th>Evidence</th><th>Common year</th><th>Official</th><th>Modeled</th><th>Cluster</th><th>Stability</th><th>Actions</th></tr></thead><tbody>{filtered.map((category) => <tr key={category.id}><td><span className={`reviewPill ${category.review_status}`}>{category.review_status.replace("_", " ")}</span></td><td><strong>{category.title}</strong><small>{category.family} · {category.source_indicator_code}</small></td><td>{category.source_organization}</td><td><strong>{category.quality_score || "—"}</strong>{category.auto_qualified && <small>strict pass</small>}</td><td>{category.evidence_tier ?? "—"}</td><td>{category.common_year ?? category.latest_available_year ?? "—"}<small>{category.common_year_coverage || category.country_coverage} countries</small></td><td>{percentage(category.official_observation_share)}</td><td>{percentage(category.modeled_observation_share)}</td><td>{category.clustering_score ?? "—"}</td><td>{category.stability_score ?? "—"}</td><td><div className="reviewActions"><button onClick={() => inspectCategory(category.id)} disabled={detailLoading}>{detailLoading ? "…" : "Inspect"}</button>{category.review_status === "needs_review" && <button className="approve" disabled={reviewing === category.id} onClick={() => decide(category.id, "approved")}>Approve</button>}{category.review_status !== "rejected" && category.source_organization === "FAOSTAT" && <button className="reject" disabled={reviewing === category.id} onClick={() => decide(category.id, "rejected")}>Reject</button>}{["approved", "rejected"].includes(category.review_status) && category.source_organization === "FAOSTAT" && <button disabled={reviewing === category.id} onClick={() => decide(category.id, "reset")}>Reset</button>}</div></td></tr>)}</tbody></table></div>
    </section>

    {detail && <div className="adminModalBackdrop" role="presentation" onClick={() => setDetail(null)}><section className="adminModal" role="dialog" aria-modal="true" aria-label={`${detail.category.title} review`} onClick={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}><button className="modalClose" onClick={() => setDetail(null)} aria-label="Close">×</button><span className="kicker">Candidate inspection</span><h2>{detail.category.title}</h2><p>{detail.category.description}</p><div className="qualityAuditGrid"><span><strong>{detail.category.quality_score}</strong> quality</span><span><strong>{detail.category.common_year_coverage}</strong> countries in {detail.year}</span><span><strong>{percentage(detail.category.official_observation_share)}</strong> official</span><span><strong>{percentage(detail.category.modeled_observation_share)}</strong> modeled</span><span><strong>{detail.category.clustering_score ?? "—"}</strong> distribution</span><span><strong>{detail.category.stability_score ?? "—"}</strong> year stability</span></div><div className="rankingColumns"><div><h3>Highest values</h3>{detail.top.map((observation, index) => <p key={`${observation.country_iso3}-top`}><span>{index + 1}. {observation.country_name}</span><strong>{formatValue(observation.value, detail.category.unit)}</strong></p>)}</div><div><h3>Lowest reported values</h3>{detail.bottom.map((observation, index) => <p key={`${observation.country_iso3}-bottom`}><span>{index + 1}. {observation.country_name}</span><strong>{formatValue(observation.value, detail.category.unit)}</strong></p>)}</div></div><p className="reviewWarning">Missing countries are omitted, not assigned zero. Approval is available only after the strict gate passes.</p>{detail.category.source_organization === "FAOSTAT" && <div className="modalActions">{detail.category.review_status === "needs_review" && <button className="adminPrimary" onClick={() => decide(detail.category.id, "approved")}>Approve for Daily pool</button>}<button onClick={() => decide(detail.category.id, "rejected")}>Reject category</button></div>}</section></div>}
  </>;
}
