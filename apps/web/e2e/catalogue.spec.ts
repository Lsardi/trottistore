import { test, expect } from "@playwright/test";

test.describe("Catalogue", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/produits");
  });

  test("catalogue page loads with heading", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/catalogue/i);
  });

  test("search input is present", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/rechercher/i);
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeEditable();
  });

  test("category filter select is present", async ({ page }) => {
    // The category filter is a <select> with "Toutes catégories" as default
    const categorySelect = page.locator("select").filter({
      has: page.locator("option", { hasText: /toutes/i }),
    });
    await expect(categorySelect).toBeVisible();
  });

  test("sort select is present", async ({ page }) => {
    // The sort select has options like "Plus récents", "Prix croissant", etc.
    const sortSelect = page.locator("select").filter({
      has: page.locator("option", { hasText: /prix/i }),
    });
    await expect(sortSelect).toBeVisible();
  });
});
