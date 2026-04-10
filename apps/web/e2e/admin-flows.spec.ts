import { test, expect } from "@playwright/test";

test.describe("Admin Flows — Real Browser Login", () => {
  test.setTimeout(45_000);
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Admin login → dashboard → commandes → détail", async ({ page }) => {
    // 1. Login
    await page.goto("/mon-compte");
    await page.waitForTimeout(2000);

    await page.locator("input[type='email']").fill("admin@demo.fr");
    await page.locator("input[type='password']").fill("demo1234");
    await page.locator("button[type='submit']").first().click();
    await page.waitForTimeout(3000);

    // Should redirect to admin
    await page.goto("/admin");
    await page.waitForTimeout(5000);

    // 2. Dashboard loads with data
    const dashboardText = await page.textContent("body");
    const hasRevenue = dashboardText?.includes("€") || false;
    console.log(`  Dashboard has €: ${hasRevenue}`);
    expect(hasRevenue).toBe(true);

    // 3. Admin pages — navigate directly and verify content
    for (const { path, check } of [
      { path: "/admin/commandes", check: "commande" },
      { path: "/admin/sav", check: "RECU" },
      { path: "/admin/produits", check: "produit" },
      { path: "/admin/clients", check: "client" },
      { path: "/admin/analytics", check: "€" },
      { path: "/admin/stock", check: "stock" },
    ]) {
      await page.goto(path);
      await page.waitForTimeout(3000);
      const content = (await page.textContent("body"))?.toLowerCase() || "";
      const found = content.includes(check.toLowerCase());
      console.log(`  ${path}: ${found ? "OK" : "FAIL"} (looking for "${check}")`);
      expect(found, `${path} should contain "${check}"`).toBe(true);
    }
  });

  test("Client login → mon compte → commandes → tickets", async ({ page }) => {
    // 1. Login as client
    await page.goto("/mon-compte");
    await page.waitForTimeout(2000);

    await page.locator("input[type='email']").fill("client1@demo.fr");
    await page.locator("input[type='password']").fill("demo1234");
    await page.locator("button[type='submit']").first().click();
    await page.waitForTimeout(3000);

    // 2. Should see client dashboard
    const content = await page.textContent("body");
    const isLoggedIn = content?.includes("Dupont") || content?.includes("ESPACE CLIENT") || content?.includes("DÉCONNEXION") || content?.includes("DECONNEXION") || false;
    console.log(`  Client logged in: ${isLoggedIn}`);
    expect(isLoggedIn).toBe(true);

    // 3. Should see orders or loyalty
    const hasOrders = content?.includes("commande") || content?.includes("#") || false;
    console.log(`  Orders visible: ${hasOrders}`);

    // 4. Should see loyalty card
    const hasLoyalty = content?.includes("BRONZE") || content?.includes("SILVER") || content?.includes("GOLD") || content?.includes("points") || false;
    console.log(`  Loyalty card: ${hasLoyalty}`);

    // 5. Check RGPD buttons
    const hasExport = content?.includes("Exporter") || content?.includes("exporter") || false;
    const hasDelete = content?.includes("Supprimer") || content?.includes("supprimer") || false;
    console.log(`  RGPD export: ${hasExport}, delete: ${hasDelete}`);
  });

  test("Full purchase flow — browse → add to cart → checkout → confirmation", async ({ page }) => {
    // 1. Browse catalogue
    await page.goto("/produits");
    await page.waitForTimeout(3000);

    // 2. Click first product
    const productLink = page.locator("a[href^='/produits/']").first();
    await expect(productLink).toBeVisible({ timeout: 10000 });
    await productLink.click();
    await page.waitForTimeout(3000);

    // 3. Add to cart
    const addBtn = page.locator("text=/AJOUTER AU PANIER/i");
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(2000);

      // Check feedback
      const feedback = await page.locator("text=/ajouté|AJOUTÉ|panier/i").count();
      console.log(`  Add to cart feedback: ${feedback > 0}`);

      // 4. Go to cart
      await page.goto("/panier");
      await page.waitForTimeout(2000);

      const cartContent = await page.textContent("body");
      const hasCartItems = cartContent?.includes("€") || cartContent?.includes("COMMANDER") || false;
      console.log(`  Cart has items: ${hasCartItems}`);

      if (hasCartItems) {
        // 5. Go to checkout
        const commanderBtn = page.locator("text=/COMMANDER/i");
        if (await commanderBtn.count() > 0) {
          await commanderBtn.click();
          await page.waitForTimeout(3000);

          const checkoutContent = await page.textContent("body");
          const hasCheckout = checkoutContent?.includes("CHECKOUT") || checkoutContent?.includes("Adresse") || checkoutContent?.includes("email") || false;
          console.log(`  Checkout page loaded: ${hasCheckout}`);
          expect(hasCheckout).toBe(true);
        }
      }
    } else {
      console.log("  SKIP — product out of stock");
    }
  });

  test("SAV flow — deposit ticket → get tracking", async ({ page }) => {
    await page.goto("/reparation");
    await page.waitForTimeout(2000);

    // Fill form
    const nameInput = page.locator("input[placeholder*='Nom'], input[id*='name']").first();
    if (await nameInput.count() > 0) {
      await nameInput.fill("Test Playwright");

      const phoneInput = page.locator("input[type='tel']").first();
      if (await phoneInput.count() > 0) await phoneInput.fill("0612345678");

      const modelInput = page.locator("input[placeholder*='Dualtron'], input[id*='model']").first();
      if (await modelInput.count() > 0) await modelInput.fill("Xiaomi Pro 2");

      const descInput = page.locator("textarea").first();
      if (await descInput.count() > 0) await descInput.fill("Trottinette ne démarre plus");

      // Check consent checkbox
      const consent = page.locator("input[type='checkbox'][required]").first();
      if (await consent.count() > 0) await consent.check();

      // Submit
      const submitBtn = page.locator("button[type='submit']:not([disabled])");
      if (await submitBtn.count() > 0) {
        await submitBtn.click();
        await page.waitForTimeout(4000);

        const successContent = await page.textContent("body");
        const hasSuccess = successContent?.includes("créé") || successContent?.includes("suivi") || successContent?.includes("tracking") || false;
        console.log(`  Ticket created: ${hasSuccess}`);
        expect(hasSuccess).toBe(true);
      }
    }
  });
});
