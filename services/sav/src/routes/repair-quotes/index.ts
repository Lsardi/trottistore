/**
 * Devis PDF generation for repair tickets — Professional layout
 *
 * GET /repairs/:id/quote/pdf — admin/technician only
 */
import type { FastifyInstance } from "fastify";
import PDFDocument from "pdfkit";
import { requireRole } from "../../plugins/auth.js";

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || "TrottiStore";
const ADDRESS = "18 bis Rue Méchin, 93450 L'Île-Saint-Denis";
const PHONE = process.env.NEXT_PUBLIC_BRAND_PHONE || "06 04 46 30 55";
const EMAIL = process.env.NEXT_PUBLIC_BRAND_EMAIL || "contact@trottistore.fr";
const WEBSITE = "trottistore.fr";
const TVA_RATE = 20;

// Brand colors
const NEON = "#00CCa8";
const DARK = "#1a1a1a";
const GRAY = "#666666";
const LIGHT_GRAY = "#f0f0f0";
const WHITE = "#ffffff";

function legalFooter(): string {
  const siret = process.env.NEXT_PUBLIC_LEGAL_SIRET || "En cours d'immatriculation";
  const rcs = process.env.NEXT_PUBLIC_LEGAL_RCS || "";
  const tva = process.env.NEXT_PUBLIC_LEGAL_TVA_INTRACOM || "";
  const parts = [BRAND, `SIRET: ${siret}`];
  if (rcs) parts.push(`RCS: ${rcs}`);
  if (tva) parts.push(`TVA: ${tva}`);
  parts.push(ADDRESS);
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
    const ticketRef = `SAV-${String(ticket.ticketNumber).padStart(4, "0")}`;
    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const pdfReady = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    const pageW = 595;
    const margin = 50;
    const contentW = pageW - margin * 2;

    // ── HEADER BAR ──────────────────────────────────────
    doc.rect(0, 0, pageW, 100).fill(DARK);
    doc.rect(0, 96, pageW, 4).fill(NEON);

    // Brand name
    doc.fontSize(26).font("Helvetica-Bold").fillColor(WHITE).text(BRAND, margin, 30);
    doc.fontSize(8).font("Helvetica").fillColor(NEON).text("Spécialiste trottinettes électriques", margin, 60);
    doc.fillColor("#999").text(`${PHONE} — ${EMAIL} — ${WEBSITE}`, margin, 74);

    // Document title — right side
    doc.fontSize(18).font("Helvetica-Bold").fillColor(WHITE).text("DEVIS", 350, 28, { width: contentW - 300, align: "right" });
    doc.fontSize(9).font("Helvetica").fillColor(NEON);
    doc.text(`N° ${quoteRef}`, 350, 52, { width: contentW - 300, align: "right" });
    doc.fillColor("#ccc");
    doc.text(`Date : ${dateStr}`, 350, 66, { width: contentW - 300, align: "right" });
    doc.text(`Réf. ticket : ${ticketRef}`, 350, 78, { width: contentW - 300, align: "right" });

    // ── CLIENT + MATÉRIEL ───────────────────────────────
    let y = 120;

    // Two columns: Client (left) + Matériel (right)
    const colW = (contentW - 20) / 2;

    // Client box
    doc.rect(margin, y, colW, 90).lineWidth(0.5).strokeColor("#ddd").stroke();
    doc.fontSize(7).font("Helvetica-Bold").fillColor(NEON).text("CLIENT", margin + 12, y + 10);

    const customerName = ticket.customer
      ? `${ticket.customer.firstName ?? ""} ${ticket.customer.lastName ?? ""}`.trim()
      : ticket.customerName ?? "—";
    const customerEmail = ticket.customer?.email ?? ticket.customerEmail ?? "";
    const customerPhone = ticket.customer?.phone ?? ticket.customerPhone ?? "";

    doc.fontSize(10).font("Helvetica-Bold").fillColor(DARK).text(customerName, margin + 12, y + 24);
    doc.fontSize(8).font("Helvetica").fillColor(GRAY);
    if (customerEmail) doc.text(customerEmail, margin + 12, y + 40);
    if (customerPhone) doc.text(customerPhone, margin + 12, y + 52);

    // Matériel box
    const rightCol = margin + colW + 20;
    doc.rect(rightCol, y, colW, 90).lineWidth(0.5).strokeColor("#ddd").stroke();
    doc.fontSize(7).font("Helvetica-Bold").fillColor(NEON).text("MATÉRIEL", rightCol + 12, y + 10);
    doc.fontSize(10).font("Helvetica-Bold").fillColor(DARK).text(ticket.productModel, rightCol + 12, y + 24, { width: colW - 24 });
    doc.fontSize(8).font("Helvetica").fillColor(GRAY);
    if (ticket.serialNumber) doc.text(`N° série : ${ticket.serialNumber}`, rightCol + 12, y + 40);
    doc.text(`Type : ${ticket.type}`, rightCol + 12, y + 52);
    doc.text(`Priorité : ${ticket.priority}`, rightCol + 12, y + 64);

    y += 105;

    // ── PROBLÈME + DIAGNOSTIC ───────────────────────────
    doc.rect(margin, y, contentW, 1).fill("#eee");
    y += 10;

    doc.fontSize(7).font("Helvetica-Bold").fillColor(NEON).text("PROBLÈME SIGNALÉ", margin, y);
    y += 12;
    doc.fontSize(8).font("Helvetica").fillColor(DARK).text(ticket.issueDescription, margin, y, { width: contentW });
    y = doc.y + 8;

    if (ticket.diagnosis) {
      doc.fontSize(7).font("Helvetica-Bold").fillColor(NEON).text("DIAGNOSTIC ATELIER", margin, y);
      y += 12;
      doc.fontSize(8).font("Helvetica").fillColor(DARK).text(ticket.diagnosis, margin, y, { width: contentW });
      y = doc.y + 8;
    }

    y += 10;

    // ── TABLE DÉTAIL ────────────────────────────────────
    // Table header
    doc.rect(margin, y, contentW, 22).fill(DARK);
    doc.fontSize(7).font("Helvetica-Bold").fillColor(WHITE);
    doc.text("DÉSIGNATION", margin + 10, y + 7, { width: 230 });
    doc.text("QTÉ", margin + 250, y + 7, { width: 40, align: "center" });
    doc.text("P.U. HT", margin + 300, y + 7, { width: 80, align: "right" });
    doc.text("TOTAL HT", margin + 400, y + 7, { width: 90, align: "right" });
    y += 22;

    // Table rows
    doc.font("Helvetica").fontSize(8).fillColor(DARK);
    let rowIdx = 0;

    for (const p of ticket.partsUsed) {
      const bg = rowIdx % 2 === 0 ? WHITE : LIGHT_GRAY;
      doc.rect(margin, y, contentW, 20).fill(bg);

      const line = p.partRef ? `${p.partName} (${p.partRef})` : p.partName;
      const lineHt = Number(p.unitCost) * p.quantity;

      doc.fillColor(DARK).text(line, margin + 10, y + 6, { width: 230 });
      doc.text(String(p.quantity), margin + 250, y + 6, { width: 40, align: "center" });
      doc.text(`${Number(p.unitCost).toFixed(2)} €`, margin + 300, y + 6, { width: 80, align: "right" });
      doc.font("Helvetica-Bold").text(`${lineHt.toFixed(2)} €`, margin + 400, y + 6, { width: 90, align: "right" });
      doc.font("Helvetica");
      y += 20;
      rowIdx++;
    }

    // Labor row
    if (laborTotalHt > 0) {
      const bg = rowIdx % 2 === 0 ? WHITE : LIGHT_GRAY;
      doc.rect(margin, y, contentW, 20).fill(bg);
      doc.fillColor(DARK).text("Main d'œuvre atelier", margin + 10, y + 6, { width: 230 });
      doc.text("—", margin + 250, y + 6, { width: 40, align: "center" });
      doc.text(`${laborTotalHt.toFixed(2)} €`, margin + 300, y + 6, { width: 80, align: "right" });
      doc.font("Helvetica-Bold").text(`${laborTotalHt.toFixed(2)} €`, margin + 400, y + 6, { width: 90, align: "right" });
      doc.font("Helvetica");
      y += 20;
    }

    // ── TOTALS BOX ──────────────────────────────────────
    y += 5;
    const totalsX = margin + contentW - 200;

    // Sous-total
    doc.fontSize(8).font("Helvetica").fillColor(GRAY);
    doc.text("Sous-total HT", totalsX, y, { width: 110 });
    doc.text(`${totalEstimated.toFixed(2)} €`, totalsX + 110, y, { width: 90, align: "right" });
    y += 16;

    // TVA
    doc.text(`TVA (${TVA_RATE}%)`, totalsX, y, { width: 110 });
    doc.text(`${tvaAmount.toFixed(2)} €`, totalsX + 110, y, { width: 90, align: "right" });
    y += 16;

    // Total TTC — highlighted
    doc.rect(totalsX - 5, y - 2, 210, 26).fill(DARK);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(NEON);
    doc.text("TOTAL TTC", totalsX, y + 4, { width: 110 });
    doc.text(`${totalTtc.toFixed(2)} €`, totalsX + 110, y + 4, { width: 90, align: "right" });

    // ── CONDITIONS ──────────────────────────────────────
    y += 50;
    doc.rect(margin, y, contentW, 1).fill("#eee");
    y += 15;

    doc.fontSize(8).font("Helvetica").fillColor(DARK);
    doc.text("CONDITIONS", margin, y, { continued: false });
    y += 14;
    doc.fontSize(7.5).fillColor(GRAY);
    doc.text("• Devis valable 30 jours à compter de la date d'émission.", margin, y);
    y += 12;
    doc.text("• Les travaux ne démarrent qu'après acceptation écrite du client.", margin, y);
    y += 12;
    doc.text("• Diagnostic : 30€ (inclus si réparation ≤ 30€).", margin, y);
    y += 12;
    doc.text("• Garantie pièces et main d'œuvre : 3 mois après réparation.", margin, y);
    y += 12;
    doc.text("• Paiement à la récupération du matériel (CB, espèces, virement).", margin, y);

    // ── SIGNATURE ───────────────────────────────────────
    y += 30;
    doc.fontSize(8).font("Helvetica-Bold").fillColor(DARK).text("BON POUR ACCORD", margin, y);
    y += 16;
    doc.fontSize(8).font("Helvetica").fillColor(GRAY);
    doc.text("Date :", margin, y);
    doc.text("Signature :", margin + 200, y);

    // Signature line
    y += 14;
    doc.moveTo(margin, y).lineTo(margin + 150, y).lineWidth(0.5).strokeColor("#ccc").stroke();
    doc.moveTo(margin + 200, y).lineTo(margin + 400, y).stroke();

    // ── FOOTER ──────────────────────────────────────────
    // Bottom bar
    doc.rect(0, 800, pageW, 42).fill(DARK);
    doc.rect(0, 800, pageW, 2).fill(NEON);
    doc.fontSize(6.5).font("Helvetica").fillColor("#999").text(
      legalFooter(),
      margin, 812, { width: contentW, align: "center" },
    );
    doc.fillColor(NEON).text(
      `${WEBSITE} — ${PHONE}`,
      margin, 824, { width: contentW, align: "center" },
    );

    doc.end();
    const pdfBuffer = await pdfReady;

    app.log.info({ ticketId: id, quoteRef }, "Quote PDF generated");

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="${quoteRef}.pdf"`);
    return reply.send(pdfBuffer);
  });
}
