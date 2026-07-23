import { createSupabaseAdminClient, createSupabaseServerClient } from "./server";

export async function requireAdmin() {
  const authClient = await createSupabaseServerClient();
  if (!authClient) return { ok: false as const, status: 503, error: "Supabase is not configured." };
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Sign in to continue." };
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false as const, status: 503, error: "The server admin key is not configured." };
  const { data, error } = await admin.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (error || !data) return { ok: false as const, status: 403, error: "This account is not a GeoStats administrator." };
  return { ok: true as const, user, admin };
}
