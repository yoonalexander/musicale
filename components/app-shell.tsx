"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/app/actions";
import type { Profile } from "@/types/domain";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    id: string;
    email?: string;
  } | null;
  profile: Profile | null;
  isAdmin: boolean;
}

const navItems = [
  { href: "/", label: "Home" },
  { href: "/rank", label: "Data Mode" },
  { href: "/play", label: "Game Mode" },
  { href: "/leaderboard", label: "Leaderboards" },
  { href: "/songs", label: "Songs" },
] as const satisfies ReadonlyArray<{ href: Route; label: string }>;

export function AppShell({ children, user, profile, isAdmin }: AppShellProps) {
  const pathname = usePathname();
  const isImmersiveMode = pathname === "/rank" || pathname === "/play";

  if (isImmersiveMode) {
    return (
      <div className="shell shell--immersive">
        <main className="page-frame page-frame--immersive">{children}</main>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">M</span>
          <div>
            <strong>musicale</strong>
            <p>Rank the songs that know how to bring the house down.</p>
          </div>
        </Link>

        <nav className="nav">
          {navItems.map((item) => (
            <Link key={item.href} className="nav-link" href={item.href}>
              {item.label}
            </Link>
          ))}
          {isAdmin ? (
            <Link className="nav-link accent" href="/admin">
              Admin
            </Link>
          ) : null}
        </nav>

        <div className="account-chip">
          {user ? (
            <>
              <div>
                <strong>{profile?.displayName ?? user.email ?? "Signed in"}</strong>
                <p>{isAdmin ? "Administrator" : "Community voter"}</p>
              </div>
              <form action={signOutAction}>
                <button className="ghost-button" type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link className="ghost-button" href="/login">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="page-frame">{children}</main>
    </div>
  );
}
