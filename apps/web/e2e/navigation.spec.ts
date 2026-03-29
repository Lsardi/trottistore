import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("homepage loads successfully", async ({ page }) => {
    await page.goto("/");
    // The page should have a main heading or visible content
    await expect(page.locator("h1").first()).toBeVisible();
    // Header and footer should be present
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });

  test("navigates to /produits (catalogue)", async ({ page }) => {
    await page.goto("/produits");
    // The catalogue page should display its heading
    await expect(page.locator("h1")).toContainText(/catalogue/i);
  });

  test("navigates to /diagnostic", async ({ page }) => {
    await page.goto("/diagnostic");
    await expect(page.locator("h1")).toContainText(/diagnostic/i);
  });

  test("navigates to /reparation", async ({ page }) => {
    await page.goto("/reparation");
    await expect(page.locator("h1")).toContainText(/reparation|réparation|sav/i);
  });

  test("displays 404 page for unknown routes", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    // The not-found page shows "404" and a link back to home
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByRole("link", { name: /accueil/i })).toBeVisible();
  });
});
