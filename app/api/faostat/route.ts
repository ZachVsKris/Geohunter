import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 86400;

const API = "https://fenixservices.fao.org/faostat/api/v1/en/data/QCL";
const ALLOWED = /^\d+:2510$/;

export async function GET(request: NextRequest) {
  const indicator = request.nextUrl.searchParams.get("indicator") ?? "";
  if (!ALLOWED.test(indicator)) return NextResponse.json({ error: "Invalid FAOSTAT indicator." }, { status: 400 });
  const [item, element] = indicator.split(":");
  const currentYear = new Date().getUTCFullYear();
  const years = Array.from({ length: 9 }, (_, index) => currentYear - index - 1).join(",");
  const params = new URLSearchParams({
    element,
    item,
    year: years,
    area_cs: "ISO3",
    show_code: "1",
    show_unit: "1",
    show_flags: "1",
    null_values: "0",
    limit: "-1",
    output_type: "objects",
  });
  const response = await fetch(`${API}?${params}`, {
    headers: { "User-Agent": "Geo-Second-Coming/2.3 (FAOSTAT verification adapter)" },
    next: { revalidate: 86400 },
  });
  if (!response.ok) return NextResponse.json({ error: `FAOSTAT request failed (${response.status}).` }, { status: 502 });
  const body = await response.json();
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
