/**
 * Invoice PDF generation routes.
 *
 * GET /admin/orders/:id/invoice — admin (any ADMIN+ can pull any order)
 * GET /orders/:id/invoice       — client (must own the order)
 *
 * Both routes share the same PDFKit builder. Legal mentions are read from
 * env vars so they can be set on Railway without redeploying code:
 *   NEXT_PUBLIC_LEGAL_SIRET, NEXT_PUBLIC_LEGAL_TVA_INTRACOM, NEXT_PUBLIC_LEGAL_RCS
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import PDFDocument from "pdfkit";
import { requireRole } from "../../plugins/auth.js";

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || "TrottiStore";
const ADDRESS = "18 bis Rue Méchin, 93450 L'Île-Saint-Denis";
const PHONE = process.env.NEXT_PUBLIC_BRAND_PHONE || "06 04 46 30 55";
const EMAIL = process.env.NEXT_PUBLIC_BRAND_EMAIL || "contact@trottistore.fr";

function legalFooter(): string {
  const siret = process.env.NEXT_PUBLIC_LEGAL_SIRET || "SIRET non renseigné";
  const tva = process.env.NEXT_PUBLIC_LEGAL_TVA_INTRACOM || "TVA non renseignée";
  return `${BRAND} — SIRET: ${siret} — TVA intracommunautaire: ${tva}`;
}

async function buildInvoicePdf(
  app: FastifyInstance,
  orderId: string,
  reply: FastifyReply,
): Promise<{ ok: false; status: number; error: { code: string; message: string } } | { ok: true; pdf: Buffer; orderNumber: number }> {
  const order = await app.prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: {
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
      items: {
        include: {
          product: { select: { name: true, sku: true } },
          variant: { select: { name: true, sku: true } },
        },
      },
    },
  });

  if (!order) {
    return {
      ok: false,
      status: 404,
      error: { code: "NOT_FOUND", message: "Commande introuvable" },
    };
  }

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const pdfReady = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(20).font("Helvetica-Bold").text(BRAND, 50, 50);
  doc.fontSize(9).font("Helvetica").text(ADDRESS, 50, 75);
  doc.text(`${PHONE} — ${EMAIL}`, 50, 87);

  doc.fontSize(14).font("Helvetica-Bold").text("FACTURE", 400, 50, { align: "right" });
  doc.fontSize(9).font("Helvetica");
  doc.text(`N° ${order.orderNumber}`, 400, 70, { align: "right" });
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString("fr-FR")}`, 400, 82, { align: "right" });
  doc.text(`Paiement: ${order.paymentMethod}`, 400, 94, { align: "right" });

  doc.moveDown(2);
  const shippingAddr = order.shippingAddress as Record<string, string> | null;
  doc.fontSize(10).font("Helvetica-Bold").text("Client", 50);
  doc.fontSize(9).font("Helvetica");
  doc.text(`${order.customer?.firstName ?? ""} ${order.customer?.lastName ?? ""}`.trim());
  if (order.customer?.email) doc.text(order.customer.email);
  if (shippingAddr?.street) {
    doc.text(shippingAddr.street);
    doc.text(`${shippingAddr.postalCode || ""} ${shippingAddr.city || ""}`);
  }

  const tableTop = doc.y + 20;
  doc.fontSize(8).font("Helvetica-Bold");
  doc.text("Produit", 50, tableTop, { width: 250 });
  doc.text("Qté", 310, tableTop, { width: 40, align: "center" });
  doc.text("P.U. HT", 360, tableTop, { width: 70, align: "right" });
  doc.text("Total HT", 440, tableTop, { width: 80, align: "right" });
  doc.moveTo(50, tableTop + 14).lineTo(530, tableTop + 14).stroke();

  let y = tableTop + 20;
  doc.font("Helvetica").fontSize(8);
  for (const item of order.items) {
    const name = item.product?.name || "Produit";
    const variant = item.variant?.name && item.variant.name !== "Default" ? ` — ${item.variant.name}` : "";
    doc.text(`${name}${variant}`, 50, y, { width: 250 });
    doc.text(String(item.quantity), 310, y, { width: 40, align: "center" });
    doc.text(`${Number(item.unitPriceHt).toFixed(2)} €`, 360, y, { width: 70, align: "right" });
    doc.text(`${Number(item.totalHt).toFixed(2)} €`, 440, y, { width: 80, align: "right" });
    y += 16;
  }

  doc.moveTo(350, y + 5).lineTo(530, y + 5).stroke();
  y += 12;
  doc.font("Helvetica");
  doc.text("Sous-total HT", 350, y, { width: 100 });
  doc.text(`${Number(order.subtotalHt).toFixed(2)} €`, 440, y, { width: 80, align: "right" });
  y += 14;
  doc.text(`TVA (${Number(order.items[0]?.tvaRate || 20)}%)`, 350, y, { width: 100 });
  doc.text(`${Number(order.tvaAmount).toFixed(2)} €`, 440, y, { width: 80, align: "right" });
  y += 14;
  doc.text("Livraison", 350, y, { width: 100 });
  doc.text(`${Number(order.shippingCost).toFixed(2)} €`, 440, y, { width: 80, align: "right" });
  y += 16;
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("TOTAL TTC", 350, y, { width: 100 });
  doc.text(`${Number(order.totalTtc).toFixed(2)} €`, 440, y, { width: 80, align: "right" });

  doc.fontSize(7).font("Helvetica").fillColor("#888");
  doc.text(legalFooter(), 50, 750, { align: "center", width: 480 });

  doc.end();

  const pdfBuffer = await pdfReady;
  reply.header("Content-Type", "application/pdf");
  reply.header(
    "Content-Disposition",
    `attachment; filename="facture-${order.orderNumber}.pdf"`,
  );
  return { ok: true, pdf: pdfBuffer, orderNumber: order.orderNumber };
}

export async function invoiceRoutes(app: FastifyInstance) {
  const adminOnly = {
    preHandler: [app.authenticate, requireRole("SUPERADMIN", "ADMIN", "MANAGER")],
  };

  app.get("/admin/orders/:id/invoice", adminOnly, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await buildInvoicePdf(app, id, reply);
    if (!result.ok) return reply.status(result.status).send({ success: false, error: result.error });
    return reply.send(result.pdf);
  });

  // Client-facing invoice download. The user must own the order.
  app.get(
    "/orders/:id/invoice",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.user.userId;

      const owner = await app.prisma.order.findUnique({
        where: { id },
        select: { customerId: true, status: true },
      });
      if (!owner) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Commande introuvable" },
        });
      }
      if (owner.customerId !== userId) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "Cette commande ne vous appartient pas" },
        });
      }
      // Don't expose an invoice for a not-yet-paid order to avoid confusion.
      if (owner.status === "PENDING") {
        return reply.status(400).send({
          success: false,
          error: { code: "ORDER_NOT_PAID", message: "Cette commande n'est pas encore validée" },
        });
      }

      const result = await buildInvoicePdf(app, id, reply);
      if (!result.ok) return reply.status(result.status).send({ success: false, error: result.error });
      return reply.send(result.pdf);
    },
  );
}
