import Link from "next/link";
import type { Route } from "next";
import {
  getLeaderboard,
  isDemoMode,
  pageSize,
  type LeaderSort,
} from "@/lib/data";

export default async function Leaderboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.min(
    10000,
    Math.max(1, Number.parseInt(params.page ?? "1") || 1),
  );
  const sort: LeaderSort = ["rating", "wins", "votes"].includes(
    params.sort ?? "",
  )
    ? (params.sort as LeaderSort)
    : "rating";
  const minimum = Math.min(
    100000,
    Math.max(0, Number.parseInt(params.minimum ?? "0") || 0),
  );
  const { songs, total } = await getLeaderboard(page, sort, minimum);
  const link = (p: number) =>
    `/leaderboard?page=${p}&sort=${sort}&minimum=${minimum}` as Route;
  return (
    <section className="page">
      <header className="page-title">
        <p className="kicker">Global ranking</p>
        <h1>The leaderboard</h1>
        <p>
          Elo rewards proven performance. Songs under five votes are marked
          provisional.
        </p>
      </header>
      {isDemoMode() ? (
        <p className="notice">
          Preview catalog — these songs have no recorded votes.
        </p>
      ) : null}
      <form className="leader-filters">
        <label>
          Sort by
          <select name="sort" defaultValue={sort}>
            <option value="rating">Elo rating</option>
            <option value="wins">Win percentage</option>
            <option value="votes">Total votes</option>
          </select>
        </label>
        <label>
          Minimum votes
          <input
            name="minimum"
            type="number"
            min="0"
            max="100000"
            defaultValue={minimum}
          />
        </label>
        <button className="button secondary">Apply</button>
      </form>
      <div className="leaderboard">
        <div className="leader-head">
          <span>Position</span>
          <span>Song</span>
          <span>Record / win rate</span>
          <span>Rating</span>
        </div>
        {songs.map((s, i) => (
          <Link className="leader-row" href={`/songs/${s.id}`} key={s.id}>
            <b>{(page - 1) * pageSize + i + 1}</b>
            <div className="leader-song">
              {s.artworkUrl ? (
                <img
                  src={s.artworkUrl}
                  alt=""
                  width="48"
                  height="48"
                  loading="lazy"
                />
              ) : null}
              <div>
                <strong>{s.title}</strong>
                <small>
                  {s.artistName} · {s.releaseYear}
                </small>
              </div>
            </div>
            <span>
              {s.wins}–{s.losses}
              <small>
                {s.matchupCount} votes ·{" "}
                {s.matchupCount
                  ? Math.round((100 * s.wins) / s.matchupCount)
                  : 0}
                % wins
              </small>
            </span>
            <b>
              {Math.round(s.eloRating)}
              {s.matchupCount < 5 ? <small>Provisional</small> : null}
            </b>
          </Link>
        ))}
      </div>
      {!songs.length ? <p>No songs match these filters.</p> : null}
      <nav className="pagination" aria-label="Leaderboard pages">
        {page > 1 ? (
          <Link className="button secondary" href={link(page - 1)}>
            Previous
          </Link>
        ) : null}
        <span>
          Page {page} · {total} songs
        </span>
        {page * pageSize < total ? (
          <Link className="button secondary" href={link(page + 1)}>
            Next
          </Link>
        ) : null}
      </nav>
    </section>
  );
}
