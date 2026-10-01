import { requestMagicLinkAction } from "@/app/actions";
import { isDemoMode } from "@/lib/data";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  return (
    <section className="auth">
      <p className="kicker">One link. No password.</p>
      <h1>Keep your vote and your streak.</h1>
      <p>We’ll email you a secure, one-time sign-in link.</p>
      {p.message ? (
        <div className="notice" role="status">
          {p.message}
        </div>
      ) : null}
      {isDemoMode() ? (
        <div className="notice">
          Supabase is not configured in this environment.
        </div>
      ) : null}
      <form action={requestMagicLinkAction}>
        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            placeholder="you@example.com"
          />
        </label>
        <button className="button" disabled={isDemoMode()}>
          Send magic link
        </button>
      </form>
    </section>
  );
}
