import Link from "next/link";
import { signOutAction } from "@/app/actions";
import type { ViewerState } from "@/types/domain";
export function AppShell({
  children,
  viewer,
}: {
  children: React.ReactNode;
  viewer: ViewerState;
}) {
  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/">
          Musicale
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/today">Today</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          {viewer.user ? <Link href="/profile">Profile</Link> : null}
          {viewer.isAdmin ? <Link href="/admin">Admin</Link> : null}
        </nav>
        {viewer.user ? (
          <form action={signOutAction}>
            <button className="text-button">Sign out</button>
          </form>
        ) : (
          <Link className="button small" href="/login">
            Sign in
          </Link>
        )}
      </header>
      <main>{children}</main>
      <footer>
        <span>Musicale</span>
        <span>Music playback remains with its provider.</span>
      </footer>
    </>
  );
}
