import { expect, test } from "@playwright/test";

test.describe("Purchase Flow", () => {
  test("inscription -> catalogue -> panier -> checkout inline -> confirmation", async ({ page }) => {
    const accessToken = "purchase-flow-token";
    const user = {
      id: "00000000-0000-0000-0000-000000000111",
      email: "purchase.flow@test.fr",
      firstName: "Lyes",
      lastName: "Sardi",
      role: "CLIENT",
      addresses: [] as any[],
      customerProfile: {
        loyaltyTier: "BRONZE",
        loyaltyPoints: 0,
        totalOrders: 0,
        totalSpent: "0",
      },
    };

    const product = {
      id: "prod-100",
      sku: "TS-100",
      name: "Trottinette Test",
      slug: "trottinette-test",
      description: "Produit de test",
      shortDescription: "Court",
      priceHt: "500.00",
      tvaRate: "20.00",
      status: "ACTIVE",
      isFeatured: false,
      images: [],
      variants: [
        {
          id: "var-100",
          sku: "TS-100-BLK",
          name: "Noir",
          stockQuantity: 5,
          attributes: { color: "black" },
        },
      ],
      categories: [],
      brand: { id: "brand-1", name: "TrottiStore", slug: "trottistore" },
    };

    let authenticated = false;
    let cartItems: any[] = [];
    let addresses: any[] = [];

    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const { pathname } = url;
      const method = request.method();

      if (pathname === "/api/v1/auth/register" && method === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { user },
          }),
        });
        return;
      }

      if (pathname === "/api/v1/auth/login" && method === "POST") {
        authenticated = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              accessToken,
              user,
            },
          }),
        });
        return;
      }

      if (pathname === "/api/v1/auth/me" && method === "GET") {
        if (!authenticated) {
          await route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              user: {
                ...user,
                addresses,
              },
            },
          }),
        });
        return;
      }

      if (pathname === "/api/v1/products" && method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [product],
            pagination: {
              page: 1,
              limit: 24,
              total: 1,
              totalPages: 1,
              hasNext: false,
              hasPrev: false,
            },
          }),
        });
        return;
      }

      if (pathname === `/api/v1/products/${product.slug}` && method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: product,
          }),
        });
        return;
      }

      if (pathname === "/api/v1/cart" && method === "GET") {
        const totalHt = cartItems.reduce((sum, item) => sum + item.lineTotalHt, 0);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              items: cartItems,
              itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
              totalHt,
              updatedAt: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      if (pathname === "/api/v1/cart/items" && method === "POST") {
        const body = request.postDataJSON() as { quantity: number };
        cartItems = [
          {
            productId: product.id,
            variantId: product.variants[0].id,
            quantity: body.quantity,
            unitPriceHt: 500,
            lineTotalHt: 500 * body.quantity,
            product: {
              name: product.name,
              slug: product.slug,
              sku: product.sku,
              image: null,
            },
            variant: {
              name: product.variants[0].name,
              sku: product.variants[0].sku,
              attributes: product.variants[0].attributes,
            },
          },
        ];

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              items: cartItems,
              itemCount: body.quantity,
              totalHt: 500 * body.quantity,
              updatedAt: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      if (pathname === "/api/v1/addresses" && method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: addresses }),
        });
        return;
      }

      if (pathname === "/api/v1/addresses" && method === "POST") {
        const body = request.postDataJSON() as any;
        const created = {
          id: `addr-${addresses.length + 1}`,
          ...body,
          country: body.country || "FR",
          isDefault: body.isDefault ?? false,
        };

        if (created.isDefault) {
          addresses = addresses.map((address) => ({ ...address, isDefault: false }));
        }

        addresses = [created, ...addresses];

        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: created }),
        });
        return;
      }

      if (pathname.startsWith("/api/v1/addresses/") && method === "DELETE") {
        const id = pathname.split("/").pop();
        addresses = addresses.filter((address) => address.id !== id);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: { id } }),
        });
        return;
      }

      if (pathname === "/api/v1/orders" && method === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "order-9001",
              orderNumber: 9001,
              status: "PENDING",
              paymentMethod: "CARD",
              paymentStatus: "PENDING",
              subtotalHt: "500",
              tvaAmount: "100",
              totalTtc: "600",
              items: cartItems,
              createdAt: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      if (pathname === "/api/v1/orders" && method === "GET") {
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
        return;
      }

      if (pathname.startsWith("/api/v1/repairs") && method === "GET") {
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
        return;
      }

      await route.fallback();
    });

    await page.goto("/mon-compte");

    await page.getByRole("button", { name: "INSCRIPTION" }).click();
    await page.getByPlaceholder("Jean").fill("Lyes");
    await page.getByPlaceholder("Dupont").fill("Sardi");
    await page.getByPlaceholder("votre@email.fr").fill("purchase.flow@test.fr");
    await page.getByPlaceholder("06 12 34 56 78").fill("0612345678");
    await page.getByPlaceholder("Minimum 8 caracteres").fill("demo12345");
    await page.getByRole("button", { name: "CREER MON COMPTE" }).click();

    await expect(page.getByText(/espace client/i)).toBeVisible();

    await page.goto("/produits");
    await expect(page.getByRole("heading", { name: /catalogue/i })).toBeVisible();
    await expect(page.getByText("Trottinette Test")).toBeVisible();

    await page.getByRole("link", { name: "Trottinette Test" }).first().click();
    await expect(page.getByRole("heading", { name: /trottinette test/i })).toBeVisible();

    await page.getByRole("button", { name: /ajouter au panier/i }).click();

    await page.goto("/panier");
    await expect(page.getByRole("heading", { name: /panier/i })).toBeVisible();
    await expect(page.getByText("Trottinette Test")).toBeVisible();

    await page.getByRole("link", { name: /commander/i }).click();

    await expect(page.getByRole("heading", { name: /checkout/i })).toBeVisible();
    await page.getByText("Prénom").locator("..").getByRole("textbox").fill("Lyes");
    await page.getByText("Nom").locator("..").getByRole("textbox").fill("Sardi");
    await page.getByText("Adresse").locator("..").getByRole("textbox").fill("10 Rue de Paris");
    await page.getByText("Code postal").locator("..").getByRole("textbox").fill("75001");
    await page.getByText("Ville").locator("..").getByRole("textbox").fill("Paris");
    await page.getByText("Téléphone").locator("..").getByRole("textbox").fill("0612345678");

    await page.getByRole("button", { name: /passer la commande/i }).click();

    await expect(page).toHaveURL(/\/checkout\/confirmation/);
    await expect(page.getByText(/commande validée/i)).toBeVisible();
    await expect(page.getByText(/#9001/)).toBeVisible();
  });
});
