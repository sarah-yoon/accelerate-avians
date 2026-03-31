import { test, expect } from "@playwright/test";

test.describe("Solo Race Flow", () => {
  test("landing page loads with play button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Accelerate Avians")).toBeVisible();
    await expect(page.getByText("Play Solo")).toBeVisible();
  });

  test("navigating to /play shows start race button", async ({ page }) => {
    await page.goto("/play");
    await expect(page.getByText("Start Race")).toBeVisible();
  });

  test("leaderboard page loads", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.getByText("Leaderboard")).toBeVisible();
  });

  test("mobile interstitial shows on small viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/play");
    await expect(
      page.getByText("is a desktop typing game.")
    ).toBeVisible();
  });
});
