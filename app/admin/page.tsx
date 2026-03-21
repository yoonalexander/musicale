import { adminToggleSong, adminUpsertSong } from "@/app/actions";
import { getAdminSongs, getViewerState, isDemoMode } from "@/lib/data";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, viewer, songs] = await Promise.all([
    searchParams,
    getViewerState(),
    getAdminSongs(),
  ]);

  const message = typeof params.message === "string" ? params.message : null;
  const demoMode = isDemoMode();

  if (demoMode) {
    return (
      <div className="notice-panel">
        <strong>Admin mode needs a live Supabase project.</strong>
        <p>
          The schema and seed files are included in this repo. Once env vars are
          configured and your profile is marked as admin, this page becomes fully
          interactive.
        </p>
      </div>
    );
  }

  if (!viewer.user || !viewer.isAdmin) {
    return (
      <div className="notice-panel">
        <strong>Admin access required.</strong>
        <p>Sign in with an admin account to manage the catalog.</p>
      </div>
    );
  }

  return (
    <div className="stack-xl">
      <section className="page-intro">
        <div>
          <span className="eyebrow">Admin</span>
          <h1>Manage the catalog.</h1>
          <p>
            Add canonical songs, keep metadata clean, and deactivate entries that
            should not appear in rankings or game rounds.
          </p>
        </div>
      </section>

      {message ? <div className="banner success">{message}</div> : null}

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Create or update</span>
              <h2>Song editor</h2>
            </div>
          </div>
          <form action={adminUpsertSong} className="stack">
            <label className="field">
              <span>Optional id</span>
              <input name="id" placeholder="leave blank to auto-generate" />
            </label>
            <label className="field">
              <span>Title</span>
              <input name="title" required />
            </label>
            <label className="field">
              <span>Musical title</span>
              <input name="musicalTitle" required />
            </label>
            <label className="field">
              <span>Category</span>
              <select name="category">
                <option value="broadway">Broadway</option>
                <option value="movie">Movie musical</option>
              </select>
            </label>
            <label className="field">
              <span>Artist/cast label</span>
              <input name="artistLabel" required />
            </label>
            <label className="field">
              <span>Artwork URL</span>
              <input name="artworkUrl" />
            </label>
            <label className="field">
              <span>YouTube URL</span>
              <input name="youtubeUrl" />
            </label>
            <label className="field">
              <span>Release year</span>
              <input min="1900" name="releaseYear" required type="number" />
            </label>
            <label className="field">
              <span>Tags</span>
              <input name="tags" placeholder="anthem, duet, finale" />
            </label>
            <button className="primary-button" type="submit">
              Save song
            </button>
          </form>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Catalog status</span>
              <h2>Active and inactive songs</h2>
            </div>
          </div>
          <div className="table">
            {songs.map((song) => (
              <div className="table-row rich" key={song.id}>
                <div>
                  <strong>{song.title}</strong>
                  <p>
                    {song.musicalTitle} • {song.status}
                  </p>
                </div>
                <span>{Math.round(song.eloRating)} Elo</span>
                <form action={adminToggleSong}>
                  <input name="songId" type="hidden" value={song.id} />
                  <input
                    name="nextStatus"
                    type="hidden"
                    value={song.status === "active" ? "inactive" : "active"}
                  />
                  <button className="ghost-button" type="submit">
                    {song.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                </form>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
