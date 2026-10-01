"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";
export function AnalyticsTracker() {
  const path = usePathname();
  useEffect(() => {
    if (path === "/") track("landing_view");
    if (path === "/today") track("daily_view");
    if (path === "/leaderboard") track("leaderboard_view");
  }, [path]);
  useEffect(() => {
    const listener = () => {
      if (location.pathname === "/login") track("sign_in_started");
    };
    document.addEventListener("submit", listener);
    return () => document.removeEventListener("submit", listener);
  }, []);
  return null;
}
export function AnalyticsPreference() {
  const [enabled, setEnabled] = useState(false),
    [status, setStatus] = useState("");
  useEffect(() => {
    try {
      setEnabled(localStorage.getItem("musicale-analytics") === "yes");
    } catch {}
  }, []);
  return (
    <section className="panel">
      <h2>Optional product analytics</h2>
      <p>
        Off by default. When enabled, signed-in visits and actions contribute to
        daily event totals. We store no analytics identifiers, IP addresses,
        email addresses or song choices. Counts older than 90 days are removed
        on subsequent analytics activity. Your browser’s Do Not Track setting is
        respected.
      </p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            try {
              localStorage.setItem(
                "musicale-analytics",
                e.target.checked ? "yes" : "no",
              );
              setEnabled(e.target.checked);
              setStatus("Preference saved on this browser.");
            } catch {
              setStatus(
                "This browser could not save the preference. Analytics remains off.",
              );
            }
          }}
        />
        Allow anonymous aggregate product counts when I’m signed in
      </label>
      <p role="status">{status}</p>
    </section>
  );
}
