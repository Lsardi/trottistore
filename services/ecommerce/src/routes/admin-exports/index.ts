/**
 * Admin CSV exports — read-only data dumps for tax, reporting, and
 * accountant handoff. All endpoints are ADMIN/MANAGER-gated and return
 * text/csv with a timestamped filename.
 *
 * Columns are chosen to match what a French accountant or an Excel user
 * would expect. Everything is UTF-8 with a BOM so Excel opens accented
 * columns correctly without manual encoding fiddling.
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireRole } from "../../plugins/auth.js";

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Escape a single CSV field per RFC 4180: wrap in quotes if it contains a
 * delimiter, quote, or newline; double inner quotes.
 */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(values: unknown[]): string {
  return values.map(csvField).join(",");
}

/** Format a date as ISO yyyy-mm-dd for CSV readability (no timezone). */
function csvDate(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function csvDateTime(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function sendCsv(reply: FastifyReply, filename: string, rows: string[]): void {
  // BOM ensures Excel reads UTF-8 accents correctly.
  const body = "\uFEFF" + rows.join("\r\n") + "\r\n";
  reply.header("Content-Type", "text/csv; charset=utf-8");
  reply.header("Content-Disposition", `attachment; filename="${filename}"`);
  reply.send(body);
}

function timestampedFilename(prefix: string): string {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return `${prefix}-${stamp}.csv`;
}

const dateRangeSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD")
    .optional(),
});

function parseDateRange(
  query: unknown,
): { gte?: Date; lte?: Date } | null {
  const parsed = dateRangeSchema.safeParse(query);
  if (!parsed.success) return null;
  const range: { gte?: Date; lte?: Date } = {};
  if (parsed.data.from) {
    range.gte = new Date(`${parsed.data.from}T00:00:00.000Z`);
  }
  if (parsed.data.to) {
    range.lte = new Date(`${parsed.data.to}T23:59:59.999Z`);
  }
  return range;
}

// ─── Routes ──────────────────────────────────────────────────

export async function adminExportRoutes(app: FastifyInstance) {
  const adminOnly = {
    preHandler: [app.authenticate, requireRole("SUPERADMIN", "ADMIN", "MANAGER")],
  };

  // ─── GET /admin/exports/orders.csv ─────────────────────────
  // Columns: one row per order (not per line item) to keep the file
  // immediately usable in a pivot table. Includes customer, status,
  // payment, shipping, subtotal HT, VAT, TTC, tracking.
  app.get("/admin/exports/orders.csv", adminOnly, async (request, reply) => {
    const range = parseDateRange(request.query);
    if (range === null) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "from/to must be YYYY-MM-DD" },
      });
    }
    const where: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (range.gte || range.lte) {
      where.createdAt = {};
      if (range.gte) where.createdAt.gte = range.gte;
      if (range.lte) where.createdAt.lte = range.lte;
    }

    const orders = await app.prisma.order.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        shippingMethod: true,
        trackingNumber: true,
        shippedAt: true,
        deliveredAt: true,
        subtotalHt: true,
        tvaAmount: true,
        shippingCost: true,
        totalTtc: true,
        customer: {
          select: { email: true, firstName: true, lastName: true, phone: true },
        },
      },
    });

    const header = csvRow([
      "N_commande",
      "Date",
      "Statut",
      "Paiement",
      "Statut_paiement",
      "Livraison",
      "Tracking",
      "Date_expedition",
      "Date_livraison",
      "Client_email",
      "Client_prenom",
      "Client_nom",
      "Client_tel",
      "Sous_total_HT",
      "TVA",
      "Port",
      "Total_TTC",
    ]);
    const rows = orders.map((o) =>
      csvRow([
        o.orderNumber,
        csvDateTime(o.createdAt),
        o.status,
        o.paymentMethod,
        o.paymentStatus,
        o.shippingMethod ?? "",
        o.trackingNumber ?? "",
        csvDate(o.shippedAt),
        csvDate(o.deliveredAt),
        o.customer?.email ?? "",
        o.customer?.firstName ?? "",
        o.customer?.lastName ?? "",
        o.customer?.phone ?? "",
        Number(o.subtotalHt).toFixed(2),
        Number(o.tvaAmount).toFixed(2),
        o.shippingCost != null ? Number(o.shippingCost).toFixed(2) : "0.00",
        Number(o.totalTtc).toFixed(2),
      ]),
    );

    sendCsv(reply, timestampedFilename("commandes"), [header, ...rows]);
    return reply;
  });

  // ─── GET /admin/exports/products.csv ───────────────────────
  // One row per product (not per variant). For stock / catalog review.
  app.get("/admin/exports/products.csv", adminOnly, async (_request, reply) => {
    const products = await app.prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        brand: { select: { name: true } },
        primarySupplier: { select: { name: true } },
        categories: {
          include: { category: { select: { name: true } } },
        },
        variants: {
          where: { isActive: true },
          select: { stockQuantity: true },
        },
      },
    });

    const header = csvRow([
      "SKU",
      "Nom",
      "Marque",
      "Categories",
      "Statut",
      "Prix_HT",
      "TVA",
      "Stock_total",
      "Fournisseur",
      "Compatibilite",
      "Date_creation",
    ]);
    const rows = products.map((p) =>
      csvRow([
        p.sku,
        p.name,
        p.brand?.name ?? "",
        p.categories.map((c) => c.category.name).join(" / "),
        p.status,
        Number(p.priceHt).toFixed(2),
        Number(p.tvaRate).toFixed(2),
        p.variants.reduce((sum, v) => sum + v.stockQuantity, 0),
        p.primarySupplier?.name ?? "",
        p.compatibleModels.join(" | "),
        csvDate(p.createdAt),
      ]),
    );

    sendCsv(reply, timestampedFilename("produits"), [header, ...rows]);
    return reply;
  });

  // ─── GET /admin/exports/customers.csv ──────────────────────
  // Only real customers (role=CLIENT + has a customerProfile).
  app.get("/admin/exports/customers.csv", adminOnly, async (_request, reply) => {
    const customers = await app.prisma.user.findMany({
      where: {
        role: "CLIENT",
        customerProfile: { isNot: null },
      },
      orderBy: { lastName: "asc" },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
        lastLoginAt: true,
        customerProfile: {
          select: {
            loyaltyTier: true,
            loyaltyPoints: true,
            totalOrders: true,
            totalSpent: true,
            source: true,
            tags: true,
          },
        },
      },
    });

    const header = csvRow([
      "Email",
      "Prenom",
      "Nom",
      "Telephone",
      "Source",
      "Niveau_fidelite",
      "Points",
      "Nb_commandes",
      "Total_depense",
      "Tags",
      "Inscrit_le",
      "Dernier_login",
    ]);
    const rows = customers.map((c) =>
      csvRow([
        c.email,
        c.firstName,
        c.lastName,
        c.phone ?? "",
        c.customerProfile?.source ?? "",
        c.customerProfile?.loyaltyTier ?? "",
        c.customerProfile?.loyaltyPoints ?? 0,
        c.customerProfile?.totalOrders ?? 0,
        c.customerProfile?.totalSpent != null
          ? Number(c.customerProfile.totalSpent).toFixed(2)
          : "0.00",
        (c.customerProfile?.tags ?? []).join(" | "),
        csvDate(c.createdAt),
        csvDate(c.lastLoginAt),
      ]),
    );

    sendCsv(reply, timestampedFilename("clients"), [header, ...rows]);
    return reply;
  });
}
