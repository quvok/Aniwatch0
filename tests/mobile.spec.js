import { test, expect, installApiMocks, seedState } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await seedState(page);
  await installApiMocks(page);
});

test("mobile layout keeps primary navigation and the hero inside the viewport", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#mobile-bottom-nav")).toBeVisible();
  await expect(page.locator(".hero-editorial h1")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("mobile catalog remains usable", async ({ page }) => {
  await page.goto("/catalog.html");

  await expect(page.locator("#cs")).toBeVisible();
  await expect(page.locator("#cr .card")).toHaveCount(1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
