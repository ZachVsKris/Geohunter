"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

type Leader = { username: string; displayName: string | null; games: number; average: number; rating: number };

export default function AccountLeaderboard({ challengeDate, assignments, completed }: { challengeDate: string; assignments: Record<string,string>; completed: boolean }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [open, setOpen] = useState(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUserEmail(session?.user.email ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/leaderboard").then((response)=>response.json()).then((data)=>setLeaders(data.leaders ?? [])).catch(()=>setLeaders([]));
  }, [open]);

  async function signInGoogle() {
    if (!supabase) return setMessage("Supabase is not configured yet.");
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=/daily` } });
  }

  async function sendMagicLink() {
    if (!supabase || !email) return;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/daily` } });
    setMessage(error ? error.message : "Check your email for a sign-in link.");
  }

  async function saveScore() {
    const response = await fetch("/api/scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeDate, assignments }) });
    const data = await response.json();
    setMessage(response.ok ? "Daily score saved." : data.error ?? "Score could not be saved.");
  }

  async function signOut() { await supabase?.auth.signOut(); }

  return <section className="accountLeaderboard">
    <div className="accountRow">
      {userEmail ? <><span>Signed in as {userEmail}</span>{completed && <button onClick={saveScore}>Save Daily score</button>}<button onClick={signOut}>Sign out</button></> : <><strong>Join the Daily leaderboard</strong><button onClick={signInGoogle}>Continue with Google</button><input type="email" placeholder="Email address" value={email} onChange={(event)=>setEmail(event.target.value)} /><button onClick={sendMagicLink}>Email sign-in link</button></>}
      <button onClick={()=>setOpen(!open)}>{open ? "Hide leaderboard" : "Leaderboard"}</button>
    </div>
    {message && <p>{message}</p>}
    {open && <div className="leaderboardTable"><div className="leaderboardTableHeader"><span>#</span><span>Player</span><span>Average</span><span>Dailies</span><span>Rating</span></div>{leaders.length ? leaders.map((leader,index)=><div key={leader.username}><b>{index+1}</b><span>{leader.displayName || leader.username}</span><span>{leader.average}</span><span>{leader.games}</span><strong>{leader.rating}</strong></div>) : <p>No one has qualified yet. Five completed Dailies are required.</p>}</div>}
  </section>;
}
