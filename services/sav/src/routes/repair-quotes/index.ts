/**
 * Devis PDF generation for repair tickets.
 *
 * GET /repairs/:id/quote/pdf — admin/technician only
 *
 * Reuses the same layout as the invoice PDF in the ecommerce service so
 * both documents feel like they come from the same company. Price breakdown
 * is computed server-side from the stored parts + labor to avoid any
 * client-side math.
 */
import type { FastifyInstance } from "fastify";
import PDFDocument from "pdfkit";
import { requireRole } from "../../plugins/auth.js";

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || "TrottiStore";
const ADDRESS = "18 bis Rue Méchin, 93450 L'Île-Saint-Denis";
const PHONE = process.env.NEXT_PUBLIC_BRAND_PHONE || "06 04 46 30 55";
const EMAIL = process.env.NEXT_PUBLIC_BRAND_EMAIL || "contact@trottistore.fr";
const TVA_RATE = 20; // Flat 20% VAT on repair services; can be overridden later.

function legalFooter(): string {
  const siret = process.env.NEXT_PUBLIC_LEGAL_SIRET || "SIRET non renseigné";
  const rcs = process.env.NEXT_PUBLIC_LEGAL_RCS || "";
  const tva = process.env.NEXT_PUBLIC_LEGAL_TVA_INTRACOM || "TVA non renseignée";
  const parts = [`${BRAND}`, `SIRET: ${siret}`];
  if (rcs) parts.push(`RCS: ${rcs}`);
  parts.push(`TVA: ${tva}`);
  return parts.join(" — ");
}

export async function quoteRoutes(app: FastifyInstance) {
  const staffOnly = {
    preHandler: [
      app.authenticate,
      requireRole("SUPERADMIN", "ADMIN", "MANAGER", "TECHNICIAN"),
    ],
  };

  app.get("/repairs/:id/quote/pdf", staffOnly, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ticket = await app.prisma.repairTicket.findUnique({
      where: { id },
      include: {
        partsUsed: { orderBy: { createdAt: "asc" } },
        customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
      },
    });
    if (!ticket) {
      return reply
        .status(404)
        .send({ success: false, error: { code: "NOT_FOUND", message: "Ticket introuvable" } });
    }

    const partsTotalHt = ticket.partsUsed.reduce(
      (sum, p) => sum + Number(p.unitCost) * p.quantity,
      0,
    );
    const totalEstimated = ticket.estimatedCost ? Number(ticket.estimatedCost) : partsTotalHt;
    const laborTotalHt = Math.max(0, totalEstimated - partsTotalHt);
    const tvaAmount = totalEstimated * (TVA_RATE / 100);
    const totalTtc = totalEstimated + tvaAmount;
    const quoteRef = `DEVIS-${new Date(ticket.createdAt).getFullYear()}-${String(
      ticket.ticketNumber,
    ).padStart(6, "0")}`;

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const pdfReady = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    // Header — brand
    doc.fontSize(20).font("Helvetica-Bold").text(BRAND, 50, 50);
    doc.fontSize(9).font("Helvetica").text(ADDRESS, 50, 75);
    doc.text(`${PHONE} — ${EMAIL}`, 50, 87);

    // Header — document meta
    doc.fontSize(14).font("Helvetica-Bold").text("DEVIS RÉPARATION", 350, 50, { align: "right" });
    doc.fontSize(9).font("Helvetica");
    doc.text(`N° ${quoteRef}`, 350, 70, { align: "right" });
    doc.text(`Date: ${new Date().toLocaleDateString("fr-FR")}`, 350, 82, { align: "right" });
    doc.text(`Ticket: SAV-${String(ticket.ticketNumber).padStart(4, "0")}`, 350, 94, {
      align: "right",
    });

    // Customer block
    doc.moveDown(3);
    const customerName = ticket.customer
      ? `${ticket.customer.firstName ?? ""} ${ticket.customer.lastName ?? ""}`.trim()
      : ticket.customerName ?? "";
    const customerEmail = ticket.customer?.email ?? ticket.customerEmail;
    const customerPhone = ticket.customer?.phone ?? ticket.customerPhone;
    doc.fontSize(10).font("Helvetica-Bold").text("Client", 50);
    doc.fontSize(9).font("Helvetica");
    if (customerName) doc.text(customerName);
    if (customerEmail) doc.text(customerEmail);
    if (customerPhone) doc.text(customerPhone);

    // Scooter block
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text("Matériel");
    doc.font("Helvetica").text(ticket.productModel);
    if (ticket.serialNumber) doc.text(`N° série : ${ticket.serialNumber}`);

    // Problem reported
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text("Problème signalé");
    doc.font("Helvetica").text(ticket.issueDescription, { width: 480 });
    if (ticket.diagnosis) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").text("Diagnostic");
      doc.font("Helvetica").text(ticket.diagnosis, { width: 480 });
    }

    // Detail table
    const tableTop = doc.y + 20;
    doc.fontSize(8).font("Helvetica-Bold");
    doc.text("Désignation", 50, tableTop, { width: 250 });
    doc.text("Qté", 310, tableTop, { width: 40, align: "center" });
    doc.text("P.U. HT", 360, tableTop, { width: 70, align: "right" });
    doc.text("Total HT", 440, tableTop, { width: 80, align: "right" });
    doc.moveTo(50, tableTop + 14).lineTo(530, tableTop + 14).stroke();

    let y = tableTop + 20;
    doc.font("Helvetica").fontSize(8);
    for (const p of ticket.partsUsed) {
      const line = p.partRef ? `${p.partName} (${p.partRef})` : p.partName;
      const lineHt = Number(p.unitCost) * p.quantity;
      doc.text(line, 50, y, { width: 250 });
      doc.text(String(p.quantity), 310, y, { width: 40, align: "center" });
      doc.text(`${Number(p.unitCost).toFixed(2)} €`, 360, y, { width: 70, align: "right" });
      doc.text(`${lineHt.toFixed(2)} €`, 440, y, { width: 80, align: "right" });
      y += 14;
    }

    // Labor line (if any)
    if (laborTotalHt > 0) {
      doc.text("Main d'œuvre atelier", 50, y, { width: 250 });
      doc.text("—", 310, y, { width: 40, align: "center" });
      doc.text(`${laborTotalHt.toFixed(2)} €`, 360, y, { width: 70, align: "right" });
      doc.text(`${laborTotalHt.toFixed(2)} €`, 440, y, { width: 80, align: "right" });
      y += 14;
    }

    // Totals
    doc.moveTo(350, y + 5).lineTo(530, y + 5).stroke();
    y += 12;
    doc.font("Helvetica");
    doc.text("Sous-total HT", 350, y, { width: 100 });
    doc.text(`${totalEstimated.toFixed(2)} €`, 440, y, { width: 80, align: "right" });
    y += 14;
    doc.text(`TVA (${TVA_RATE}%)`, 350, y, { width: 100 });
    doc.text(`${tvaAmount.toFixed(2)} €`, 440, y, { width: 80, align: "right" });
    y += 16;
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("TOTAL TTC", 350, y, { width: 100 });
    doc.text(`${totalTtc.toFixed(2)} €`, 440, y, { width: 80, align: "right" });

    // Acceptance block
    y += 40;
    doc.font("Helvetica").fontSize(9);
    doc.text(
      "Devis valable 30 jours. Les travaux ne démarrent qu'après acceptation écrite du client.",
      50,
      y,
      { width: 480 },
    );
    y += 24;
    doc.font("Helvetica-Bold").text("Bon pour accord :", 50, y);
    doc.font("Helvetica").fontSize(8);
    y += 14;
    doc.text("Date :", 50, y);
    doc.text("Signature :", 250, y);

    // Legal footer
    doc.fontSize(7).fillColor("#666").text(legalFooter(), 50, 780, { width: 500, align: "center" });

    doc.end();
    const pdfBuffer = await pdfReady;

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="${quoteRef}.pdf"`);
    return reply.send(pdfBuffer);
  });
}
