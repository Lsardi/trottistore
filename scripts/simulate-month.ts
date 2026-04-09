#!/usr/bin/env tsx
/**
 * Simulate one month of realistic e-commerce activity.
 * Creates orders, clients, SAV tickets, CRM interactions spread over 30 days.
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID, createHash } from "crypto";

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60), 0, 0);
  return d;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const FIRST_NAMES = ["Jean", "Marie", "Pierre", "Sophie", "Karim", "Fatima", "Lucas", "Emma", "Mohamed", "Chloé", "Thomas", "Léa", "Antoine", "Camille", "Hugo", "Manon", "Julien", "Sarah", "Nicolas", "Julie"];
const LAST_NAMES = ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier", "Morel"];
const CITIES = [
  { city: "Paris", cp: "75001" }, { city: "Lyon", cp: "69001" }, { city: "Marseille", cp: "13001" },
  { city: "L'Île-Saint-Denis", cp: "93450" }, { city: "Saint-Denis", cp: "93200" },
  { city: "Aubervilliers", cp: "93300" }, { city: "Nanterre", cp: "92000" }, { city: "Montreuil", cp: "93100" },
];
const STREETS = ["12 Rue de la Paix", "45 Avenue de la République", "8 Boulevard Voltaire", "23 Rue du Commerce", "67 Avenue Gambetta", "3 Rue de Rivoli", "156 Boulevard Haussmann", "28 Rue de Belleville"];
const PAYMENT_METHODS = ["CARD", "CARD", "CARD", "APPLE_PAY", "BANK_TRANSFER", "INSTALLMENT_3X"];
const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "DELIVERED", "DELIVERED"];
const REPAIR_MODELS = ["Xiaomi Pro 2", "Dualtron Thunder 2", "Ninebot Max G30", "Kaabo Mantis", "Vsett 10+", "Segway P100S", "Teverun Tetra"];
const REPAIR_ISSUES = [
  "La trottinette ne démarre plus depuis hier",
  "Crevaison du pneu avant",
  "Le frein arrière ne freine plus",
  "L'écran affiche un code erreur E15",
  "Bruit anormal au niveau du moteur",
  "La batterie ne tient plus la charge",
  "Le guidon a du jeu",
  "Les feux avant ne fonctionnent plus",
  "Perte de puissance en montée",
  "La trottinette s'éteint à 50% de batterie",
];
const REPAIR_TYPES = ["REPARATION", "REPARATION", "REPARATION", "GARANTIE", "RETOUR"];
const REPAIR_STATUSES = ["RECU", "DIAGNOSTIC", "DEVIS_ENVOYE", "DEVIS_ACCEPTE", "EN_REPARATION", "PRET", "RECUPERE"];

async function main() {
  console.log("\n═══ SIMULATION 1 MOIS ═══\n");

  // Get existing products for orders
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    include: { variants: { where: { isActive: true }, take: 1 } },
    take: 50,
    orderBy: { priceHt: "desc" },
  });

  if (products.length === 0) {
    console.error("No products in DB. Run seed first.");
    process.exit(1);
  }

  // Get technicians
  const technicians = await prisma.technician.findMany();

  let clientsCreated = 0;
  let ordersCreated = 0;
  let ticketsCreated = 0;
  let interactionsCreated = 0;

  // Simulate 30 days
  for (let day = 30; day >= 0; day--) {
    const date = daysAgo(day);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const ordersToday = isWeekend ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 4) + 1;
    const ticketsToday = Math.random() > 0.6 ? 1 : 0;

    for (let i = 0; i < ordersToday; i++) {
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 100)}@email.fr`;
      const loc = pick(CITIES);

      // Create client
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: `sim_${randomUUID()}`,
          firstName,
          lastName,
          phone: `06${Math.floor(10000000 + Math.random() * 89999999)}`,
          role: "CLIENT",
          createdAt: date,
        },
      });

      // Create address
      const address = await prisma.address.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          street: pick(STREETS),
          postalCode: loc.cp,
          city: loc.city,
          country: "FR",
          type: "SHIPPING",
          isDefault: true,
        },
      });

      // Create CRM profile
      const totalSpent = Math.floor(Math.random() * 3000);
      await prisma.customerProfile.create({
        data: {
          userId: user.id,
          loyaltyTier: totalSpent > 2000 ? "GOLD" : totalSpent > 500 ? "SILVER" : "BRONZE",
          loyaltyPoints: Math.floor(totalSpent / 10),
          totalOrders: Math.floor(Math.random() * 5) + 1,
          totalSpent,
          source: pick(["WEBSITE", "STORE", "GOOGLE"]),
          createdAt: date,
        },
      });

      // Pick 1-3 products for the order
      const numItems = Math.floor(Math.random() * 3) + 1;
      const orderProducts = [];
      for (let j = 0; j < numItems; j++) {
        const prod = pick(products);
        const variant = prod.variants[0];
        if (!variant) continue;
        orderProducts.push({ product: prod, variant });
      }

      if (orderProducts.length === 0) continue;

      const subtotalHt = orderProducts.reduce((sum, { product }) => sum + Number(product.priceHt), 0);
      const tvaAmount = subtotalHt * 0.2;
      const shippingCost = subtotalHt > 100 ? 0 : 6.9;
      const totalTtc = subtotalHt + tvaAmount + shippingCost;
      const paymentMethod = pick(PAYMENT_METHODS);
      const status = pick(ORDER_STATUSES);

      const shippingAddr = { firstName, lastName, street: pick(STREETS), postalCode: loc.cp, city: loc.city, country: "FR" };

      // Create order
      const order = await prisma.order.create({
        data: {
          customerId: user.id,
          status,
          paymentMethod,
          paymentStatus: status === "DELIVERED" || status === "SHIPPED" ? "COMPLETED" : "PENDING",
          shippingMethod: "DELIVERY",
          shippingAddress: shippingAddr,
          billingAddress: shippingAddr,
          subtotalHt,
          tvaAmount,
          shippingCost,
          totalTtc,
          createdAt: date,
          items: {
            create: orderProducts.map(({ product, variant }) => ({
              productId: product.id,
              variantId: variant.id,
              quantity: 1,
              unitPriceHt: product.priceHt,
              tvaRate: product.tvaRate,
              totalHt: product.priceHt,
            })),
          },
          statusHistory: {
            create: { fromStatus: "NEW", toStatus: status, note: "Simulation", changedBy: user.id, changedAt: date },
          },
        },
      });

      // Create payment
      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: paymentMethod === "BANK_TRANSFER" ? "internal" : "stripe",
          amount: totalTtc,
          method: paymentMethod,
          status: status === "DELIVERED" || status === "SHIPPED" ? "COMPLETED" : "PENDING",
          createdAt: date,
        },
      });

      ordersCreated++;
      clientsCreated++;
    }

    // SAV tickets
    if (ticketsToday > 0) {
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const ticketStatus = pick(REPAIR_STATUSES);

      try {
      const ticket = await prisma.repairTicket.create({
        data: {
          ticketNumber: 10000 + Math.floor(Math.random() * 90000),
          customerName: `${firstName} ${lastName}`,
          customerPhone: `06${Math.floor(10000000 + Math.random() * 89999999)}`,
          customerEmail: `${firstName.toLowerCase()}@email.fr`,
          productModel: pick(REPAIR_MODELS),
          serialNumber: `SN-${Math.floor(100000 + Math.random() * 900000)}`,
          type: pick(REPAIR_TYPES),
          status: ticketStatus,
          priority: pick(["LOW", "NORMAL", "NORMAL", "HIGH", "URGENT"]),
          issueDescription: pick(REPAIR_ISSUES),
          trackingToken: randomUUID(),
          createdAt: date,
        },
      });

      // Add status log
      await prisma.repairStatusLog.create({
        data: {
          ticketId: ticket.id,
          fromStatus: "RECU",
          toStatus: ticketStatus,
          note: "Simulation",
          createdAt: date,
        },
      });

      ticketsCreated++;
      } catch { /* skip duplicate ticket */ }
    }

    // CRM interactions — use userId not profileId
    if (Math.random() > 0.5) {
      const profiles = await prisma.customerProfile.findMany({ take: 1, orderBy: { createdAt: "desc" } });
      for (const profile of profiles) {
        await prisma.customerInteraction.create({
          data: {
            customerId: profile.userId,
            type: pick(["EMAIL", "CALL", "VISIT", "NOTE"]),
            subject: pick(["Suivi commande", "Question produit", "Demande devis", "Réclamation", "Retour positif"]),
            content: pick(["Client satisfait", "Demande d'info sur pièces", "Suivi livraison", "Question garantie"]),
            channel: "WEBSITE",
            createdAt: date,
          },
        }).catch(() => {});
        interactionsCreated++;
      }
    }
  }

  console.log(`  Clients créés: ${clientsCreated}`);
  console.log(`  Commandes créées: ${ordersCreated}`);
  console.log(`  Tickets SAV créés: ${ticketsCreated}`);
  console.log(`  Interactions CRM: ${interactionsCreated}`);
  console.log(`\n═══ SIMULATION TERMINÉE ═══\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
