import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 2592000;

export async function GET() {
  const response = await fetch("https://api.worldbank.org/v2/country?format=json&per_page=400", {
    next: { revalidate },
  });
  if (!response.ok) return NextResponse.json({ error: "World Bank country list unavailable" }, { status: 502 });
  const body = await response.text();
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=86400",
    },
  });
}
