import Link from "next/link";

export default async function AuthCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="authCallbackPage">
      <section className="authCallbackCard">
        <span className="kicker">GeoStats account</span>
        <h1>{error ? "Sign-in failed" : "Sign-in complete"}</h1>
        {error ? (
          <>
            <p>{error}</p>
            <Link href="/daily">Return to GeoStats and request a new link</Link>
          </>
        ) : (
          <>
            <p>Your account session has been saved.</p>
            <Link href="/daily">Continue to GeoStats</Link>
          </>
        )}
      </section>
    </main>
  );
}
