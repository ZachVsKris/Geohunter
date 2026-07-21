import { NextResponse } from "next/server";
import { fetchCountries } from "../../../lib/worldBank";

export const runtime = "nodejs";

export async function GET() {
  try {
    const countries = await fetchCountries();
    return NextResponse.json({ countries }, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Country data could not be loaded." },
      { status: 502 },
    );
  }
}
