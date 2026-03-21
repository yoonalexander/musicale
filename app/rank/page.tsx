import Link from "next/link";

import { submitRankVote } from "@/app/actions";
import { ImmersiveSongPanel } from "@/components/immersive-song-panel";
import { getRankPair, getViewerState, isDemoMode } from "@/lib/data";

export default async function RankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [pair, viewer, params] = await Promise.all([
    getRankPair(),
    getViewerState(),
    searchParams,
  ]);

  const flash = typeof params.flash === "string" ? params.flash : null;
  const error = typeof params.error === "string" ? params.error : null;
  const demoMode = isDemoMode();

  if (!pair) {
    return (
      <div className="notice-panel">
        <strong>Not enough active songs for a head-to-head vote.</strong>
        <p>Seed more songs or activate more catalog entries to continue.</p>
      </div>
    );
  }

  return (
    <section className="focus-stage focus-stage--data">
      <div className="focus-stage__hud">
        <div className="focus-stage__badge">Data Mode</div>
        <div>
          <span className="focus-stage__meta-label">Voting status</span>
          <strong className="focus-stage__meta-value">
            {viewer.user
              ? `${Math.max(viewer.remainingVotes ?? 0, 0)} votes left`
              : "Login required"}
          </strong>
        </div>
        <div>
          <span className="focus-stage__meta-label">Rule</span>
          <strong className="focus-stage__meta-status">
            Pick the better song without seeing the current rank.
          </strong>
        </div>
      </div>

      <div className="focus-stage__alerts">
        {flash ? <div className="focus-stage__alert focus-stage__alert--success">{flash}</div> : null}
        {error ? <div className="focus-stage__alert focus-stage__alert--error">{error}</div> : null}
        {demoMode ? (
          <div className="focus-stage__alert">
            Connect Supabase to enable persistent Elo updates and daily vote
            limits. The matchup UI is ready, but votes are disabled in demo
            mode.
          </div>
        ) : null}
        {!viewer.user ? (
          <div className="focus-stage__alert">
            <Link href="/login">Sign in</Link> to contribute ranking data and
            keep spam voting in check.
          </div>
        ) : null}
      </div>

      <div className="focus-stage__split">
        <ImmersiveSongPanel
          actions={
            <form action={submitRankVote} className="focus-action-stack">
              <input name="leftSongId" type="hidden" value={pair.left.id} />
              <input name="rightSongId" type="hidden" value={pair.right.id} />
              <input name="winnerSongId" type="hidden" value={pair.left.id} />
              <button
                className="focus-decision-button"
                disabled={demoMode || !viewer.user}
                type="submit"
              >
                Vote for this song
              </button>
            </form>
          }
          label="Option A"
          metric={
            <>
              <span className="focus-metric__label">Your call</span>
              <strong className="focus-metric__value">Which song is better?</strong>
            </>
          }
          side="left"
          song={pair.left}
        />

        <div className="focus-stage__versus">OR</div>

        <ImmersiveSongPanel
          actions={
            <form action={submitRankVote} className="focus-action-stack">
              <input name="leftSongId" type="hidden" value={pair.left.id} />
              <input name="rightSongId" type="hidden" value={pair.right.id} />
              <input name="winnerSongId" type="hidden" value={pair.right.id} />
              <button
                className="focus-decision-button"
                disabled={demoMode || !viewer.user}
                type="submit"
              >
                Vote for this song
              </button>
            </form>
          }
          label="Option B"
          metric={
            <>
              <span className="focus-metric__label">Keep it instinctive</span>
              <strong className="focus-metric__value">No ranking hints shown</strong>
            </>
          }
          side="right"
          song={pair.right}
        />
      </div>

      <div className="focus-stage__corner focus-stage__corner--left">
        Daily cap: 50 votes
      </div>
      <div className="focus-stage__corner focus-stage__corner--right">
        {viewer.user ? "Authenticated voting" : "Read-only until sign in"}
      </div>
    </section>
  );
}
