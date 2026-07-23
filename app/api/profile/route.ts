import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await request.json().catch(()=>null) as { username?: string } | null;
  const username = body?.username?.trim();
  if (!username || !/^[A-Za-z0-9_]{3,20}$/.test(username)) return NextResponse.json({ error: "Use 3–20 letters, numbers, or underscores." }, { status: 400 });
  const { error } = await supabase.from("profiles").update({ username, updated_at: new Date().toISOString() }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.code === "23505" ? "That username is taken." : error.message }, { status: 400 });
  return NextResponse.json({ saved: true, username });
}
