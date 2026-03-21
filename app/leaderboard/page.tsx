import { getPlayerLeaderboard, getSongLeaderboard } from "@/lib/data";
import { formatRating } from "@/lib/format";

export default async function LeaderboardPage() {
  const [songs, runs] = await Promise.all([
    getSongLeaderboard(),
    getPlayerLeaderboard(),
  ]);

  return (
    <div className="stack-xl">
      <section className="page-intro">
        <div>
          <span className="eyebrow">Leaderboards</span>
          <h1>See what the crowd has crowned.</h1>
          <p>
            One board tracks song quality through head-to-head voting. The other
            tracks the bravest higher-lower streaks.
          </p>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Song ranking</span>
              <h2>Global song leaderboard</h2>
            </div>
          </div>
          <div className="table">
            {songs.map((song, index) => (
              <div className="table-row" key={song.id}>
                <span>#{index + 1}</span>
                <div>
                  <strong>{song.title}</strong>
                  <p>
                    {song.musicalTitle} • {song.artistLabel}
                  </p>
                </div>
                <span>{formatRating(song.eloRating)} Elo</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Player ranking</span>
              <h2>High score board</h2>
            </div>
          </div>
          <div className="table">
            {runs.length > 0 ? (
              runs.map((run, index) => (
                <div className="table-row" key={run.id}>
                  <span>#{index + 1}</span>
                  <div>
                    <strong>{run.displayName ?? "Anonymous Ensemble"}</strong>
                    <p>{new Date(run.endedAt).toLocaleDateString()}</p>
                  </div>
                  <span>{run.score} pts</span>
                </div>
              ))
            ) : (
              <div className="empty-inline">
                No saved runs yet. Sign in and set the opening benchmark.
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
