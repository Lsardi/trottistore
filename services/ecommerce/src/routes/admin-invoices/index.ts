/**
 * Invoice PDF generation route.
 *
 * GET /admin/orders/:id/invoice — generates a PDF invoice for a given order.
 */
import type { FastifyInstance } from "fastify";
import PDFDocument from "pdfkit";
import { requireRole } from "../../plugins/auth.js";

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || "TrottiStore";
const ADDRESS = "18 bis Rue Méchin, 93450 L'Île-Saint-Denis";
const PHONE = process.env.NEXT_PUBLIC_BRAND_PHONE || "06 04 46 30 55";
const EMAIL = process.env.NEXT_PUBLIC_BRAND_EMAIL || "contact@trottistore.fr";

export async function invoiceRoutes(app: FastifyInstance) {
  const adminOnly = {
    preHandler: [app.authenticate, requireRole("SUPERADMIN", "ADMIN", "MANAGER")],
  };

  app.get("/admin/orders/:id/invoice", adminOnly, async (request, reply) => {
    const { id } = request.params as { id: string };

    const order = await app.prisma.order.findUnique({
      where: { id },
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
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Commande introuvable" },
      });
    }

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const pdfReady = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    // Header
    doc.fontSize(20).font("Helvetica-Bold").text(BRAND, 50, 50);
    doc.fontSize(9).font("Helvetica").text(ADDRESS, 50, 75);
    doc.text(`${PHONE} — ${EMAIL}`, 50, 87);

    // Invoice info
    doc.fontSize(14).font("Helvetica-Bold").text("FACTURE", 400, 50, { align: "right" });
    doc.fontSize(9).font("Helvetica");
    doc.text(`N° ${order.orderNumber}`, 400, 70, { align: "right" });
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString("fr-FR")}`, 400, 82, { align: "right" });
    doc.text(`Paiement: ${order.paymentMethod}`, 400, 94, { align: "right" });

    // Client
    doc.moveDown(2);
    const shippingAddr = order.shippingAddress as Record<string, string> | null;
    doc.fontSize(10).font("Helvetica-Bold").text("Client", 50);
    doc.fontSize(9).font("Helvetica");
    doc.text(`${order.customer.firstName} ${order.customer.lastName}`);
    doc.text(order.customer.email);
    if (shippingAddr?.street) {
      doc.text(shippingAddr.street);
      doc.text(`${shippingAddr.postalCode || ""} ${shippingAddr.city || ""}`);
    }

    // Table header
    const tableTop = doc.y + 20;
    doc.fontSize(8).font("Helvetica-Bold");
    doc.text("Produit", 50, tableTop, { width: 250 });
    doc.text("Qté", 310, tableTop, { width: 40, align: "center" });
    doc.text("P.U. HT", 360, tableTop, { width: 70, align: "right" });
    doc.text("Total HT", 440, tableTop, { width: 80, align: "right" });

    doc.moveTo(50, tableTop + 14).lineTo(530, tableTop + 14).stroke();

    // Items
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

    // Totals
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

    // Footer
    doc.fontSize(7).font("Helvetica").fillColor("#888");
    doc.text(
      `${BRAND} — SIRET: XXX XXX XXX XXXXX — TVA intracommunautaire: FR XX XXX XXX XXX`,
      50,
      750,
      { align: "center", width: 480 },
    );

    doc.end();

    const pdfBuffer = await pdfReady;

    reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="facture-${order.orderNumber}.pdf"`)
      .send(pdfBuffer);
  });
}
