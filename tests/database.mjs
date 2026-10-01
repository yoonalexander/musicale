import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

// Uses only a disposable database inside this project's local Supabase container.
// Never accepts a hosted connection string and never resets the application's database.
const container = "supabase_db_musicale",
  database = `musicale_test_${process.pid}`;
let assertions = 0;
function sql(text, db = database) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      db,
    ]);
    let out = "",
      err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(out.trim()) : reject(new Error(err.trim())),
    );
    child.stdin.end(text);
  });
}
const user = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const asUser = (n, text) =>
  `begin;set local role authenticated;set local request.jwt.claim.sub='${user(n)}';${text};commit;`;
async function test(name, fn) {
  await fn();
  assertions++;
  console.log(`PASS ${name}`);
}
async function denied(query, pattern) {
  await assert.rejects(sql(query), pattern);
}
const vote = (n, song = "respect-aretha") =>
  asUser(
    n,
    `select submit_daily_vote((select matchup_id from get_today_matchup()),'${song}')`,
  );
const day = "(now() at time zone 'UTC')::date";
const createDay = (offset) =>
  `insert into daily_matchups(matchup_day,song_a_id,song_b_id,starts_at,ends_at) values(${day}+${offset},'respect-aretha','god-only-knows',(${day}+${offset})::timestamp at time zone 'UTC',(${day}+${offset}+1)::timestamp at time zone 'UTC')`;

try {
  await sql(`create database ${database}`, "postgres");
  await sql(`create schema auth;create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    alter default privileges in schema public grant all on tables to anon,authenticated;
    alter default privileges in schema public grant all on sequences to anon,authenticated;`);
  const files = readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort();
  await sql(readFileSync(`supabase/migrations/${files[0]}`, "utf8"));
  await sql(`insert into auth.users(id,email) values('${user(1)}','legacy@example.test');
    update profiles set role='admin' where user_id='${user(1)}';
    insert into songs(id,title,musical_title,category,artist_label,release_year) values('old-a','Old A','Old show','broadway','Old artist',2000),('old-b','Old B','Old show','broadway','Old artist',2001);
    insert into votes(user_id,left_song_id,right_song_id,winner_song_id,loser_song_id,rating_delta_winner,rating_delta_loser) values('${user(1)}','old-a','old-b','old-a','old-b',12,-12);`);
  for (const file of files.slice(1))
    await sql(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await sql(readFileSync("supabase/seed.sql", "utf8"));
  await test("upgrade archives old votes/songs and preserves account roles", async () => {
    assert.equal(await sql("select count(*) from musicale_legacy.votes"), "1");
    assert.equal(await sql("select count(*) from musicale_legacy.songs"), "2");
    assert.equal(
      await sql(`select role from profiles where user_id='${user(1)}'`),
      "admin",
    );
    await denied(
      asUser(1, "select * from musicale_legacy.votes"),
      /permission denied/,
    );
    assert.equal(
      await sql(
        "select to_regprocedure('public.submit_rank_vote(text,text,text)') is null",
      ),
      "t",
    );
  });
  await sql(
    `insert into auth.users(id,email) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'test'||n||'@example.test' from generate_series(2,20) n`,
  );
  await test("seed is idempotent and uses a complete UTC day", async () => {
    await sql(readFileSync("supabase/seed.sql", "utf8"));
    assert.equal(await sql("select count(*) from songs"), "10");
    assert.equal(
      await sql(
        "select extract(epoch from ends_at-starts_at) from daily_matchups",
      ),
      "86400.000000",
    );
  });
  await test("unauthenticated users cannot vote or see result counts", async () => {
    await denied(
      "set role anon;select submit_daily_vote(null,'respect-aretha')",
      /permission denied/,
    );
    assert.equal(
      await sql(
        "set role anon;select song_a_votes is null and song_b_votes is null and total_votes is null from get_today_matchup()",
      ),
      "t",
    );
    assert.equal(
      await sql("set role anon;select count(*) from daily_matchups"),
      "0",
    );
  });
  await test("invalid, null and out-of-window choices are rejected", async () => {
    await denied(vote(2, "fast-car-tracy-chapman"), /not in this matchup/);
    await denied(
      asUser(
        2,
        "select submit_daily_vote((select matchup_id from get_today_matchup()),null)",
      ),
      /not in this matchup/,
    );
    await sql(createDay(1));
    const future = await sql(
      `select id from daily_matchups where matchup_day=${day}+1`,
    );
    await denied(
      asUser(2, `select submit_daily_vote('${future}','respect-aretha')`),
      /not active/,
    );
    await denied(
      asUser(
        2,
        "select submit_daily_vote('11111111-1111-4111-8111-111111111111','respect-aretha')",
      ),
      /not active/,
    );
    assert.equal(await sql("select count(*) from votes"), "0");
  });
  await test("a real vote atomically records Elo, results, activity, streak and snapshots", async () => {
    await sql(vote(2));
    assert.equal(
      await sql(
        "select elo_rating||','||wins||','||losses||','||matchup_count from songs where id='respect-aretha'",
      ),
      "1512.00,1,0,1",
    );
    assert.equal(
      await sql("select elo_rating from songs where id='god-only-knows'"),
      "1488.00",
    );
    assert.equal(
      await sql(
        `select current_streak||','||longest_streak||','||total_votes from profiles where user_id='${user(2)}'`,
      ),
      "1,1,1",
    );
    assert.equal(await sql("select count(*) from rating_events"), "1");
    assert.equal(await sql("select count(*) from song_rating_snapshots"), "2");
    assert.equal(
      await sql(asUser(2, "select total_votes from get_today_matchup()")),
      "1",
    );
    assert.equal(
      await sql(
        asUser(3, "select total_votes is null from get_today_matchup()"),
      ),
      "t",
    );
    const history = JSON.parse(
      await sql(asUser(2, "select get_my_vote_history()")),
    );
    assert.equal(history[0].title, "Respect");
    assert.equal(history[0].rating_delta, 12);
  });
  await test("duplicate requests cannot alter a preserved vote", async () => {
    await denied(vote(2, "god-only-knows"), /already voted/);
    assert.equal(await sql("select count(*) from votes"), "1");
    assert.equal(
      await sql(
        "select sum(elo_rating) from songs where id in('respect-aretha','god-only-knows')",
      ),
      "3000.00",
    );
  });
  await test("two concurrent requests for one user record exactly one vote", async () => {
    const results = await Promise.allSettled([
      sql(vote(3)),
      sql(vote(3, "god-only-knows")),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    assert.match(
      results.find((r) => r.status === "rejected").reason.message,
      /already voted/,
    );
    assert.equal(
      await sql(`select count(*) from votes where user_id='${user(3)}'`),
      "1",
    );
  });
  await test("concurrent users retain every vote and conserve Elo totals", async () => {
    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        sql(vote(i + 4, i % 2 ? "god-only-knows" : "respect-aretha")),
      ),
    );
    assert.equal(await sql("select count(*) from votes"), "8");
    assert.equal(await sql("select count(*) from rating_events"), "8");
    assert.equal(
      await sql("select sum(song_a_votes+song_b_votes) from daily_matchups"),
      "8",
    );
    assert.equal(
      await sql(
        "select sum(elo_rating) from songs where id in('respect-aretha','god-only-knows')",
      ),
      "3000.00",
    );
    assert.equal(await sql("select count(*) from song_rating_snapshots"), "2");
  });
  await test("consecutive day streak increments; missed day resets; UTC is server controlled", async () => {
    await sql(`update profiles set last_vote_day=${day}-1,current_streak=4,longest_streak=7 where user_id='${user(10)}';
      update profiles set last_vote_day=${day}-2,current_streak=4,longest_streak=7 where user_id='${user(11)}'`);
    await sql(vote(10));
    await sql(vote(11));
    assert.equal(
      await sql(
        `select current_streak||','||longest_streak from profiles where user_id='${user(10)}'`,
      ),
      "5,7",
    );
    assert.equal(
      await sql(
        `select current_streak||','||longest_streak from profiles where user_id='${user(11)}'`,
      ),
      "1,7",
    );
    assert.equal(
      await sql(
        `select activity_day=${day} from user_daily_activity where user_id='${user(10)}'`,
      ),
      "t",
    );
  });
  await test("users cannot edit roles, streaks, songs, matchups or other users votes", async () => {
    await denied(
      asUser(
        2,
        `update profiles set role='admin',current_streak=99 where user_id='${user(2)}'`,
      ),
      /permission denied/,
    );
    await denied(asUser(2, createDay(2)), /row-level security/);
    assert.equal(
      await sql(
        asUser(
          2,
          "update songs set elo_rating=9999 where id='respect-aretha';select elo_rating<9999 from songs where id='respect-aretha'",
        ),
      ),
      "t",
    );
    assert.equal(
      await sql(
        asUser(2, `select count(*) from votes where user_id='${user(3)}'`),
      ),
      "0",
    );
    await denied(
      asUser(2, "select save_catalog('[]')"),
      /Admin access required/,
    );
  });
  await test("admins schedule future matchups, reject duplicate days and audit changes", async () => {
    await sql(asUser(1, createDay(2)));
    await denied(asUser(1, createDay(2)), /duplicate key/);
    await denied(
      asUser(
        1,
        `update daily_matchups set song_a_id='god-only-knows',song_b_id='respect-aretha' where matchup_day=${day}`,
      ),
      /Only future/,
    );
    assert.ok(Number(await sql("select count(*) from admin_audit_log")) >= 1);
  });
  await test("unavailable songs block voting and disappear from the active matchup", async () => {
    await sql(
      asUser(
        1,
        "update songs set status='unavailable' where id='respect-aretha'",
      ),
    );
    assert.equal(await sql("select count(*) from get_today_matchup()"), "0");
    const id = await sql(
      `select id from daily_matchups where matchup_day=${day}`,
    );
    await denied(
      asUser(12, `select submit_daily_vote('${id}','respect-aretha')`),
      /Both songs must be active/,
    );
    await sql(
      asUser(1, "update songs set status='active' where id='respect-aretha'"),
    );
  });
  await test("admin K-factor affects audited future votes", async () => {
    await sql(
      asUser(1, "update app_settings set elo_k_factor=32 where id=true"),
    );
    await sql(vote(12));
    assert.equal(
      await sql(
        "select k_factor from rating_events order by created_at desc limit 1",
      ),
      "32",
    );
  });
  await test("catalog imports update metadata, preserve ratings and roll back partial failures", async () => {
    const input = [
      {
        id: "respect-aretha",
        title: "Respect",
        artistName: "Aretha Franklin",
        albumName: "Single",
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
    const before = await sql(
      "select elo_rating from songs where id='respect-aretha'",
    );
    await sql(asUser(1, `select save_catalog('${JSON.stringify(input)}')`));
    assert.equal(
      await sql("select elo_rating from songs where id='respect-aretha'"),
      before,
    );
    input[0].title = "Should roll back";
    input.push({ ...input[0], id: "another-song" });
    await denied(
      asUser(1, `select save_catalog('${JSON.stringify(input)}')`),
      /duplicate key/,
    );
    assert.equal(
      await sql("select title from songs where id='respect-aretha'"),
      "Respect",
    );
    assert.equal(
      await sql("select count(*) from songs where id='another-song'"),
      "0",
    );
  });
  console.log(`${assertions} database integration tests passed.`);
} finally {
  try {
    execFileSync(
      "docker",
      [
        "exec",
        container,
        "psql",
        "-X",
        "-q",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-c",
        `drop database if exists ${database} with (force)`,
      ],
      { stdio: "pipe" },
    );
  } catch {
    /* Report the original failure. */
  }
}
