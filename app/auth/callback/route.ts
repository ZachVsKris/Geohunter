import { NextResponse } from "next/server";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/daily";
  return value;
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const destination = new URL("/auth/complete", incoming.origin);

  incoming.searchParams.forEach((value, key) => {
    destination.searchParams.set(key, value);
  });
  destination.searchParams.set("next", safeNext(incoming.searchParams.get("next")));

  return NextResponse.redirect(destination);
}
