import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
// @ts-expect-error Node-only local test helper.
import { localSettings } from "../local-env.mjs";

localSettings(); // Refuse tests against a hosted project.
const runSql = (text: string) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_musicale",
      "psql",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: text, encoding: "utf8" },
  ).trim();

test("daily vote: magic link, keyboard vote, result, sharing and persistence", async ({
  page,
  request,
}, testInfo) => {
  const email = `musicale-${Date.now()}-${testInfo.project.name}@example.test`;
  await page.goto("/today");
  await expect(
    page.getByRole("heading", { name: "Which song stays with you?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Vote for Respect" }),
  ).toBeDisabled();
  await expect(page.locator(".result")).toHaveCount(0);
  const provider = page
    .getByRole("link", { name: "Listen on YouTube" })
    .first();
  await expect(provider).toHaveAttribute(
    "href",
    "https://www.youtube.com/watch?v=JzqGZjFnYnA",
  );
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
  await expect(
    page.getByText("Magic link sent. Check your inbox."),
  ).toBeVisible();
  let messageId = "";
  await expect
    .poll(async () => {
      const response = await request.get(
        "http://127.0.0.1:55324/api/v1/messages",
      );
      const inbox = await response.json();
      const message = inbox.messages.find(
        (m: { To: { Address: string }[]; ID: string }) =>
          m.To.some((t) => t.Address === email),
      );
      messageId = message?.ID ?? "";
      return Boolean(messageId);
    })
    .toBe(true);
  const message = await (
    await request.get(`http://127.0.0.1:55324/api/v1/message/${messageId}`)
  ).json();
  const href = String(message.HTML).match(
    /href="([^"]*\/auth\/v1\/verify[^"]*)"/,
  )?.[1];
  expect(href, "Local sign-in email contains a verification link").toBeTruthy();
  await page.goto(href!.replaceAll("&amp;", "&"));
  await expect(page).toHaveURL(/\/today$/);
  const vote = page.getByRole("button", { name: "Vote for Respect" });
  await expect(vote).toBeEnabled();
  await vote.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Vote recorded", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Your current streak:", { exact: false }),
  ).toContainText("1 day");
  await expect(
    page.getByRole("button", { name: "Vote for Respect" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Vote for God Only Knows" }),
  ).toBeDisabled();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `output/${testInfo.project.name}-result.png`,
    fullPage: true,
  });
  // Force the clipboard failure path so fallback remains usable on mobile/insecure browsers.
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("Unavailable")) },
    }),
  );
  await page.getByRole("button", { name: "Copy spoiler-free result" }).click();
  const share = page.getByLabel("Share result");
  await expect(share).toBeVisible();
  const text = await share.inputValue();
  expect(text).toContain("Musicale #");
  expect(text).toContain("1-day streak");
  expect(text).not.toContain("Respect");
  expect(text).not.toContain("God Only Knows");
  await page.reload();
  await expect(page.getByText("Vote recorded", { exact: true })).toBeVisible();
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Recent votes" }),
  ).toBeVisible();
  await expect(page.locator(".vote-history")).toContainText("Respect");
  await page.goto("/songs/respect-aretha");
  await expect(
    page.getByRole("img", { name: /Elo rating history/ }),
  ).toBeVisible();
  await page.goto("/leaderboard");
  await expect(
    page.getByRole("heading", { name: "The leaderboard" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `output/${testInfo.project.name}-leaderboard.png`,
    fullPage: true,
  });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  // Promote only this generated local test account; test server guards and editing paths.
  runSql(
    `update profiles set role='admin' where user_id=(select id from auth.users where email='${email}')`,
  );
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Make tomorrow’s choice." }),
  ).toBeVisible();
  await page.getByLabel("K-factor (future votes)").fill("24");
  await page.getByRole("button", { name: "Save K-factor" }).click();
  await expect(
    page.getByText("K-factor saved for future votes."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.goto("/today");
  await expect(page.locator(".result")).toHaveCount(0);
});

test("public pages stay usable at narrow widths and missing songs return 404", async ({
  page,
  request,
}, testInfo) => {
  for (const path of [
    "/",
    "/today",
    "/leaderboard",
    "/login",
    "/songs/respect-aretha",
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      path,
    ).toBe(true);
    await expect(page.locator("h1")).toHaveCount(1);
  }
  await page.goto("/today");
  await page.screenshot({
    path: `output/${testInfo.project.name}-today.png`,
    fullPage: true,
  });
  const missing = await request.get("/songs/not-a-song");
  expect(missing.status()).toBe(404);
});

test("public pages pass automated accessibility checks at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of [
    "/",
    "/today",
    "/leaderboard",
    "/login",
    "/songs/respect-aretha",
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      path,
    ).toBe(true);
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(report.violations, path).toEqual([]);
  }
});
