import { requestMagicLinkAction } from "@/app/actions";
import { isDemoMode } from "@/lib/data";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : null;
  const demoMode = isDemoMode();

  return (
    <div className="auth-layout">
      <section className="auth-card">
        <span className="eyebrow">Sign in</span>
        <h1>Keep votes trustworthy and streaks permanent.</h1>
        <p>
          Musicale uses email magic links so contributors can vote in Data Mode
          and save leaderboard runs without managing passwords.
        </p>

        {message ? <div className="banner">{message}</div> : null}
        {demoMode ? (
          <div className="banner">
            Supabase is not configured yet, so sign-in is currently in setup
            mode.
          </div>
        ) : null}

        <form action={requestMagicLinkAction} className="stack">
          <label className="field">
            <span>Email address</span>
            <input name="email" placeholder="you@example.com" type="email" />
          </label>
          <button className="primary-button" type="submit">
            Send magic link
          </button>
        </form>
      </section>
    </div>
  );
}
