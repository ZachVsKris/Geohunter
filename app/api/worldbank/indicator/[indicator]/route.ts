import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 604800;

export async function GET(_request: Request, context: { params: Promise<{ indicator: string }> }) {
  const { indicator } = await context.params;
  if (!/^[A-Z0-9.]+$/i.test(indicator)) {
    return NextResponse.json({ error: "Invalid indicator" }, { status: 400 });
  }
  const url = `https://api.worldbank.org/v2/country/all/indicator/${encodeURIComponent(indicator)}?format=json&per_page=20000&mrnev=8`;
  const response = await fetch(url, { next: { revalidate } });
  if (!response.ok) return NextResponse.json({ error: "World Bank indicator unavailable" }, { status: 502 });
  const body = await response.text();
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
