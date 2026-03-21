# musicale

`musicale` is a Next.js + Supabase ranking game for musical songs. It ships with:

- `Data Mode` for authenticated head-to-head ranking votes.
- `Game Mode` for a public higher-lower streak game powered by the same song ratings.
- A unified song leaderboard with category and tag filters.
- A minimal admin workflow for maintaining the song catalog.
- Supabase SQL migrations and a curated seed dataset.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add your Supabase project URL and anon key.
4. Run the SQL in `supabase/migrations/0001_initial.sql`.
5. Seed songs from `supabase/seed.sql`.
6. Start the app with `npm run dev`.

If Supabase env vars are missing, the app still renders using the curated demo catalog, but voting, auth, saved runs, and admin mutations stay disabled.
