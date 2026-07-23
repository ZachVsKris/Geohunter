"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import type { DailyDifficulty } from "../lib/gameRules";

type PendingScore = { challengeDate: string; difficulty: DailyDifficulty; assignments: Record<string, string> };
type Props = { pendingScore?: PendingScore; results?: boolean; difficulty?: DailyDifficulty };

const pendingKey = (difficulty: DailyDifficulty) => `geostats-pending-daily-score-${difficulty}`;

export default function AccountControls({ pendingScore, results = false, difficulty = "normal" }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const pendingSignature = JSON.stringify(pendingScore ?? null);

  useEffect(() => {
    if (pendingScore) localStorage.setItem(pendingKey(pendingScore.difficulty), JSON.stringify(pendingScore));
  }, [pendingSignature]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  async function savePendingScore() {
    if (saving) return;
    setSaving(true);
    try {
      for (const difficulty of ["easy", "normal", "expert"] as const) {
        const key = pendingKey(difficulty);
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        let pending: PendingScore;
        try { pending = JSON.parse(raw) as PendingScore; } catch { continue; }
        if (!pending.challengeDate || Object.keys(pending.assignments ?? {}).length === 0) continue;
        const response = await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          localStorage.removeItem(key);
          const label = difficulty === "expert" ? "Expert" : difficulty === "easy" ? "Easy" : "Normal";
          setMessage(data.alreadyCompleted
            ? `${label} Daily was already completed. Your original score remains saved.`
            : `${label} Daily score saved to your account.`);
        } else if (response.status !== 401) {
          setMessage(data.error ?? "Score could not be saved.");
        }
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
    if (!supabase || !email.trim() || sendingLink || resendSeconds > 0) return;
    setSendingLink(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname || "/daily")}` },
      });
      if (error) {
        const rateLimited = /rate limit|too many requests/i.test(error.message);
        if (rateLimited) {
          setResendSeconds(60);
          setMessage("Too many sign-in emails were requested. Wait a minute, then try once more.");
        } else {
          setMessage(error.message);
        }
        return;
      }
      setResendSeconds(60);
      setMessage("Sign-in link sent. Check your inbox.");
    } finally {
      setSendingLink(false);
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setOpen(false);
    setMessage("");
  }

  return <>
    <div className={results ? "resultsAccountActions" : "accountHeaderActions"}>
      <a className={results ? "secondaryAction" : "headerButtonLink"} href={`/leaderboard?difficulty=${difficulty}`}>{results ? "View leaderboard" : "Leaderboard"}</a>
      {userLabel ? <button onClick={() => setOpen(true)}>{userLabel}</button> : <button onClick={() => setOpen(true)}>{results && pendingScore ? "Sign in to save" : "Sign in"}</button>}
    </div>
    {open && <div className="modal accountModal" onClick={(event) => event.currentTarget === event.target && setOpen(false)}>
      <div>
        <button className="modalClose" aria-label="Close" onClick={() => setOpen(false)}>×</button>
        <span className="kicker">GeoStats account</span>
        <h2>{userLabel ? `Signed in as ${userLabel}` : "Sign in or create an account"}</h2>
        {userLabel ? <>
          <p>Your verified Easy, Normal, and Expert Daily scores are saved automatically.</p>
          {saving && <p>Saving your completed Daily…</p>}
          <button onClick={signOut}>Sign out</button>
        </> : <>
          <p>Enter your email. We’ll send a secure sign-in link—no password needed.</p>
          <label className="emailField"><span>Email address</span><input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => event.key === "Enter" && resendSeconds === 0 && !sendingLink && sendMagicLink()} /></label>
          <button onClick={sendMagicLink} disabled={!email.trim() || sendingLink || resendSeconds > 0}>{sendingLink ? "Sending…" : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Email me a sign-in link"}</button>
          <small>Google sign-in will be added after its provider is configured.</small>
        </>}
        {message && <p className="accountMessage">{message}</p>}
      </div>
    </div>}
  </>;
}
