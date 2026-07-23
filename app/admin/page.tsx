import { redirect } from "next/navigation";
import AccountControls from "../../components/AccountControls";
import AdminDashboard from "./AdminDashboard";
import { createSupabaseAdminClient, createSupabaseServerClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const auth = await createSupabaseServerClient();
  if (!auth) return <main className="adminGate"><h1>GeoStats Admin</h1><p>Supabase is not configured.</p></main>;
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/daily?admin=signin");
  const admin = createSupabaseAdminClient();
  const { data } = admin ? await admin.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle() : { data: null };
  if (!data) return <main className="adminGate"><div className="adminGateCard"><span className="kicker">GeoStats Admin</span><h1>Access restricted</h1><p>This signed-in account is not on the administrator allowlist.</p><a href="/daily">Return to the game</a></div></main>;
  return <main className="adminShell">
    <header className="adminHeader"><div><span className="kicker">Control center</span><h1>GeoStats Admin</h1></div><div className="adminHeaderActions"><a href="/daily">View game</a><AccountControls /></div></header>
    <AdminDashboard />
  </main>;
}
