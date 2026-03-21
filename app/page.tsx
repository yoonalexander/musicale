import Link from "next/link";

import { ModeCard } from "@/components/mode-card";
import { getPlayerLeaderboard, getSongCount, getSongLeaderboard } from "@/lib/data";

export default async function HomePage() {
  const [songs, playerRuns, songCount] = await Promise.all([
    getSongLeaderboard(),
    getPlayerLeaderboard(3),
    getSongCount(),
  ]);

  const topSongs = songs.slice(0, 3);

  return (
    <div className="stack-xl">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Global ranking game</span>
          <h1>Build the definitive leaderboard for musical songs.</h1>
          <p>
            Vote between iconic show tunes, then test your instincts in a
            higher-lower survival mode powered by the same ranking.
          </p>
          <div className="button-row">
            <Link className="primary-button" href="/rank">
              Start ranking
            </Link>
            <Link className="secondary-button" href="/play">
              Play higher-lower
            </Link>
          </div>
        </div>

        <div className="hero-panel">
          <div className="stat-card">
            <span className="eyebrow">Catalog</span>
            <strong>{songCount}</strong>
            <p>seeded songs across Broadway and movie musicals</p>
          </div>
          <div className="stat-card">
            <span className="eyebrow">Top song</span>
            <strong>{topSongs[0]?.title ?? "Waiting in the wings"}</strong>
            <p>{topSongs[0]?.musicalTitle ?? "Seed more songs to begin"}</p>
          </div>
        </div>
      </section>

      <section className="two-column">
        <ModeCard
          cta="Open Data Mode"
          description="Help the ranking converge by choosing the better song in one clean head-to-head matchup at a time."
          eyebrow="Mode one"
          href="/rank"
          title="Data Mode"
        />
        <ModeCard
          cta="Open Game Mode"
          description="Guess whether the next song is ranked higher or lower and push your streak as far as it can go."
          eyebrow="Mode two"
          href="/play"
          title="Game Mode"
        />
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <span className="eyebrow">Current top songs</span>
            <Link href="/leaderboard">Full leaderboard</Link>
          </div>
          <div className="list">
            {topSongs.map((song, index) => (
              <div className="list-row" key={song.id}>
                <strong>#{index + 1}</strong>
                <div>
                  <p>{song.title}</p>
                  <span>{song.musicalTitle}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <span className="eyebrow">Top players</span>
            <Link href="/leaderboard">View runs</Link>
          </div>
          <div className="list">
            {playerRuns.length > 0 ? (
              playerRuns.map((run, index) => (
                <div className="list-row" key={run.id}>
                  <strong>#{index + 1}</strong>
                  <div>
                    <p>{run.displayName ?? "Anonymous Ensemble"}</p>
                    <span>{run.score} point streak</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-inline">
                No saved runs yet. The first great streak is still available.
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
