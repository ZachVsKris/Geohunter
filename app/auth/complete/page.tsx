"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/daily";
  return value;
}

export default function AuthCallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function finishSignIn() {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Supabase authentication is not configured.");
        return;
      }

      const url = new URL(window.location.href);
      const next = safeNext(url.searchParams.get("next"));
      const queryError = url.searchParams.get("error_description") || url.searchParams.get("error");
      if (queryError) {
        setError(queryError.replace(/\+/g, " "));
        return;
      }

      try {
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const otpType = url.searchParams.get("type");
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const hashError = hash.get("error_description") || hash.get("error");

        if (hashError) throw new Error(hashError.replace(/\+/g, " "));

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (tokenHash && otpType) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as "email" | "magiclink" | "recovery" | "invite" | "email_change",
          });
          if (verifyError) throw verifyError;
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!data.session) throw new Error("The sign-in link did not include a valid authentication session. Request a new link and try again.");
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) throw userError || new Error("GeoStats could not confirm the signed-in account.");

        if (!cancelled) window.location.replace(next);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "GeoStats could not complete sign-in.");
      }
    }

    finishSignIn();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="authCallbackPage">
      <section className="authCallbackCard">
        <span className="kicker">GeoStats account</span>
        <h1>{error ? "Sign-in failed" : "Completing sign-in…"}</h1>
        {error ? (
          <>
            <p>{error}</p>
            <a href="/daily">Return to GeoStats and request a new link</a>
          </>
        ) : (
          <p>Please wait while GeoStats securely saves your session.</p>
        )}
      </section>
    </main>
  );
}
