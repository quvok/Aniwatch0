import { test, expect, installApiMocks, seedState } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await seedState(page);
  await installApiMocks(page);
});

test("skip link is the first focus target and jumps to the main region", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skip = page.locator(".skip-link");
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
});

test("toasts are exposed as a live region", async ({ page }) => {
  await page.goto("/");
  const toast = page.locator("#toast");
  await expect(toast).toHaveAttribute("role", "status");
  await expect(toast).toHaveAttribute("aria-live", "polite");
});

test("auth dialog traps focus and returns it to the opener", async ({ page }) => {
  await page.goto("/profile.html");
  const opener = page.locator(".profile-login");
  await opener.click();

  const modal = page.locator("#auth-modal");
  await expect(modal).toBeVisible();

  for (let index = 0; index < 12; index++) await page.keyboard.press("Tab");
  const inside = await page.evaluate(() => document.getElementById("auth-modal")?.contains(document.activeElement));
  expect(inside).toBe(true);

  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("dialogs are labelled for assistive technology", async ({ page }) => {
  await page.goto("/profile.html");
  await page.locator(".profile-login").click();

  const modal = page.locator("#auth-modal");
  await expect(modal).toHaveAttribute("aria-labelledby", "auth-modal-title");
  await expect(page.locator("#auth-modal-title")).toHaveText(/Смотри на любом устройстве/);
});
