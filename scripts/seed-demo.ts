import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";
const { hashSync } = bcryptjs;

const prisma = new PrismaClient({ log: ["warn", "error"] });

// ── Helpers ──────────────────────────────────────────────
const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
const PASSWORD = hashSync("demo1234", 10);

function addr(street: string, postal: string, city: string, first: string, last: string) {
  return {
    street, postalCode: postal, city, country: "FR",
    firstName: first, lastName: last, phone: "06 00 00 00 00",
  };
}

// ══════════════════════════════════════════════════════════
async function main() {
  console.log("\n══ SEED DEMO — TrottiStore ══\n");

  // ── 1. SCHEMAS ──
  for (const s of ["shared", "ecommerce", "crm", "sav"]) {
    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${s}"`);
  }
  console.log("✓ Schemas");

  // ── 2. USERS ──
  const usersData = [
    { email: "admin@demo.fr", firstName: "Sophie", lastName: "Laurent", role: "SUPERADMIN" },
    { email: "manager@demo.fr", firstName: "Marc", lastName: "Dubois", role: "MANAGER" },
    { email: "tech1@demo.fr", firstName: "Pierre", lastName: "Martin", role: "TECHNICIAN" },
    { email: "tech2@demo.fr", firstName: "Léa", lastName: "Bernard", role: "TECHNICIAN" },
    { email: "client1@demo.fr", firstName: "Jean", lastName: "Dupont", role: "CLIENT" },
    { email: "client2@demo.fr", firstName: "Marie", lastName: "Leroy", role: "CLIENT" },
    { email: "client3@demo.fr", firstName: "Thomas", lastName: "Petit", role: "CLIENT" },
  ];

  const users: Record<string, string> = {};
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash: PASSWORD, emailVerified: true },
    });
    users[u.email] = user.id;
  }
  console.log(`✓ ${usersData.length} users`);

  // ── 3. ADDRESSES ──
  const addressesData = [
    { userId: users["client1@demo.fr"], ...addr("42 Rue du Commerce", "75015", "Paris", "Jean", "Dupont"), isDefault: true },
    { userId: users["client2@demo.fr"], ...addr("15 Avenue de la République", "69003", "Lyon", "Marie", "Leroy"), isDefault: true },
    { userId: users["client3@demo.fr"], ...addr("8 Rue des Martyrs", "44000", "Nantes", "Thomas", "Petit"), isDefault: true },
  ];
  for (const a of addressesData) {
    await prisma.address.create({ data: a });
  }
  console.log("✓ 3 addresses");

  // ── 4. CATEGORIES ──
  const catsData = [
    { name: "Trottinettes Électriques", slug: "trottinettes-electriques", position: 0 },
    { name: "Pièces Détachées", slug: "pieces-detachees", position: 1 },
    { name: "Accessoires", slug: "accessoires", position: 2 },
    { name: "Batteries", slug: "batteries", position: 3 },
    { name: "Protections", slug: "protections", position: 4 },
  ];
  const cats: Record<string, string> = {};
  for (const c of catsData) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, isActive: true },
    });
    cats[c.slug] = cat.id;
  }
  console.log("✓ 5 categories");

  // ── 5. BRANDS ──
  const brandsData = [
    { name: "Dualtron", slug: "dualtron" },
    { name: "Teverun", slug: "teverun" },
    { name: "Xiaomi", slug: "xiaomi" },
    { name: "Ninebot", slug: "ninebot" },
  ];
  const brands: Record<string, string> = {};
  for (const b of brandsData) {
    const brand = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: {},
      create: { ...b, isActive: true },
    });
    brands[b.slug] = brand.id;
  }
  console.log("✓ 4 brands");

  // ── 6. PRODUCTS ──
  const IMG = "https://www.trottistore.fr/wp-content/uploads/2025/07/";
  const productsData = [
    // Trottinettes
    { sku: "DT-STORM-LTD", name: "Dualtron Storm LTD 84V", slug: "dualtron-storm-ltd", priceHt: 3999.17, brand: "dualtron", cat: "trottinettes-electriques", img: `${IMG}MMDUALTRONNEWSTORMLTD-TROTTINETTE-ELECTRIQUE-DUALTRON-NEW-STORM-LTD-84V45AH-EY4-300x300.jpg`, stock: 3 },
    { sku: "TV-TETRA-4M", name: "Teverun Tetra 4 Moteurs", slug: "teverun-tetra", priceHt: 4165.83, brand: "teverun", cat: "trottinettes-electriques", img: `${IMG}TEVERUNTETRA-TROTTINETTE-ELECTRIQUE-TEVERUN-TETRA-4-MOTEURS-300x300.jpg`, stock: 2 },
    { sku: "DT-ACHILLEUS", name: "Dualtron Achilleus 60V 35AH", slug: "dualtron-achilleus", priceHt: 2332.50, brand: "dualtron", cat: "trottinettes-electriques", img: `${IMG}MMDUALTRONACHILLEUS2023-TROTTINETTE-ELECTRIQUE-DUALTRON-ACHILLEUS-60V-35AH-2024-300x300.jpg`, stock: 5 },
    { sku: "XM-PRO2", name: "Xiaomi Pro 2 Essential", slug: "xiaomi-pro-2", priceHt: 332.50, brand: "xiaomi", cat: "trottinettes-electriques", img: `${IMG}KUICKWHEELS9-TROTTINETTE-KUICKWHEEL-S9-36V-156-Ah-300x300.jpg`, stock: 12 },
    // Pièces
    { sku: "PD-CTRL-52V", name: "Contrôleur 52V universel", slug: "controleur-52v", priceHt: 65.00, brand: "dualtron", cat: "pieces-detachees", img: `${IMG}MMDUALTRONAMINIA5217-TROTTINETTE-ELECTRIQUE-DUALTRON-AMINIA-SPECIAL-52V-175Ah-IPX5-300x300.jpg`, stock: 18 },
    { sku: "PD-FREIN-DISC", name: "Kit frein à disque hydraulique", slug: "frein-disque-hydraulique", priceHt: 42.50, brand: "teverun", cat: "pieces-detachees", img: `${IMG}TEVERUNSPACE52V18A-TROTTINETTE-ELECTRIQUE-TEVERUN-SPACE-52V-18AH-300x300.png`, stock: 25 },
    { sku: "PD-PNEU-10", name: "Pneu 10 pouces renforcé", slug: "pneu-10-pouces", priceHt: 18.33, brand: "xiaomi", cat: "pieces-detachees", img: `${IMG}MMDUALTRONTOGO48V15A-TROTTINETTE-ELECTRIQUE-DUALTRON-TOGO-PLUS-48V15A-300x300.jpg`, stock: 42 },
    { sku: "PD-CABLE-SET", name: "Set câbles connectiques", slug: "cables-connectiques", priceHt: 8.25, brand: "ninebot", cat: "pieces-detachees", img: `${IMG}MMDUALTRONFOREVER60V18A2025-TROTTINETTE-ELECTRIQUE-DUALTRON-FOREVER-60V-182A-2025-EY4-300x300.jpg`, stock: 0 },
    // Batteries
    { sku: "BAT-52V-18AH", name: "Batterie 52V 18Ah Samsung", slug: "batterie-52v-18ah", priceHt: 415.83, brand: "dualtron", cat: "batteries", img: `${IMG}TEVERUNBLADEMINIULTRA-TROTTINETTE-ELECTRIQUE-TEVERUN-BLADE-MINI-ULTRA-60V-27A-300x300.jpg`, stock: 7 },
    { sku: "BAT-36V-10AH", name: "Batterie 36V 10Ah LG", slug: "batterie-36v-10ah", priceHt: 208.33, brand: "xiaomi", cat: "batteries", img: `${IMG}MMDUALTRONXLTD-TROTTINETTE-ELECTRIQUE-DUALTRON-X-LTD-300x300.jpg`, stock: 4 },
    // Accessoires
    { sku: "ACC-ANTIVOL", name: "Antivol U renforcé", slug: "antivol-u-renforce", priceHt: 33.25, brand: "ninebot", cat: "accessoires", img: `${IMG}TEVERUNSUPREME602024-TROTTINETTE-ELECTRIQUE-TEVERUN-FIGHTER-7260R-EDITION-2024-V3-300x300.jpg`, stock: 30 },
    { sku: "ACC-SACOCHE", name: "Sacoche guidon étanche", slug: "sacoche-guidon", priceHt: 24.17, brand: "xiaomi", cat: "accessoires", img: `${IMG}MMDUALTRONACHILLEUSR2023-TROTTINETTE-ELECTRIQUE-DUALTRON-ACHILLEUS-60V-35AH-ROUGE-2024-300x300.jpg`, stock: 15 },
  ];

  const products: Record<string, { id: string; priceHt: number }> = {};
  for (const p of productsData) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        sku: p.sku, name: p.name, slug: p.slug, priceHt: p.priceHt,
        tvaRate: 20.0, status: p.stock > 0 ? "ACTIVE" : "DRAFT",
        isFeatured: p.priceHt > 2000, brandId: brands[p.brand],
      },
    });
    products[p.sku] = { id: product.id, priceHt: p.priceHt };

    // Image
    await prisma.productImage.create({
      data: { productId: product.id, url: p.img, alt: p.name, position: 0, isPrimary: true },
    }).catch(() => {});

    // Variant
    await prisma.productVariant.upsert({
      where: { sku: `${p.sku}-default` },
      update: {},
      create: {
        productId: product.id, sku: `${p.sku}-default`, name: "Défaut",
        stockQuantity: p.stock, lowStockThreshold: 5, isActive: true,
      },
    });

    // Category
    await prisma.productCategory.create({
      data: { productId: product.id, categoryId: cats[p.cat] },
    }).catch(() => {});
  }
  console.log("✓ 12 products + variants + images");

  // ── 7. ORDERS ──
  const jean = users["client1@demo.fr"];
  const marie = users["client2@demo.fr"];
  const thomas = users["client3@demo.fr"];
  const jeanAddr = JSON.stringify(addr("42 Rue du Commerce", "75015", "Paris", "Jean", "Dupont"));
  const marieAddr = JSON.stringify(addr("15 Avenue de la République", "69003", "Lyon", "Marie", "Leroy"));
  const thomasAddr = JSON.stringify(addr("8 Rue des Martyrs", "44000", "Nantes", "Thomas", "Petit"));

  const ordersData = [
    { customer: jean, status: "DELIVERED", method: "CARD", payStatus: "PAID", addr: jeanAddr, items: [{ sku: "DT-ACHILLEUS", qty: 1 }], created: daysAgo(14), delivered: daysAgo(10) },
    { customer: jean, status: "DELIVERED", method: "CARD", payStatus: "PAID", addr: jeanAddr, items: [{ sku: "PD-CTRL-52V", qty: 1 }, { sku: "PD-PNEU-10", qty: 2 }], created: daysAgo(7), delivered: daysAgo(4) },
    { customer: jean, status: "SHIPPED", method: "CARD", payStatus: "PAID", addr: jeanAddr, items: [{ sku: "ACC-ANTIVOL", qty: 1 }], created: daysAgo(2) },
    { customer: marie, status: "CONFIRMED", method: "INSTALLMENT_3X", payStatus: "PARTIAL", addr: marieAddr, items: [{ sku: "TV-TETRA-4M", qty: 1 }], created: daysAgo(3) },
    { customer: marie, status: "PENDING", method: "BANK_TRANSFER", payStatus: "PENDING", addr: marieAddr, items: [{ sku: "BAT-52V-18AH", qty: 1 }], created: daysAgo(0) },
    { customer: thomas, status: "DELIVERED", method: "CARD", payStatus: "PAID", addr: thomasAddr, items: [{ sku: "DT-STORM-LTD", qty: 1 }], created: daysAgo(30), delivered: daysAgo(26) },
    { customer: thomas, status: "CANCELLED", method: "CARD", payStatus: "REFUNDED", addr: thomasAddr, items: [{ sku: "PD-FREIN-DISC", qty: 1 }], created: daysAgo(14) },
    { customer: thomas, status: "PREPARING", method: "CARD", payStatus: "PAID", addr: thomasAddr, items: [{ sku: "BAT-36V-10AH", qty: 1 }, { sku: "ACC-SACOCHE", qty: 1 }], created: daysAgo(0) },
  ];

  const orderIds: string[] = [];
  for (const o of ordersData) {
    let subtotalHt = 0;
    const itemsToCreate: Array<{ productId: string; quantity: number; unitPriceHt: number; tvaRate: number; totalHt: number }> = [];
    for (const item of o.items) {
      const p = products[item.sku];
      const totalHt = p.priceHt * item.qty;
      subtotalHt += totalHt;
      itemsToCreate.push({ productId: p.id, quantity: item.qty, unitPriceHt: p.priceHt, tvaRate: 20, totalHt });
    }
    const tvaAmount = Math.round(subtotalHt * 0.2 * 100) / 100;
    const totalTtc = Math.round((subtotalHt + tvaAmount) * 100) / 100;

    const order = await prisma.order.create({
      data: {
        customerId: o.customer, status: o.status, paymentMethod: o.method,
        paymentStatus: o.payStatus,
        shippingAddress: JSON.parse(o.addr), billingAddress: JSON.parse(o.addr),
        subtotalHt, tvaAmount, totalTtc, shippingCost: 0,
        createdAt: o.created,
        deliveredAt: o.delivered || null,
        items: { create: itemsToCreate },
      },
    });
    orderIds.push(order.id);
  }
  console.log("✓ 8 orders + items");

  // ── 8. PAYMENTS ──
  for (let i = 0; i < ordersData.length; i++) {
    const o = ordersData[i];
    let subtotal = 0;
    for (const item of o.items) subtotal += products[item.sku].priceHt * item.qty;
    const total = Math.round(subtotal * 1.2 * 100) / 100;
    const isPaid = ["PAID", "REFUNDED"].includes(o.payStatus);

    await prisma.payment.create({
      data: {
        orderId: orderIds[i], provider: "stripe", amount: total,
        method: o.method, status: isPaid ? "CONFIRMED" : o.payStatus === "PARTIAL" ? "CONFIRMED" : "PENDING",
        receivedAt: isPaid ? o.created : null,
      },
    });
  }
  console.log("✓ 8 payments");

  // ── 9. INSTALLMENTS (order 4 — Marie, 3x) ──
  const order4Total = Math.round(products["TV-TETRA-4M"].priceHt * 1.2 * 100) / 100;
  const installAmount = Math.round(order4Total / 3 * 100) / 100;
  for (let i = 1; i <= 3; i++) {
    await prisma.paymentInstallment.create({
      data: {
        orderId: orderIds[3], installmentNumber: i, totalInstallments: 3,
        amountDue: installAmount,
        dueDate: new Date(now.getTime() + (i - 1) * 30 * 86400000),
        status: i === 1 ? "PAID" : "PENDING",
        paidAt: i === 1 ? daysAgo(3) : null,
      },
    });
  }
  console.log("✓ 3 installments (3x payment)");

  // ── 10. CRM PROFILES ──
  const profiles = [
    { userId: jean, loyaltyTier: "GOLD", loyaltyPoints: 450, totalOrders: 3, totalSpent: 2800, healthScore: 92, lastOrderAt: daysAgo(2), rfmRecency: 2, rfmFrequency: 3, rfmMonetary: 2800, scooterModels: ["Dualtron Achilleus"] },
    { userId: marie, loyaltyTier: "BRONZE", loyaltyPoints: 50, totalOrders: 2, totalSpent: 1200, healthScore: 65, lastOrderAt: daysAgo(0), rfmRecency: 0, rfmFrequency: 2, rfmMonetary: 1200, scooterModels: [] },
    { userId: thomas, loyaltyTier: "SILVER", loyaltyPoints: 180, totalOrders: 3, totalSpent: 1600, healthScore: 40, lastOrderAt: daysAgo(0), rfmRecency: 0, rfmFrequency: 3, rfmMonetary: 1600, scooterModels: ["Dualtron Storm LTD"] },
  ];
  const profileIds: Record<string, string> = {};
  for (const p of profiles) {
    const profile = await prisma.customerProfile.upsert({
      where: { userId: p.userId },
      update: {},
      create: { ...p, source: "WEBSITE", tags: [] },
    });
    profileIds[p.userId] = profile.id;
  }
  console.log("✓ 3 customer profiles (GOLD, SILVER, BRONZE)");

  // ── 11. INTERACTIONS ──
  const interactionsData = [
    { customerId: jean, type: "EMAIL", subject: "Bienvenue chez nous !", channel: "SYSTEM", createdAt: daysAgo(30) },
    { customerId: jean, type: "ORDER", subject: "Commande #1 confirmée — Dualtron Achilleus", channel: "WEB", createdAt: daysAgo(14) },
    { customerId: jean, type: "ORDER", subject: "Commande #2 confirmée — Pièces détachées", channel: "WEB", createdAt: daysAgo(7) },
    { customerId: jean, type: "EMAIL", subject: "Enquête de satisfaction", channel: "SYSTEM", createdAt: daysAgo(5) },
    { customerId: jean, type: "NOTE", subject: "Passage au tier GOLD — client fidèle", channel: "MANUAL", createdAt: daysAgo(3) },
    { customerId: marie, type: "EMAIL", subject: "Bienvenue chez nous !", channel: "SYSTEM", createdAt: daysAgo(10) },
    { customerId: marie, type: "ORDER", subject: "Commande #4 confirmée — Teverun Tetra", channel: "WEB", createdAt: daysAgo(3) },
    { customerId: marie, type: "EMAIL", subject: "Rappel : virement en attente", channel: "SYSTEM", createdAt: daysAgo(0) },
    { customerId: thomas, type: "EMAIL", subject: "Bienvenue chez nous !", channel: "SYSTEM", createdAt: daysAgo(35) },
    { customerId: thomas, type: "ORDER", subject: "Commande #6 confirmée — Dualtron Storm LTD", channel: "WEB", createdAt: daysAgo(30) },
    { customerId: thomas, type: "SAV", subject: "Ticket SAV ouvert — Ne démarre plus", channel: "WEB", createdAt: daysAgo(5) },
    { customerId: thomas, type: "CALL", subject: "Appel technicien — diagnostic en cours", channel: "PHONE", agentId: users["tech1@demo.fr"], createdAt: daysAgo(3) },
  ];
  for (const i of interactionsData) {
    await prisma.customerInteraction.create({ data: i });
  }
  console.log("✓ 12 interactions");

  // ── 12. LOYALTY POINTS ──
  const loyaltyData = [
    { profileId: profileIds[jean], points: 100, type: "PURCHASE", description: "Commande #1" },
    { profileId: profileIds[jean], points: 200, type: "PURCHASE", description: "Commande #2" },
    { profileId: profileIds[jean], points: 50, type: "REVIEW", description: "Avis laissé sur Dualtron Achilleus" },
    { profileId: profileIds[jean], points: 100, type: "PURCHASE", description: "Commande #3" },
    { profileId: profileIds[marie], points: 50, type: "PURCHASE", description: "Commande #4" },
    { profileId: profileIds[thomas], points: 80, type: "PURCHASE", description: "Commande #6" },
    { profileId: profileIds[thomas], points: 100, type: "PURCHASE", description: "Commande #8" },
  ];
  for (const l of loyaltyData) {
    await prisma.loyaltyPoint.create({ data: l });
  }
  console.log("✓ 7 loyalty points");

  // ── 13. SEGMENTS ──
  const segmentsData = [
    { name: "VIP Clients", description: "Clients ayant dépensé plus de 2000€", criteria: { totalSpent: { gte: 2000 } }, count: 1 },
    { name: "Nouveaux Clients", description: "Clients avec 1 commande ou moins", criteria: { totalOrders: { lte: 1 } }, count: 0 },
    { name: "Clients à risque", description: "Score de santé inférieur à 50", criteria: { healthScore: { lt: 50 } }, count: 1 },
  ];
  for (const s of segmentsData) {
    await prisma.customerSegment.create({ data: { ...s, criteria: s.criteria as any } });
  }
  console.log("✓ 3 segments");

  // ── 14. EMAIL CAMPAIGNS ──
  await prisma.emailCampaign.create({
    data: {
      name: "Soldes d'été -20%", subject: "Profitez de -20% sur tout le catalogue !",
      status: "SENT", sentAt: daysAgo(3),
      stats: { sent: 156, delivered: 148, opened: 67, clicked: 23, bounced: 8, unsubscribed: 2 },
    },
  });
  await prisma.emailCampaign.create({
    data: {
      name: "Nouveau catalogue Dualtron 2026", subject: "Découvrez les nouveautés Dualtron 2026",
      status: "SCHEDULED", scheduledAt: new Date(now.getTime() + 7 * 86400000),
    },
  });
  console.log("✓ 2 email campaigns");

  // ── 15. TECHNICIANS ──
  await prisma.technician.upsert({
    where: { userId: users["tech1@demo.fr"] },
    update: {},
    create: { userId: users["tech1@demo.fr"], specialities: ["Électrique", "Moteurs", "Contrôleurs"], isAvailable: true, maxConcurrent: 5 },
  });
  await prisma.technician.upsert({
    where: { userId: users["tech2@demo.fr"] },
    update: {},
    create: { userId: users["tech2@demo.fr"], specialities: ["Batteries", "Freinage", "Pneus"], isAvailable: true, maxConcurrent: 4 },
  });
  console.log("✓ 2 technicians");

  // ── 16. REPAIR TICKETS ──
  const ticket1 = await prisma.repairTicket.create({
    data: {
      customerId: thomas, productModel: "Dualtron Storm LTD 84V", type: "REPARATION",
      status: "EN_REPARATION", priority: "HIGH",
      issueDescription: "Ne démarre plus après charge complète. Le display s'allume brièvement puis s'éteint.",
      diagnosis: "Contrôleur HS — court-circuit détecté sur la carte mère du contrôleur 84V.",
      estimatedCost: 120, estimatedDays: 3, assignedTo: users["tech1@demo.fr"],
      createdAt: daysAgo(5),
    },
  });
  const ticket2 = await prisma.repairTicket.create({
    data: {
      customerId: jean, productModel: "Dualtron Achilleus 60V", type: "GARANTIE",
      status: "DEVIS_ENVOYE", priority: "NORMAL",
      issueDescription: "Autonomie réduite de 50% — batterie neuve il y a 6 mois.",
      diagnosis: "2 cellules défectueuses sur le pack 60V. Remplacement pack recommandé.",
      estimatedCost: 280, estimatedDays: 5, assignedTo: users["tech2@demo.fr"],
      createdAt: daysAgo(3),
    },
  });
  await prisma.repairTicket.create({
    data: {
      customerId: marie, productModel: "Teverun Tetra", type: "REPARATION",
      status: "NOUVEAU", priority: "LOW",
      issueDescription: "Bruit au freinage avant — grincement à basse vitesse.",
      createdAt: daysAgo(1),
    },
  });
  console.log("✓ 3 repair tickets");

  // ── 17. REPAIR STATUS LOG ──
  const statusLog = [
    { ticketId: ticket1.id, fromStatus: "NOUVEAU", toStatus: "DIAGNOSTIQUE", createdAt: daysAgo(4) },
    { ticketId: ticket1.id, fromStatus: "DIAGNOSTIQUE", toStatus: "DEVIS_ENVOYE", createdAt: daysAgo(4) },
    { ticketId: ticket1.id, fromStatus: "DEVIS_ENVOYE", toStatus: "DEVIS_ACCEPTE", createdAt: daysAgo(2) },
    { ticketId: ticket1.id, fromStatus: "DEVIS_ACCEPTE", toStatus: "EN_REPARATION", createdAt: daysAgo(0) },
  ];
  for (const s of statusLog) {
    await prisma.repairStatusLog.create({ data: { ...s, performedBy: users["tech1@demo.fr"] } });
  }
  console.log("✓ 4 status log entries");

  // ── 18. REPAIR PARTS USED ──
  await prisma.repairPartUsed.create({
    data: { ticketId: ticket1.id, partName: "Contrôleur 52V", partRef: "PD-CTRL-52V", quantity: 1, unitCost: 65 },
  });
  await prisma.repairPartUsed.create({
    data: { ticketId: ticket1.id, partName: "Câble connectique", partRef: "PD-CABLE-SET", quantity: 2, unitCost: 8 },
  });
  console.log("✓ 2 repair parts");

  // ══════════════════════════════════════════════════════════
  console.log("\n══════════════════════════════════════════");
  console.log("  SEED DEMO TERMINÉ !");
  console.log("══════════════════════════════════════════");
  console.log(`  Users:          7`);
  console.log(`  Categories:     5`);
  console.log(`  Brands:         4`);
  console.log(`  Products:       12`);
  console.log(`  Orders:         8`);
  console.log(`  Payments:       8 (+ 3 installments)`);
  console.log(`  CRM Profiles:   3`);
  console.log(`  Interactions:   12`);
  console.log(`  Loyalty Points: 7`);
  console.log(`  Segments:       3`);
  console.log(`  Campaigns:      2`);
  console.log(`  SAV Tickets:    3`);
  console.log(`  Technicians:    2`);
  console.log("══════════════════════════════════════════\n");
  console.log("  SCÉNARIOS DÉMO\n");
  console.log("  1. PARCOURS CLIENT VIP");
  console.log("     → client1@demo.fr / demo1234");
  console.log("     → 3 commandes, tier GOLD, 450 points\n");
  console.log("  2. PAIEMENT 3X");
  console.log("     → client2@demo.fr / demo1234");
  console.log("     → Commande avec facilité 3x en cours\n");
  console.log("  3. SAV & RÉPARATION");
  console.log("     → client3@demo.fr / demo1234");
  console.log("     → Ticket en réparation, historique statuts\n");
  console.log("  4. DASHBOARD ADMIN");
  console.log("     → admin@demo.fr / demo1234");
  console.log("     → KPIs, commandes, stock, SAV\n");
  console.log("  5. CATALOGUE");
  console.log("     → 12 produits, 5 catégories, 4 marques");
  console.log("     → Filtres, tri, ruptures de stock\n");
  console.log("  6. CRM & FIDÉLITÉ");
  console.log("     → 3 profils, segments auto, campagnes email\n");
  console.log("  ┌──────────────────────┬──────────────┐");
  console.log("  │ admin@demo.fr        │ SUPERADMIN   │");
  console.log("  │ manager@demo.fr      │ MANAGER      │");
  console.log("  │ tech1@demo.fr        │ TECHNICIAN   │");
  console.log("  │ tech2@demo.fr        │ TECHNICIAN   │");
  console.log("  │ client1@demo.fr      │ CLIENT (VIP) │");
  console.log("  │ client2@demo.fr      │ CLIENT       │");
  console.log("  │ client3@demo.fr      │ CLIENT (SAV) │");
  console.log("  └──────────────────────┴──────────────┘");
  console.log("  Mot de passe: demo1234\n");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
