# Musicale

**Every day. Two songs. One choice.** Everyone gets the same editorial matchup, listens on an official music provider, votes once, and helps build an auditable Elo leaderboard.

## Product and architecture

This rebuild replaces the previous musical-theatre ranking / higher-lower game. The July 2026 product request called for a shared daily vote loop inspired by Wordle, with a monochrome editorial interface, one accent color, persistent accounts, and server-calculated ratings and streaks. The original unfinished changes were completed around that MVP; personalized modes and social features remain future work. See [the refactor notes](docs/REFACTOR.md).

- Next.js 15 App Router, React 19, TypeScript, server-rendered pages and server actions.
- Supabase Auth with passwordless email magic links, PostgreSQL and row-level security.
- One global day: midnight UTC inclusive through the next midnight exclusive. Browser dates never determine eligibility or streaks.
- A transactional `submit_daily_vote` RPC locks the matchup and songs, validates membership/time/status, prevents duplicates, updates both ratings/records, records an audit event, updates participation, and saves daily rating snapshots.
- Elo begins at 1500. Admin-configured K-factor (1–100, default 24) lives in `app_settings` and is recorded with each rating event. Rounded rating changes are equal and opposite.
- Song providers are normalized separately. The launch UI opens official HTTPS provider links; it does not load third-party players or download audio.
- Vercel-compatible: no separate application server, Redis or paid analytics service.

Implemented pages: landing, Today, paginated/sortable leaderboard with minimum-vote filtering and provisional labels, song details with rating/history data, profile with streak/vote history, email sign-in, and protected administration.

## Local setup

Use Node.js 20.19+ and install locked dependencies:

```sh
npm ci
```

For preview mode, leave both Supabase variables empty. The ten-song catalog remains browsable, with two official YouTube links; accounts and persistent voting stay disabled. Preview ratings are initial values, not fabricated community statistics.

For a fully local backend, start Docker Desktop with its Linux engine and run:

```sh
npm run local:start
```

This initializes the database, applies migrations in order, and seeds today's matchup. Musicale uses ports **55321** (API), **55322** (PostgreSQL), and **55324** (local email catcher), separate from other projects. Emails sent locally stay in the catcher.

Create `.env.local` from `.env.example` without overwriting existing values. Get the local URL and anon key with `npx supabase status`; set `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Then run:

```sh
npm run dev
```

Visit `http://localhost:3000`. Open `http://127.0.0.1:55324` to follow local sign-in emails. `npm run local:stop` stops only this project's backend and preserves its local database.

To use a hosted Supabase project instead, apply the migrations as described below, fill in its URL/anon key, and configure the Site URL plus the exact `/api/auth/callback` redirect in Supabase Auth. Both configuration values must be set together. The only supported Musicale reset time zone is UTC.

## Database migration and existing data

`0001_initial.sql` is unchanged historical migration content. **Do not replace or reapply an already-applied migration.**

- Fresh database: apply `0001_initial.sql`, `0002_daily_musicale.sql`, then `0003_daily_flow.sql`, followed by `seed.sql`.
- Database running the original app: apply only `0002_daily_musicale.sql` and `0003_daily_flow.sql`, then `seed.sql`.
- With Supabase CLI migration tracking, use normal ordered migration application; do not run a reset against hosted data.

Migration 0002 moves the old songs, votes, profiles, game runs and quota records into the **private, unexposed `musicale_legacy` schema**. Existing account identities, join dates, display names and admin roles are copied into the new profiles. Old votes and ratings are preserved for reference, rather than mixed into the new catalog. The old public ranking RPC is removed. Migration 0003 completes access controls, result privacy, admin audit/import tools, configurable Elo, and history queries.

Before rollout, take a database backup, inspect the starting schema, and apply the upgrade to an isolated copy. If the unfinished July rewrite of `0001_initial.sql` was applied manually, that is a different starting schema: do not apply the legacy upgrade blindly; preserve/export that data and reconcile it first. No hosted migration has been applied by this refactor.

To assign an administrator, use a trusted SQL session to set the selected authenticated user's `profiles.role` to `admin`. Owners cannot change roles, Elo, vote history, streaks or totals through the public API.

## Administration

Admin supports scheduling today's or future editorial matchups, replacing future unvoted matchups, inspecting vote counts, JSON catalog import/edit, availability changes, and K-factor settings. Editorial mutations are recorded in `admin_audit_log`. Importing an existing ID preserves its rating and record; a failed import rolls back the entire batch.

Imports use the shape below (1–100 songs, maximum 200 KB). A song can have one entry per supported provider: `youtube`, `spotify`, `apple_music`, or `musicbrainz`. Links must use HTTPS on that provider's official domain. Only active songs with playback links can be scheduled.

```json
[
  {
    "id": "respect-aretha",
    "title": "Respect",
    "artistName": "Aretha Franklin",
    "albumName": "I Never Loved a Man the Way I Love You",
    "releaseYear": 1967,
    "genre": "Soul",
    "status": "active",
    "providers": [
      {
        "provider": "youtube",
        "providerSongId": "JzqGZjFnYnA",
        "externalUrl": "https://www.youtube.com/watch?v=JzqGZjFnYnA"
      }
    ]
  }
]
```

## Verification

```sh
npm test
npm run test:db
npx playwright install chromium
npm run test:ui
npm run typecheck
```

Start local Supabase before the database/browser checks. `npm run verify` runs the complete sequence (unit tests, database tests, production build, desktop/mobile browser tests, and TypeScript).

- Unit tests cover Elo including rounding ties, streak expiry/date boundaries, UTC windows, catalog/provider validation, and spoiler-free sharing.
- Database tests create and remove a disposable database inside **only** `supabase_db_musicale`. They exercise migration preservation, actual PostgreSQL transactions/RLS, authentication requirements, invalid/time-window votes, concurrent requests/users, streaks, result privacy, admin scheduling/audits/settings, and atomic imports. They do not reset the application's database or accept a hosted URL.
- Browser tests build with isolated local settings, then use actual local magic-link email and persisted voting on desktop/mobile. They cover keyboard voting, reload persistence, clipboard fallback, profiles/history, server admin checks, sign-out, 404s, 320px layouts and automated WCAG accessibility checks. Generated `example.test` accounts and sample votes remain only in the local test project. Screenshots go in ignored `output/`.
- Browser checks never open the external music links. Listening availability and restrictions remain provider-dependent.

`npm run test:ui` builds `.next` against the local test backend. Run `npm run build` again before using that folder with your regular environment. No hosted authentication/email delivery or Vercel deployment is implied by local checks.

## Deploy to Vercel

1. Prepare and apply the database upgrade before directing the new app at the hosted database.
2. Import the repository into Vercel, using the standard Next.js build.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the canonical HTTPS `NEXT_PUBLIC_SITE_URL`. Keep the service-role key out of frontend/application configuration; this app does not require it.
4. Configure Supabase Auth Site URL and the exact production `/api/auth/callback` redirect. Enable email confirmation, configure reliable email delivery, and retain Auth rate limits/cooldowns.
5. Schedule upcoming daily matchups in Admin. When no valid matchup is scheduled, Today shows an explicit empty state; it does not choose a random pair.
6. Verify sign-in, provider link, one vote, persisted result after reload, streak, leaderboard and admin authorization on the deployed environment.

Supabase rate-limits authentication. The voting RPC enforces one successful vote per account/matchup and serializes duplicate requests. Additional edge request throttling and suspicious-activity review tools remain launch hardening work; do not use IP addresses as user identity.

## Music providers and rights

Musicale stores editorial metadata and provider IDs/links. It does not host, proxy, download, cache or redistribute audio. The initial matchup links to [Aretha Franklin's official Respect upload](https://www.youtube.com/watch?v=JzqGZjFnYnA) and [The Beach Boys' official God Only Knows video](https://www.youtube.com/watch?v=NADx3-qRxek), verified October 1, 2026. Artwork uses letter placeholders until permission for supplied artwork is established.

External links are the initial playback approach. Review [YouTube's terms](https://www.youtube.com/t/terms), [developer policies](https://developers.google.com/youtube/terms/developer-policies), [embedding guidance](https://support.google.com/youtube/answer/171780) and [player requirements](https://developers.google.com/youtube/terms/required-minimum-functionality) before adding embeds or API metadata. Official embeds require provider identification, privacy disclosures and other applicable policies; privacy-enhanced mode does not eliminate all data sharing. Other supported providers currently supply external links only, without API metadata requests.

Official upload availability is not a blanket license or assurance of regional playback. Confirm recording authorization, regional availability, artwork permissions, provider attribution/terms, and production privacy disclosures before broad launch. Disable unavailable recordings promptly.

## Follow-up work

- Curate a larger, diverse catalog and verify provider links/artwork permissions.
- Add edge throttling, suspicious-activity views, ranking replay tools and production observability.
- Add genre/decade filters, more profile statistics once sufficient data exists, and an isolated opt-in analytics adapter.
- Extend manual accessibility/device testing and add additional browser engines.
- Later: pairing strategies, personalized comparisons, friends and tournaments.
