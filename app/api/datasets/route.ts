import { NextResponse } from "next/server";
import { CATEGORIES, type Category } from "../../../lib/categories";
import { fetchCategory } from "../../../lib/dataSources";

export const runtime = "nodejs";

type RequestBody = { categoryIds?: unknown };

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
      .filter((category): category is Category => category !== undefined && category.enabled !== false);

    const settled = await Promise.allSettled(categories.map((category) => fetchCategory(category)));
    const datasets = settled
      .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchCategory>>> => result.status === "fulfilled")
      .map((result) => result.value);

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
