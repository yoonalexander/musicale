import {
  importSongs,
  scheduleMatchup,
  updateKFactor,
  updateSongStatus,
} from "@/app/actions";
import { getAdminData } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";

const example = [
  {
    id: "respect-aretha",
    title: "Respect",
    artistName: "Aretha Franklin",
    albumName: "I Never Loved a Man the Way I Love You",
    releaseYear: 1967,
    genre: "Soul",
    status: "active",
    providers: [
      {
        provider: "youtube",
        providerSongId: "JzqGZjFnYnA",
        externalUrl: "https://www.youtube.com/watch?v=JzqGZjFnYnA",
      },
    ],
  },
];
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const [data, params] = await Promise.all([getAdminData(), searchParams]);
  const playable = data.songs.filter(
    (s) =>
      s.status === "active" &&
      s.providers.some((p) => p.provider !== "musicbrainz"),
  );
  return (
    <section className="page">
      <header className="page-title">
        <p className="kicker">Editorial tools</p>
        <h1>Make tomorrow’s choice.</h1>
      </header>
      {params.message ? (
        <p className="notice" role="status">
          {params.message}
        </p>
      ) : null}
      <section className="panel">
        <h2>Schedule or replace a future matchup</h2>
        <form action={scheduleMatchup} className="admin-form">
          <label>
            Replace upcoming matchup (optional)
            <select name="replaceId">
              <option value="">Create a new matchup</option>
              {data.matchups
                .filter((m) => Date.parse(m.starts_at) > Date.now())
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.matchup_day}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Musicale day (UTC)
            <input
              name="day"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              required
            />
          </label>
          <label>
            Song A
            <select name="songA" required>
              {playable.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.title} — {s.artistName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Song B
            <select name="songB" required defaultValue={playable[1]?.id}>
              {playable.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.title} — {s.artistName}
                </option>
              ))}
            </select>
          </label>
          <button className="button" disabled={playable.length < 2}>
            Save matchup
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>Scheduled matchups and vote counts</h2>
        {data.matchups.length ? (
          <ul>
            {data.matchups.map((m) => (
              <li key={m.id}>
                {m.matchup_day} · {m.song_a_id} vs {m.song_b_id} ·{" "}
                {m.song_a_votes + m.song_b_votes} votes · {m.status}
              </li>
            ))}
          </ul>
        ) : (
          <p>No upcoming matchups.</p>
        )}
      </section>
      <section className="panel">
        <h2>Add, edit or import songs</h2>
        <p>
          Paste a JSON array (1–100 songs). Existing IDs update metadata and
          providers while preserving ratings. Use official provider links;
          verify the upload before scheduling it. Imports are atomic.
        </p>
        <form action={importSongs} className="admin-form">
          <label>
            Catalog JSON
            <textarea
              name="catalog"
              rows={12}
              required
              defaultValue={JSON.stringify(example, null, 2)}
            />
          </label>
          <button className="button">Save catalog</button>
        </form>
      </section>
      <section className="panel">
        <h2>Song availability</h2>
        {data.songs.map((s) => (
          <form key={s.id} action={updateSongStatus} className="status-form">
            <input type="hidden" name="id" value={s.id} />
            <span>
              {s.title} — {s.artistName}
            </span>
            <label>
              <span className="sr-only">Status for {s.title}</span>
              <select name="status" defaultValue={s.status}>
                <option value="active">Active</option>
                <option value="unavailable">Unavailable</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
            <button className="button secondary">Save</button>
          </form>
        ))}
      </section>
      <section className="panel">
        <h2>Elo settings</h2>
        <form action={updateKFactor} className="admin-form">
          <label>
            K-factor (future votes)
            <input
              name="kFactor"
              type="number"
              min="1"
              max="100"
              required
              defaultValue={data.kFactor}
            />
          </label>
          <button className="button">Save K-factor</button>
        </form>
      </section>
      <section className="panel">
        <h2>Recent editorial changes</h2>
        {data.audit.length ? (
          <ul>
            {data.audit.map((a) => (
              <li key={a.id}>
                {a.created_at.slice(0, 16)} UTC · {a.operation} {a.entity} ·{" "}
                {a.entity_id}
              </li>
            ))}
          </ul>
        ) : (
          <p>No editorial changes yet.</p>
        )}
      </section>
    </section>
  );
}
