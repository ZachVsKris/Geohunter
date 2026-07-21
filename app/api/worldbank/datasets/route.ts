import { NextResponse } from "next/server";
import { CATEGORIES, type Category } from "../../../../lib/categories";
import { fetchWorldBankCategoryUpstream } from "../../../../lib/worldBankUpstream";

export const runtime = "nodejs";

type RequestBody = { categoryIds?: unknown };
type Result =
  | { id: string; dataset: Awaited<ReturnType<typeof fetchWorldBankCategoryUpstream>> }
  | { id: string; error: string };

async function loadInChunks(categories: Category[], concurrency = 4): Promise<Result[]> {
  const results: Result[] = [];
  for (let offset = 0; offset < categories.length; offset += concurrency) {
    const chunk = categories.slice(offset, offset + concurrency);
    const settled = await Promise.all(
      chunk.map(async (category): Promise<Result> => {
        try {
          return { id: category.id, dataset: await fetchWorldBankCategoryUpstream(category) };
        } catch (error) {
          return { id: category.id, error: error instanceof Error ? error.message : "Dataset could not be loaded." };
        }
      }),
    );
    results.push(...settled);
  }
  return results;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    if (!Array.isArray(body.categoryIds)) {
      return NextResponse.json({ error: "categoryIds must be an array." }, { status: 400 });
    }

    const ids = [...new Set(body.categoryIds.filter((value): value is string => typeof value === "string"))].slice(0, 20);
    const byId = new Map(CATEGORIES.map((category) => [category.id, category]));
    const categories = ids
      .map((id) => byId.get(id))
      .filter((category): category is Category => Boolean(category) && category!.enabled !== false && category!.source === "worldbank");

    const results = await loadInChunks(categories);
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "private, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Indicator data could not be loaded." },
      { status: 502 },
    );
  }
}
