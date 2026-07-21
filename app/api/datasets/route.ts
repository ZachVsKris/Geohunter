import { NextResponse } from "next/server";
import { CATEGORIES, type Category } from "../../../lib/categories";
import { fetchCategory } from "../../../lib/dataSources";

export const runtime = "nodejs";

type RequestBody = { categoryIds?: unknown };

const byId = new Map(CATEGORIES.map((category) => [category.id, category]));

function findCategories(ids: string[]) {
  return [...new Set(ids)]
    .slice(0, 20)
    .map((id) => byId.get(id))
    .filter((category): category is Category => category !== undefined && category.enabled !== false);
}

async function loadCategories(categories: Category[]) {
  const settled = await Promise.allSettled(categories.map((category) => fetchCategory(category)));
  return settled
    .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchCategory>>> => result.status === "fulfilled")
    .map((result) => result.value);
}

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const category = findCategories([id])[0];
    if (!category) return NextResponse.json({ error: "Unknown category." }, { status: 404 });
    const dataset = (await loadCategories([category]))[0];
    if (!dataset) return NextResponse.json({ error: `${category.shortName} data could not be loaded.` }, { status: 502 });
    return NextResponse.json({ dataset }, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Indicator data could not be loaded." },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    if (!Array.isArray(body.categoryIds)) {
      return NextResponse.json({ error: "categoryIds must be an array." }, { status: 400 });
    }

    const ids = body.categoryIds.filter((value): value is string => typeof value === "string");
    const datasets = await loadCategories(findCategories(ids));
    return NextResponse.json({ datasets }, {
      headers: {
        "Cache-Control": "private, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Indicator data could not be loaded." },
      { status: 502 },
    );
  }
}
