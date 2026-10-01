import Link from "next/link";
import { getLeaderboard, isDemoMode } from "@/lib/data";
export default async function Home() {
  const top = (await getLeaderboard()).songs.slice(0, 3);
  return (
    <>
      <section className="hero">
        <p className="kicker">The daily music vote</p>
        <h1>
          Every day.
          <br />
          Two songs.
          <br />
          <em>One choice.</em>
        </h1>
        <p>
          Listen to today’s matchup, vote for your favorite, and help build the
          global song leaderboard.
        </p>
        <div className="actions">
          <Link className="button" href="/today">
            Play today
          </Link>
          <Link className="button secondary" href="/leaderboard">
            View leaderboard
          </Link>
        </div>
      </section>
      <section className="strip">
        <span>One shared matchup</span>
        <span>Resets at midnight UTC</span>
        <span>Results hidden until you vote</span>
      </section>
      <section className="home-board">
        <div>
          <p className="kicker">The signal so far</p>
          <h2>
            {isDemoMode()
              ? "A taste of the catalog."
              : "The crowd’s current top three."}
          </h2>
        </div>
        <ol>
          {top.map((s, i) => (
            <li key={s.id}>
              <span>0{i + 1}</span>
              <div>
                <strong>{s.title}</strong>
                <small>{s.artistName}</small>
              </div>
              <b>{Math.round(s.eloRating)}</b>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
