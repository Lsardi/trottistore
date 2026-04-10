/**
 * seed-orders.ts — DEMO DATA ONLY
 *
 * Adds ~30 fake historical orders against products already seeded by
 * scripts/seed.ts so that the analytics dashboards (KPI, sales, customer
 * cockpit) have something to display during the demo.
 *
 * Strict rules (cf. Codex review of plan A, 2026-04-11):
 *  - ADDITIVE only — never deletes anything, never touches catalog
 *  - REUSES products already in DB (refuses to run if catalog is empty)
 *  - REUSES the CLIENT user already in DB (refuses to run if missing)
 *  - DOES NOT touch business logic — no transaction guards, no stock
 *    decrement, no $executeRaw beyond schema check. Stock stays untouched
 *    so the demo catalog quantities are not eroded by fake orders.
 *  - Idempotent guard: refuses to run twice if `orders` already has
 *    >= 10 rows (assume it's been seeded already)
 *  - Marker: every seeded order has `notes: "DEMO_SEED_DATA"` and every
 *    seeded payment has `providerRef: "demo-seed-payment-<i>"` so they
 *    can be distinguished from real orders and removed later via:
 *      DELETE FROM ecommerce.orders WHERE notes = 'DEMO_SEED_DATA';
 *
 * Run:
 *   DATABASE_URL='postgresql://...' pnpm --filter @trottistore/scripts \
 *     exec tsx seed-orders.ts
 *
 * Or via the package.json script: `pnpm --filter @trottistore/scripts seed:orders`
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

const ORDER_COUNT = 30;
const STATUSES = [
  "DELIVERED",
  "DELIVERED",
  "DELIVERED",
  "SHIPPED",
  "SHIPPED",
  "PREPARING",
  "CONFIRMED",
  "PENDING",
  "CANCELLED",
] as const;

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]!;
}

async function main() {
  console.log("\n══ SEED ORDERS — demo data only ══\n");

  // ── 1. PRECONDITIONS ──
  const productCount = await prisma.product.count();
  if (productCount === 0) {
    throw new Error(
      "No products in DB. Run `pnpm --filter @trottistore/scripts seed` first.",
    );
  }
  console.log(`✓ ${productCount} products found in catalog`);

  const client = await prisma.user.findFirst({
    where: { role: "CLIENT" },
    select: { id: true, email: true },
  });
  if (!client) {
    throw new Error(
      "No CLIENT user in DB. Run `pnpm --filter @trottistore/scripts seed` first.",
    );
  }
  console.log(`✓ client user: ${client.email}`);

  const existingOrders = await prisma.order.count();
  if (existingOrders >= 10) {
    console.log(
      `⚠ ${existingOrders} orders already exist — refusing to re-seed (idempotent guard).`,
    );
    return;
  }

  // ── 2. PICK PRODUCTS ──
  // Take a slice of products with valid HT prices > 0. Use the first 50 by
  // creation order — deterministic, no randomness, no stock interaction.
  const products = await prisma.product.findMany({
    where: { priceHt: { gt: 0 } },
    select: { id: true, name: true, priceHt: true },
    take: 50,
    orderBy: { createdAt: "asc" },
  });
  if (products.length < 5) {
    throw new Error(
      `Only ${products.length} products with priceHt > 0 found, need >= 5.`,
    );
  }
  console.log(`✓ ${products.length} candidate products`);

  // ── 3. FAKE ADDRESS (JSON, not the Address table — keeps it additive) ──
  const fakeAddress = {
    street: "1 rue de la Démo",
    postalCode: "75001",
    city: "Paris",
    country: "FR",
    firstName: "Jean",
    lastName: "Dupont",
    phone: "06 00 00 00 00",
  };

  // ── 4. CREATE ORDERS ──
  const now = new Date();
  let created = 0;
  for (let i = 0; i < ORDER_COUNT; i++) {
    // Spread orders over the last 30 days, deterministic per index.
    const daysOld = 29 - i;
    const createdAt = new Date(now.getTime() - daysOld * 86400000);
    const status = pick(STATUSES, i);
    const isCancelled = status === "CANCELLED";
    const paymentStatus = isCancelled ? "REFUNDED" : "PAID";

    // 1-3 line items, deterministic by index.
    const lineCount = (i % 3) + 1;
    const items: Array<{
      productId: string;
      quantity: number;
      unitPriceHt: number;
      tvaRate: number;
      totalHt: number;
    }> = [];
    let subtotalHt = 0;
    for (let l = 0; l < lineCount; l++) {
      const p = products[(i * 3 + l * 7) % products.length]!;
      const quantity = (l === 0 ? 1 : (i + l) % 2) + 1;
      const unitPriceHt = Number(p.priceHt);
      const totalHt = Math.round(unitPriceHt * quantity * 100) / 100;
      subtotalHt += totalHt;
      items.push({
        productId: p.id,
        quantity,
        unitPriceHt,
        tvaRate: 20,
        totalHt,
      });
    }
    const tvaAmount = Math.round(subtotalHt * 0.2 * 100) / 100;
    const totalTtc = Math.round((subtotalHt + tvaAmount) * 100) / 100;

    const order = await prisma.order.create({
      data: {
        customerId: client.id,
        status,
        paymentMethod: "CARD",
        paymentStatus,
        shippingAddress: fakeAddress,
        billingAddress: fakeAddress,
        subtotalHt,
        tvaAmount,
        totalTtc,
        shippingCost: 0,
        notes: "DEMO_SEED_DATA",
        createdAt,
        deliveredAt: status === "DELIVERED" ? new Date(createdAt.getTime() + 3 * 86400000) : null,
        items: { create: items },
      },
    });

    if (!isCancelled) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: "stripe",
          providerRef: `demo-seed-payment-${i}`,
          amount: totalTtc,
          method: "CARD",
          status: "CONFIRMED",
          receivedAt: createdAt,
        },
      });
    }
    created += 1;
  }

  console.log(`✓ ${created} orders + items + payments inserted`);
  console.log("\n══ SEED ORDERS done ══\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
