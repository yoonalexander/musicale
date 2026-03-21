import type { Metadata } from "next";

import "./globals.css";

import { AppShell } from "@/components/app-shell";
import { getViewerState } from "@/lib/data";

export const metadata: Metadata = {
  title: "musicale",
  description: "A ranking game that builds a global leaderboard for musical songs.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await getViewerState();

  return (
    <html lang="en">
      <body>
        <AppShell
          isAdmin={viewer.isAdmin}
          profile={viewer.profile}
          user={viewer.user}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
