import { redirect } from "next/navigation";
import { getViewerState, getVoteHistory } from "@/lib/data";

export default async function ProfilePage() {
  const v = await getViewerState();
  if (!v.user) redirect("/login?message=Sign+in+to+view+your+profile");
  const history = await getVoteHistory();
  const p = v.profile;
  const agreement = history.length
    ? Math.round(
        (100 * history.filter((h) => h.agreement > 50).length) / history.length,
      )
    : 0;
  const genres = new Map<string, number>();
  history.forEach((h) => {
    if (h.genre) genres.set(h.genre, (genres.get(h.genre) ?? 0) + 1);
  });
  const favorite = [...genres].sort((a, b) => b[1] - a[1])[0];
  return (
    <section className="page">
      <header className="page-title">
        <p className="kicker">Your listening instinct</p>
        <h1>{p?.displayName ?? "Listener"}</h1>
        <p>Member since {p ? p.createdAt.slice(0, 10) : "today"}</p>
      </header>
      <dl className="stats">
        <div>
          <dt>Current streak</dt>
          <dd>{p?.currentStreak ?? 0}</dd>
        </div>
        <div>
          <dt>Longest streak</dt>
          <dd>{p?.longestStreak ?? 0}</dd>
        </div>
        <div>
          <dt>Total votes</dt>
          <dd>{p?.totalVotes ?? 0}</dd>
        </div>
      </dl>
      {history.length >= 5 ? (
        <section className="panel">
          <h2>Your recent listening pattern</h2>
          <p>
            You chose the current majority in {agreement}% of your last{" "}
            {history.length} votes. Ties don’t count as majority picks.
          </p>
          {favorite && favorite[1] >= 3 ? (
            <p>
              Most selected genre in this sample: {favorite[0]} ({favorite[1]}{" "}
              votes).
            </p>
          ) : null}
          <p>
            These patterns describe your recorded picks, not a complete music
            preference profile.
          </p>
        </section>
      ) : (
        <p>Listening patterns appear after at least five votes.</p>
      )}
      <section className="panel">
        <h2>Recent votes</h2>
        {history.length ? (
          <ul className="vote-history">
            {history.map((h) => (
              <li key={h.id}>
                <strong>
                  {h.matchup_day} · {h.title}
                </strong>
                <p>
                  {h.artist_name} · Rating moved +{h.rating_delta} ·{" "}
                  {h.agreement}% agree so far
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>Vote in your first daily matchup to begin your history.</p>
        )}
      </section>
    </section>
  );
}
