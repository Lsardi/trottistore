import { test, expect } from "@playwright/test";

const KEY_PAGES = ["/", "/produits", "/panier", "/checkout", "/mon-compte"];

test.describe("Responsive smoke @responsive", () => {
  for (const path of KEY_PAGES) {
    test(`renders without horizontal overflow: ${path}`, async ({ page }) => {
      if (path === "/checkout" || path === "/mon-compte") {
        await page.addInitScript(() => {
          window.localStorage.setItem("accessToken", "responsive-fake-token");
          window.localStorage.setItem("trottistore-session-id", "responsive-session");
        });

        await page.route("**/api/v1/auth/me", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: {
                user: {
                  id: "00000000-0000-0000-0000-000000000001",
                  email: "user@example.com",
                  firstName: "Test",
                  lastName: "User",
                  role: "CLIENT",
                  addresses: [],
                  customerProfile: {
                    loyaltyTier: "BRONZE",
                    loyaltyPoints: 0,
                    totalOrders: 0,
                    totalSpent: "0",
                  },
                },
              },
            }),
          });
        });
      }

      if (path === "/panier" || path === "/checkout") {
        await page.route("**/api/v1/cart", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: {
                items: [
                  {
                    productId: "prod-1",
                    quantity: 1,
                    unitPriceHt: 100,
                    lineTotalHt: 100,
                    product: {
                      name: "Scooter Pro",
                      slug: "scooter-pro",
                      sku: "SP-001",
                      image: null,
                    },
                    variant: null,
                  },
                ],
                itemCount: 1,
                totalHt: 100,
                updatedAt: new Date().toISOString(),
              },
            }),
          });
        });
      }

      if (path === "/mon-compte") {
        await page.route("**/api/v1/orders**", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: [],
              pagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0,
                hasNext: false,
                hasPrev: false,
              },
            }),
          });
        });

        await page.route("**/api/v1/repairs**", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: [],
              pagination: {
                page: 1,
                limit: 10,
                total: 0,
                totalPages: 0,
                hasNext: false,
                hasPrev: false,
              },
            }),
          });
        });
      }

      await page.goto(path);
      await expect(page.locator("body")).toBeVisible();

      const viewportWidth = page.viewportSize()?.width ?? 0;
      const diagnostics = await page.evaluate(() => {
        const body = document.body.scrollWidth;
        const html = document.documentElement.scrollWidth;
        const vw = Math.max(window.innerWidth, document.documentElement.clientWidth);
        const offenders = [...document.querySelectorAll("*")]
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              tag: el.tagName.toLowerCase(),
              cls: (el.className || "").toString().slice(0, 60),
              over: Math.round(r.right - vw),
              right: Math.round(r.right),
              width: Math.round(r.width),
              text: (el.textContent || "").trim().slice(0, 40),
            };
          })
          .filter((x) => x.width > 0 && x.over > 0)
          .sort((a, b) => b.over - a.over)
          .slice(0, 8);
        return { contentWidth: Math.max(body, html), vw, offenders };
      });
      const overflowPixels = diagnostics.contentWidth - viewportWidth;

      // Allow a tiny tolerance for iOS/WebKit viewport rounding.
      expect(
        overflowPixels,
        `overflow=${overflowPixels}, viewport=${viewportWidth}, pageVw=${diagnostics.vw}, offenders=${JSON.stringify(diagnostics.offenders)}`
      ).toBeLessThanOrEqual(2);
    });
  }
});
