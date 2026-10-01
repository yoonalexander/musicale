# Daily Musicale rebuild

The unfinished changes originated in a July 12, 2026 request to replace the old musical-theatre ranking game with a Wordle-inspired, shared daily song vote. The request explicitly permitted substantial reuse/refactoring/removal and prioritized a complete daily loop over future modes.

## Repository assessment

- **Reuse:** Next.js/React/TypeScript and Vercel structure, Supabase SSR clients and passwordless authentication, pure Elo calculations.
- **Refactor:** catalog, domain types, data fetching, voting/streak logic, database/RLS, administrative tools, navigation, styling, tests, setup documentation.
- **Remove:** random ranking and higher/lower game routes, game-run leaderboard, 50-vote quota, theatre-only assumptions, old media/game helpers and branding. Historical database records remain privately archived for preservation, with no old public product APIs retained.

## Completed MVP

1. Access an account through an email magic link.
2. View one shared active UTC matchup and open official provider playback links.
3. Record one server-validated vote and transactional Elo changes.
4. Reveal community results after voting, show streak and share a spoiler-free result.
5. Return and see the saved selection; browse leaderboard, song rating history and profile vote history.
6. Administer song metadata/import/status, editable future matchups, Elo settings and editorial audit records.

The ten-song seed is a starter catalog; the initial two-song matchup has verified official playback links. Artwork permission, a larger catalog, extra analytics/social tools and production rollout remain distinct follow-up work.

## Verification boundary

Actual PostgreSQL migration/RLS/concurrency tests and desktop/mobile browser tests use an isolated local Supabase instance. Email links are delivered to a local catcher, not external recipients. TypeScript and production builds are verified locally. Automated accessibility checks supplement manual screenshot inspection; they do not establish accessibility for every browser or assistive technology.

The refactor preserves the original migration and adds ordered upgrade migrations. Hosted migrations and deployed behavior must be checked during rollout; commit/push alone does not establish deployment success.
