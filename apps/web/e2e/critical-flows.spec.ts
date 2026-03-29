import { test, expect } from "@playwright/test";

test.describe("Critical Flows", () => {
  test("checkout happy path submits an order", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("accessToken", "fake-token");
      window.localStorage.setItem("trottistore-session-id", "e2e-session");
    });

    await page.route("http://localhost:3001/api/v1/cart", async (route) => {
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

    await page.route("http://localhost:3001/api/v1/auth/me", async (route) => {
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
              addresses: [
                {
                  id: "10000000-0000-0000-0000-000000000001",
                  type: "SHIPPING",
                  label: "Maison",
                  firstName: "Test",
                  lastName: "User",
                  street: "1 rue du Test",
                  city: "Paris",
                  postalCode: "75001",
                  country: "FR",
                  isDefault: true,
                },
              ],
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

    await page.route("http://localhost:3001/api/v1/orders", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "order-1",
              orderNumber: 1001,
              status: "PENDING",
              paymentMethod: "CARD",
              paymentStatus: "PENDING",
              subtotalHt: "100",
              tvaAmount: "20",
              totalTtc: "120",
              items: [],
              createdAt: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: /checkout/i })).toBeVisible();
    await page.getByRole("button", { name: /passer la commande/i }).click();
    await expect(page.getByText(/commande valid/i)).toBeVisible();
  });

  test("account dashboard renders for authenticated user", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("accessToken", "fake-token");
      window.localStorage.setItem("trottistore-session-id", "e2e-session");
    });

    await page.route("http://localhost:3001/api/v1/auth/me", async (route) => {
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
                loyaltyTier: "SILVER",
                loyaltyPoints: 850,
                totalOrders: 4,
                totalSpent: "499.90",
              },
            },
          },
        }),
      });
    });

    await page.route("http://localhost:3001/api/v1/orders?page=1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "order-1",
              orderNumber: 1001,
              status: "SHIPPED",
              paymentMethod: "CARD",
              paymentStatus: "PAID",
              subtotalHt: "100",
              tvaAmount: "20",
              totalTtc: "120",
              items: [],
              createdAt: new Date().toISOString(),
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        }),
      });
    });

    await page.route("http://localhost:3004/api/v1/repairs**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "ticket-1",
              ticketNumber: 501,
              productModel: "Scooter Pro",
              status: "EN_REPARATION",
              type: "REPARATION",
              priority: "NORMAL",
              issueDescription: "Bruit moteur",
              createdAt: new Date().toISOString(),
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        }),
      });
    });

    await page.goto("/mon-compte");
    await expect(page.getByText(/espace client/i)).toBeVisible();
    await expect(page.getByText(/scooter pro/i)).toBeVisible();
    await expect(page.getByText(/silver/i)).toBeVisible();
  });
});
