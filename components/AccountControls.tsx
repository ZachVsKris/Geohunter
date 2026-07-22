"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

type PendingScore = { challengeDate: string; assignments: Record<string, string> };
type Props = { pendingScore?: PendingScore; results?: boolean };

const PENDING_KEY = "geostats-pending-daily-score";

export default function AccountControls({ pendingScore, results = false }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const pendingSignature = JSON.stringify(pendingScore ?? null);

  useEffect(() => {
    if (pendingScore) localStorage.setItem(PENDING_KEY, JSON.stringify(pendingScore));
  }, [pendingSignature]);

  async function savePendingScore() {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw || saving) return;
    let pending: PendingScore;
    try { pending = JSON.parse(raw) as PendingScore; } catch { return; }
    if (!pending.challengeDate || Object.keys(pending.assignments ?? {}).length !== 8) return;
    setSaving(true);
    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        localStorage.removeItem(PENDING_KEY);
        setMessage("Daily score saved to your account.");
      } else if (response.status !== 401) {
        setMessage(data.error ?? "Score could not be saved.");
      }
    } finally { setSaving(false); }
  }

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      const { data: profileRaw } = await supabase.from("profiles").select("username,display_name").eq("id", user.id).maybeSingle();
      const profile = profileRaw as { username?: string; display_name?: string | null } | null;
      setUserLabel(profile?.display_name || profile?.username || user.email?.split("@")[0] || "Account");
      await savePendingScore();
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) { setUserLabel(null); return; }
      const { data: profileRaw } = await supabase.from("profiles").select("username,display_name").eq("id", session.user.id).maybeSingle();
      const profile = profileRaw as { username?: string; display_name?: string | null } | null;
      setUserLabel(profile?.display_name || profile?.username || session.user.email?.split("@")[0] || "Account");
      await savePendingScore();
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  async function sendMagicLink() {
    if (!supabase || !email.trim()) return;
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/daily` },
    });
    setMessage(error ? error.message : "Check your email for a sign-in link.");
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setOpen(false);
    setMessage("");
  }

  return <>
    <div className={results ? "resultsAccountActions" : "accountHeaderActions"}>
      <a className={results ? "secondaryAction" : "headerButtonLink"} href="/leaderboard">{results ? "View leaderboard" : "Leaderboard"}</a>
      {userLabel ? <button onClick={() => setOpen(true)}>{userLabel}</button> : <button onClick={() => setOpen(true)}>{results && pendingScore ? "Sign in to save" : "Sign in"}</button>}
    </div>
    {open && <div className="modal accountModal" onClick={(event) => event.currentTarget === event.target && setOpen(false)}>
      <div>
        <button className="modalClose" aria-label="Close" onClick={() => setOpen(false)}>×</button>
        <span className="kicker">GeoStats account</span>
        <h2>{userLabel ? `Signed in as ${userLabel}` : "Sign in or create an account"}</h2>
        {userLabel ? <>
          <p>Your verified Daily scores are saved automatically. Random challenges do not count toward the leaderboard.</p>
          {saving && <p>Saving your completed Daily…</p>}
          <button onClick={signOut}>Sign out</button>
        </> : <>
          <p>Enter your email. We’ll send a secure sign-in link—no password needed.</p>
          <label className="emailField"><span>Email address</span><input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMagicLink()} /></label>
          <button onClick={sendMagicLink} disabled={!email.trim()}>Email me a sign-in link</button>
          <small>Google sign-in will be added after its provider is configured.</small>
        </>}
        {message && <p className="accountMessage">{message}</p>}
      </div>
    </div>}
  </>;
}
