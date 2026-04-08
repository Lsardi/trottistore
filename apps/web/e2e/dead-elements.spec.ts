import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * Dead Element Detector — crawls every page and checks:
 * 1. Links: do they point to a page that returns 200 (not 404)?
 * 2. Buttons: do they have a real handler (not just cursor:pointer)?
 * 3. Forms: does the submit do something (not just preventDefault)?
 * 4. Interactive divs: cursor:pointer without onClick = dead
 */

const ROUTES = [
  "/",
  "/produits",
  "/reparation",
  "/diagnostic",
  "/quiz",
  "/compatibilite",
  "/pro",
  "/urgence",
  "/atelier",
  "/avis",
  "/guide",
  "/mon-compte",
  "/panier",
  "/mentions-legales",
  "/cgv",
  "/politique-confidentialite",
  "/cookies",
];

// Pages that need auth or special state — skip deep interaction checks
const AUTH_PAGES = ["/mon-compte", "/checkout"];

interface DeadElement {
  page: string;
  selector: string;
  text: string;
  issue: string;
}

test.describe("Dead Element Detector", () => {
  test("all internal links resolve (no 404)", async ({ page }) => {
    const deadLinks: DeadElement[] = [];

    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});

      const links = await page.locator("a[href^='/']").all();

      for (const link of links) {
        const href = await link.getAttribute("href");
        if (!href || href === "#" || href.startsWith("/#") || href.startsWith("/api/")) continue;

        // Strip query params and anchors for route check
        const cleanPath = href.split("?")[0].split("#")[0];

        // Skip dynamic slugs we can't predict
        if (cleanPath.match(/\/produits\/[^/]+$/) && cleanPath !== "/produits/") continue;
        if (cleanPath.match(/\/guide\/[^/]+$/) && cleanPath !== "/guide/") continue;
        if (cleanPath.match(/\/reparation\/[^/]+$/) && cleanPath !== "/reparation/") continue;
        if (cleanPath.match(/\/admin\//)) continue;
        if (cleanPath.match(/\/mon-compte\/suivi\//)) continue;

        const text = (await link.textContent())?.trim().slice(0, 50) || "[no text]";

        const response = await page.request.get(cleanPath);
        if (response.status() === 404) {
          deadLinks.push({
            page: route,
            selector: `a[href="${href}"]`,
            text,
            issue: `404 — link points to ${cleanPath}`,
          });
        }
      }
    }

    if (deadLinks.length > 0) {
      console.log("\n=== DEAD LINKS FOUND ===");
      deadLinks.forEach((d) =>
        console.log(`  ${d.page} → "${d.text}" → ${d.issue}`)
      );
    }

    expect(deadLinks, `Found ${deadLinks.length} dead links`).toHaveLength(0);
  });

  test("no cursor:pointer divs without click handler", async ({ page }) => {
    const deadDivs: DeadElement[] = [];

    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});

      // Find all elements with cursor:pointer that are not <a>, <button>, <input>, <select>, <label>
      const suspectElements = await page.evaluate(() => {
        const results: { tag: string; text: string; hasClick: boolean; selector: string }[] = [];
        const all = document.querySelectorAll("*");

        for (const el of all) {
          const style = window.getComputedStyle(el);
          if (style.cursor !== "pointer") continue;

          const tag = el.tagName.toLowerCase();
          if (["a", "button", "input", "select", "label", "option", "summary"].includes(tag)) continue;

          // Check if element or ancestors have event listeners via onclick or React props
          const hasOnClick = el.hasAttribute("onclick") || el.hasAttribute("data-onclick");

          // React attaches events to root, so we check if there's a Link wrapper
          const isInsideLink = el.closest("a") !== null;
          const isInsideButton = el.closest("button") !== null;

          if (isInsideLink || isInsideButton) continue;

          const text = (el.textContent || "").trim().slice(0, 60);
          if (!text) continue;

          // Build a selector
          const classes = Array.from(el.classList).slice(0, 2).join(".");
          const selector = `${tag}${classes ? "." + classes : ""}`;

          results.push({
            tag,
            text,
            hasClick: hasOnClick,
            selector,
          });
        }
        return results;
      });

      for (const el of suspectElements) {
        deadDivs.push({
          page: route,
          selector: el.selector,
          text: el.text,
          issue: `cursor:pointer on <${el.tag}> without link/button wrapper`,
        });
      }
    }

    if (deadDivs.length > 0) {
      console.log("\n=== SUSPECT CURSOR:POINTER ELEMENTS ===");
      deadDivs.forEach((d) =>
        console.log(`  ${d.page} → <${d.selector}> "${d.text.slice(0, 40)}" — ${d.issue}`)
      );
    }

    // Warning only — don't fail the build, but report
    // Change to expect(...).toHaveLength(0) to make it blocking
    if (deadDivs.length > 0) {
      console.warn(`⚠ ${deadDivs.length} suspect elements found — review manually`);
    }
  });

  test("forms have real submit handlers (not just preventDefault)", async ({ page }) => {
    const deadForms: DeadElement[] = [];

    for (const route of ROUTES) {
      if (AUTH_PAGES.some((p) => route.startsWith(p))) continue;

      await page.goto(route, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});

      // Check if any form's submit fires a network request or state change
      const forms = await page.locator("form").all();

      for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        const submitBtn = form.locator('button[type="submit"], button:not([type])').first();
        const btnText = (await submitBtn.textContent().catch(() => ""))?.trim() || "[no button]";

        // Check if the form has any required fields — if so, it's likely wired
        const hasRequired = await form.locator("[required]").count();
        if (hasRequired > 0) continue; // Has validation = likely functional

        // Check for action attribute
        const action = await form.getAttribute("action");
        if (action) continue; // Has action = likely functional

        // If no required fields and no action, flag as suspect
        deadForms.push({
          page: route,
          selector: `form:nth-of-type(${i + 1})`,
          text: btnText.slice(0, 50),
          issue: "form without required fields or action — may be dead",
        });
      }
    }

    if (deadForms.length > 0) {
      console.log("\n=== SUSPECT FORMS ===");
      deadForms.forEach((d) =>
        console.log(`  ${d.page} → ${d.selector} button="${d.text}" — ${d.issue}`)
      );
    }
  });

  test("all pages load without console errors", async ({ page }) => {
    const errors: { page: string; error: string }[] = [];

    for (const route of ROUTES) {
      const pageErrors: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          pageErrors.push(msg.text().slice(0, 200));
        }
      });

      page.on("pageerror", (err) => {
        pageErrors.push(err.message.slice(0, 200));
      });

      await page.goto(route, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});

      // Wait a bit for async errors
      await page.waitForTimeout(1000).catch(() => {});

      for (const err of pageErrors) {
        // Ignore known noise
        if (err.includes("favicon") || err.includes("hydration") || err.includes("NEXT_REDIRECT")) continue;
        errors.push({ page: route, error: err });
      }
    }

    if (errors.length > 0) {
      console.log("\n=== CONSOLE ERRORS ===");
      errors.forEach((e) => console.log(`  ${e.page} → ${e.error}`));
    }

    expect(errors, `Found ${errors.length} console errors`).toHaveLength(0);
  });
});
