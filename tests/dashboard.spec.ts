import { test, expect } from "@playwright/test";
test("preview dashboard filters, history, alerts, and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("You’re exploring a preview.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View GitHub details", exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search services" }).fill("supabase");
  await expect(
    page.getByRole("button", { name: "View Supabase details", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View GitHub details", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search services" }).fill("");
  await page
    .getByRole("combobox", { name: "Filter status" })
    .selectOption("degraded");
  await expect(
    page.getByRole("button", { name: "View Anthropic details", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Filter status" })
    .selectOption("all");
  await page
    .getByRole("button", { name: "View GitHub details", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText(
      "Illustrative preview. These are not live provider measurements.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View official source" }),
  ).toHaveAttribute("href", "https://www.githubstatus.com/api/v2/summary.json");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Manage alerts" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Alerts need a connected Supabase project",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close alerts" }).click();
  await page.screenshot({
    path: "docs/screenshots/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "View GitHub details", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/dashboard-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("public APIs are bounded and unconfigured cron fails safely", async ({
  request,
}) => {
  expect((await request.get("/api/health")).status()).toBe(200);
  expect((await request.get("/api/history?monitor=not-real")).status()).toBe(
    400,
  );
  const dashboard = await request.get("/api/dashboard");
  expect(dashboard.status()).toBe(200);
  const data = await dashboard.json();
  expect(data.mode).toBe("preview");
  expect(data.services).toHaveLength(23);
  expect(JSON.stringify(data)).not.toContain("destination");
  expect((await request.post("/api/probe")).status()).toBe(503);
});
