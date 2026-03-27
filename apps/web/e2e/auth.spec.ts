import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/mon-compte");
  });

  test("login form renders with email and password fields", async ({ page }) => {
    // Login tab should be active by default
    const emailInput = page.getByPlaceholder(/email/i);
    const passwordInput = page.getByPlaceholder(/mot de passe/i);

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Submit button should be present
    const submitButton = page.getByRole("button", { name: /connecter/i });
    await expect(submitButton).toBeVisible();
  });

  test("register form renders when switching to inscription tab", async ({ page }) => {
    // Click the register/inscription tab
    const registerTab = page.getByRole("button", { name: /inscription/i });
    await registerTab.click();

    // Register form should show first name, last name, email, phone, and password fields
    await expect(page.getByPlaceholder(/jean/i)).toBeVisible();
    await expect(page.getByPlaceholder(/dupont/i)).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/06/i)).toBeVisible();
    await expect(page.getByPlaceholder(/minimum/i)).toBeVisible();

    // Submit button for registration
    const createButton = page.getByRole("button", { name: /compte/i });
    await expect(createButton).toBeVisible();
  });

  test("can switch between login and register tabs", async ({ page }) => {
    // Start on login — verify login button is visible
    await expect(page.getByRole("button", { name: /connecter/i })).toBeVisible();

    // Switch to register
    await page.getByRole("button", { name: /inscription/i }).click();
    await expect(page.getByRole("button", { name: /compte/i })).toBeVisible();

    // Switch back to login
    await page.getByRole("button", { name: /connexion/i }).click();
    await expect(page.getByRole("button", { name: /connecter/i })).toBeVisible();
  });
});
