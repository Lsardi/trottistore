import { test, expect, type Page } from "@playwright/test";
import path from "path";

const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

const VIEWPORTS = [
  { name: "iphone14", width: 390, height: 844, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1" },
  { name: "galaxy-s21", width: 360, height: 800, ua: "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36" },
] as const;

const STATIC_PAGES = [
  { path: "/", label: "homepage" },
  { path: "/produits", label: "catalogue" },
  { path: "/panier", label: "panier" },
  { path: "/checkout", label: "checkout" },
  { path: "/mon-compte", label: "mon-compte" },
  { path: "/reparation", label: "reparation" },
  { path: "/diagnostic", label: "diagnostic" },
  { path: "/quiz", label: "quiz" },
  { path: "/atelier", label: "atelier" },
  { path: "/mentions-legales", label: "mentions-legales" },
];

/** Dismiss cookie banners by setting consent in localStorage before navigation. */
async function dismissCookieBanner(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("cookie-consent", "accepted");
    window.localStorage.setItem("cookieConsent", "accepted");
    window.localStorage.setItem("trottistore-cookie-consent", "accepted");
  });
}

/** Fetch the slug of the first product from the catalogue page. */
async function getFirstProductSlug(page: Page, baseURL: string): Promise<string | null> {
  await page.goto("/produits", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Try to find a product link
  const link = page.locator('a[href*="/produits/"]').first();
  try {
    await link.waitFor({ state: "visible", timeout: 10000 });
    const href = await link.getAttribute("href");
    if (href) {
      const match = href.match(/\/produits\/([^/?#]+)/);
      if (match) return match[1];
    }
  } catch {
    // No product links found
  }
  return null;
}

/**
 * Check for horizontal overflow. Returns overflow in pixels and top offenders.
 */
async function checkOverflow(page: Page) {
  return page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const clientWidth = document.documentElement.clientWidth;
    const overflow = docWidth - clientWidth;

    const offenders = [...document.querySelectorAll("*")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 80),
          overflowRight: Math.round(r.right - clientWidth),
          width: Math.round(r.width),
          text: (el.textContent || "").trim().slice(0, 50),
        };
      })
      .filter((x) => x.width > 0 && x.overflowRight > 0)
      .sort((a, b) => b.overflowRight - a.overflowRight)
      .slice(0, 5);

    return { docWidth, clientWidth, overflow, offenders };
  });
}

/**
 * Check for buttons/links that are too small for touch (< 44x44px).
 */
async function checkTouchTargets(page: Page) {
  return page.evaluate(() => {
    const MIN_SIZE = 44;
    const interactives = document.querySelectorAll(
      'a, button, [role="button"], input, select, textarea, [tabindex]'
    );
    const tooSmall: Array<{
      tag: string;
      cls: string;
      text: string;
      width: number;
      height: number;
    }> = [];

    for (const el of interactives) {
      const r = el.getBoundingClientRect();
      // Skip invisible elements
      if (r.width === 0 || r.height === 0) continue;
      // Skip elements off-screen
      if (r.top > window.innerHeight * 3) continue;
      if (r.width < MIN_SIZE || r.height < MIN_SIZE) {
        tooSmall.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 60),
          text: (el.textContent || "").trim().slice(0, 40),
          width: Math.round(r.width),
          height: Math.round(r.height),
        });
      }
    }

    return tooSmall.slice(0, 10);
  });
}

/**
 * Check if main heading (h1) is visible and not clipped.
 */
async function checkMainHeading(page: Page) {
  return page.evaluate(() => {
    const h1 = document.querySelector("h1");
    if (!h1) return { found: false, visible: false, text: "", clipped: false };

    const r = h1.getBoundingClientRect();
    const style = getComputedStyle(h1);
    const visible = r.width > 0 && r.height > 0;
    const clipped =
      style.overflow === "hidden" && (h1.scrollWidth > r.width || h1.scrollHeight > r.height);

    return {
      found: true,
      visible,
      text: h1.textContent?.trim().slice(0, 80) || "",
      clipped,
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  });
}

test.describe("Mobile Audit — Production Screenshots", () => {
  // Increase timeout for production tests
  test.setTimeout(60000);

  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        userAgent: viewport.ua,
        isMobile: true,
        hasTouch: true,
      });

      // First, discover a product slug, then test all pages including product detail
      let productSlug: string | null = null;

      test.beforeAll(async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          userAgent: viewport.ua,
          isMobile: true,
          hasTouch: true,
        });
        const page = await context.newPage();
        await dismissCookieBanner(page);

        const baseURL = process.env.BASE_URL || "http://localhost:3000";
        productSlug = await getFirstProductSlug(page, baseURL);
        await context.close();
      });

      for (const pageInfo of STATIC_PAGES) {
        test(`${pageInfo.label} — no overflow, heading visible`, async ({ page }) => {
          await dismissCookieBanner(page);

          await page.goto(pageInfo.path, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });

          // Wait for content to settle
          await page.waitForTimeout(3000);

          // Take full-page screenshot
          const screenshotName = `${viewport.name}--${pageInfo.label}.png`;
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, screenshotName),
            fullPage: true,
          });

          // Check horizontal overflow
          const overflowData = await checkOverflow(page);
          if (overflowData.overflow > 2) {
            console.log(
              `[OVERFLOW] ${viewport.name} ${pageInfo.label}: ${overflowData.overflow}px overflow`
            );
            console.log("  Offenders:", JSON.stringify(overflowData.offenders, null, 2));
          }
          expect(
            overflowData.overflow,
            `Horizontal overflow of ${overflowData.overflow}px on ${pageInfo.label} (${viewport.name}). Offenders: ${JSON.stringify(overflowData.offenders)}`
          ).toBeLessThanOrEqual(2);

          // Check main heading
          const heading = await checkMainHeading(page);
          if (heading.found) {
            expect(
              heading.visible,
              `H1 "${heading.text}" is not visible on ${pageInfo.label}`
            ).toBe(true);
            if (heading.clipped) {
              console.log(
                `[CLIPPED] ${viewport.name} ${pageInfo.label}: H1 text is clipped: "${heading.text}"`
              );
            }
          }

          // Check touch targets (log warnings, don't fail)
          const tinyTargets = await checkTouchTargets(page);
          if (tinyTargets.length > 0) {
            console.log(
              `[TOUCH] ${viewport.name} ${pageInfo.label}: ${tinyTargets.length} touch targets < 44px`
            );
            for (const t of tinyTargets.slice(0, 5)) {
              console.log(
                `  <${t.tag}> "${t.text}" ${t.width}x${t.height}px .${t.cls.split(" ")[0]}`
              );
            }
          }
        });
      }

      test("product detail — no overflow, heading visible", async ({ page }) => {
        test.skip(!productSlug, "No product slug discovered from catalogue");

        await dismissCookieBanner(page);

        await page.goto(`/produits/${productSlug}`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });

        await page.waitForTimeout(3000);

        const screenshotName = `${viewport.name}--product-detail.png`;
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, screenshotName),
          fullPage: true,
        });

        // Check horizontal overflow
        const overflowData = await checkOverflow(page);
        if (overflowData.overflow > 2) {
          console.log(
            `[OVERFLOW] ${viewport.name} product-detail: ${overflowData.overflow}px overflow`
          );
          console.log("  Offenders:", JSON.stringify(overflowData.offenders, null, 2));
        }
        expect(
          overflowData.overflow,
          `Horizontal overflow of ${overflowData.overflow}px on product-detail (${viewport.name}). Offenders: ${JSON.stringify(overflowData.offenders)}`
        ).toBeLessThanOrEqual(2);

        // Check main heading
        const heading = await checkMainHeading(page);
        if (heading.found) {
          expect(
            heading.visible,
            `H1 "${heading.text}" is not visible on product-detail`
          ).toBe(true);
        }

        // Check touch targets
        const tinyTargets = await checkTouchTargets(page);
        if (tinyTargets.length > 0) {
          console.log(
            `[TOUCH] ${viewport.name} product-detail: ${tinyTargets.length} touch targets < 44px`
          );
          for (const t of tinyTargets.slice(0, 5)) {
            console.log(
              `  <${t.tag}> "${t.text}" ${t.width}x${t.height}px .${t.cls.split(" ")[0]}`
            );
          }
        }
      });
    });
  }
});
