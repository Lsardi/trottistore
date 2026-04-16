/**
 * Email templates for ecommerce transactional emails.
 */

const BRAND = "TrottiStore";
const BASE_URL = process.env.BASE_URL || "https://trottistore.fr";

/**
 * HTML entity escape for email templates (CL-03, 2026-04-12).
 *
 * Every variable interpolated into the HTML output of a template MUST go
 * through this helper if it contains any user-controlled input (customer
 * name, product name, address, etc). Without it, a product named
 * `<img src=x onerror=alert(1)>` or a customer firstName
 * `<script>alert(1)</script>` would render as executable HTML inside the
 * email, leading to XSS in clients that render HTML (Outlook, Apple Mail,
 * some webmails).
 *
 * Scope is intentionally narrow: escape `& < > " '` which is the minimal
 * set that breaks HTML interpolation. Numbers, URLs built from constants,
 * and server-side enums do NOT need escaping.
 */
function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${BRAND}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

    <!-- Header -->
    <div style="background-color: #141414; border: 1px solid #2A2A2A; border-bottom: 2px solid #00FFD1; padding: 24px 32px; text-align: center;">
      <span style="font-size: 24px; font-weight: 800; letter-spacing: 2px; color: #00FFD1;">TROTTI</span><span style="font-size: 24px; font-weight: 800; letter-spacing: 2px; color: #E8E8E8;">STORE</span>
      <p style="font-size: 11px; color: #777; margin: 8px 0 0 0; letter-spacing: 1px; text-transform: uppercase;">Spécialiste trottinettes électriques</p>
    </div>

    <!-- Body -->
    <div style="background-color: #141414; border: 1px solid #2A2A2A; border-top: none; padding: 32px;">
      ${content}
    </div>

    <!-- Footer -->
    <div style="background-color: #0F0F0F; border: 1px solid #2A2A2A; border-top: none; padding: 24px 32px; text-align: center;">
      <p style="font-size: 12px; color: #999; margin: 0 0 8px 0;">
        ${BRAND} — 18 bis Rue Méchin, 93450 L'Île-Saint-Denis
      </p>
      <p style="font-size: 12px; color: #999; margin: 0 0 8px 0;">
        📞 06 04 46 30 55 · ✉ contact@trottistore.fr
      </p>
      <p style="margin: 12px 0 0 0;">
        <a href="${BASE_URL}" style="color: #00FFD1; text-decoration: none; font-size: 12px;">trottistore.fr</a>
        <span style="color: #333; margin: 0 8px;">·</span>
        <a href="${BASE_URL}/reparation" style="color: #777; text-decoration: none; font-size: 12px;">Réparation</a>
        <span style="color: #333; margin: 0 8px;">·</span>
        <a href="${BASE_URL}/produits" style="color: #777; text-decoration: none; font-size: 12px;">Catalogue</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: string;
}

interface OrderConfirmData {
  orderNumber: number;
  customerName: string;
  items: OrderItem[];
  subtotalHt: string;
  shippingCost: string;
  totalTtc: string;
  paymentMethod: string;
  shippingAddress: string;
}

export function orderConfirmationEmail(data: OrderConfirmData): { subject: string; html: string } {
  const itemsHtml = data.items
    .map(
      (i) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${esc(i.name)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${i.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${esc(i.unitPrice)} €</td>
        </tr>`
    )
    .join("");

  const html = layout(`
    <h2 style="color: #E8E8E8; font-size: 18px;">Merci pour votre commande !</h2>
    <p style="color: #999;">Bonjour ${esc(data.customerName)},</p>
    <p style="color: #999;">
      Votre commande <strong>#${data.orderNumber}</strong> a bien été enregistrée.
    </p>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr style="background: #1C1C1C;">
          <th style="padding: 8px; text-align: left;">Produit</th>
          <th style="padding: 8px; text-align: center;">Qté</th>
          <th style="padding: 8px; text-align: right;">Prix HT</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div style="text-align: right; margin: 16px 0;">
      <p style="color: #999; margin: 4px 0;">Sous-total HT : <strong>${esc(data.subtotalHt)} €</strong></p>
      <p style="color: #999; margin: 4px 0;">Livraison : <strong>${esc(data.shippingCost)} €</strong></p>
      <p style="color: #E8E8E8; margin: 4px 0; font-size: 16px;">Total TTC : <strong>${esc(data.totalTtc)} €</strong></p>
    </div>

    <div style="background: #1C1C1C; padding: 16px; margin: 16px 0;">
      <p style="color: #999; margin: 4px 0;"><strong>Paiement :</strong> ${esc(data.paymentMethod)}</p>
      <p style="color: #999; margin: 4px 0;"><strong>Livraison :</strong> ${esc(data.shippingAddress)}</p>
    </div>

    <p style="color: #999;">
      Vous pouvez suivre votre commande depuis votre
      <a href="${BASE_URL}/mon-compte" style="color: #00FFD1;">espace client</a>.
    </p>
  `);

  return {
    subject: `Confirmation de commande #${data.orderNumber} — ${BRAND}`,
    html,
  };
}

export function passwordResetEmail(name: string, resetUrl: string): { subject: string; html: string } {
  // resetUrl is built server-side from BASE_URL + a randomUUID token,
  // so it is safe to interpolate without escaping. name is user-controlled.
  const html = layout(`
    <h2 style="color: #E8E8E8; font-size: 18px;">Réinitialisation de votre mot de passe</h2>
    <p style="color: #999;">Bonjour ${esc(name)},</p>
    <p style="color: #999;">
      Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :
    </p>
    <p>
      <a href="${resetUrl}" style="display: inline-block; background: #00FFD1; color: #0A0A0A; padding: 14px 28px; text-decoration: none; font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">
        RÉINITIALISER MON MOT DE PASSE
      </a>
    </p>
    <p style="color: #777; font-size: 13px;">
      Ce lien est valable 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.
    </p>
  `);

  return {
    subject: `Réinitialisation de mot de passe — ${BRAND}`,
    html,
  };
}

export function staffInvitationEmail(
  name: string,
  role: string,
  resetUrl: string,
): { subject: string; html: string } {
  const html = layout(`
    <h2 style="color: #E8E8E8; font-size: 18px;">Bienvenue dans l'équipe ${BRAND} !</h2>
    <p style="color: #999;">Bonjour ${esc(name)},</p>
    <p style="color: #999;">
      Un compte <strong>${esc(role)}</strong> a été créé pour vous. Cliquez ci-dessous pour définir votre mot de passe et accéder au back-office :
    </p>
    <p>
      <a href="${resetUrl}" style="display: inline-block; background: #00FFD1; color: #0A0A0A; padding: 14px 28px; text-decoration: none; font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">
        DÉFINIR MON MOT DE PASSE
      </a>
    </p>
    <p style="color: #777; font-size: 13px;">
      Ce lien est valable 72 heures. Si vous n'avez pas reçu cette invitation, ignorez cet email.
    </p>
  `);

  return {
    subject: `Invitation équipe ${BRAND} — Configurez votre accès`,
    html,
  };
}

interface OrderShippedData {
  orderNumber: number;
  customerName: string;
  trackingNumber: string;
  shippingAddress?: string;
}

export function orderShippedEmail(data: OrderShippedData): { subject: string; html: string } {
  const html = layout(`
    <h2 style="color: #E8E8E8; font-size: 18px;">Votre commande est en route !</h2>
    <p style="color: #999;">Bonjour ${esc(data.customerName)},</p>
    <p style="color: #999;">
      Bonne nouvelle : votre commande <strong>#${data.orderNumber}</strong> vient d'être expédiée.
    </p>

    <div style="background: #1C1C1C; padding: 16px; margin: 20px 0; border-left: 3px solid #00CCa8;">
      <p style="color: #999; margin: 4px 0;"><strong>Numéro de suivi :</strong></p>
      <p style="color: #E8E8E8; font-size: 16px; font-family: monospace; margin: 4px 0;">
        ${esc(data.trackingNumber)}
      </p>
      ${data.shippingAddress ? `<p style="color: #999; margin: 12px 0 4px 0; font-size: 13px;"><strong>Adresse de livraison :</strong> ${esc(data.shippingAddress)}</p>` : ""}
    </div>

    <p style="color: #999;">
      Vous pouvez suivre l'acheminement directement chez le transporteur, ou depuis votre
      <a href="${BASE_URL}/mon-compte" style="color: #00FFD1;">espace client</a>.
    </p>

    <p style="color: #777; font-size: 13px;">
      Une question ? Une anomalie à la livraison ? Répondez à cet email ou contactez notre service client.
    </p>
  `);

  return {
    subject: `Commande #${data.orderNumber} expédiée — ${BRAND}`,
    html,
  };
}

export function verificationEmail(name: string, code: string): { subject: string; html: string } {
  const html = layout(`
    <h2 style="color: #E8E8E8; font-size: 18px;">Vérifiez votre adresse email</h2>
    <p style="color: #999;">Bonjour ${esc(name)},</p>
    <p style="color: #999;">
      Votre code de vérification est :
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <span style="display: inline-block; background: #1C1C1C; border: 2px solid #00FFD1; color: #00FFD1; padding: 20px 40px; font-size: 32px; font-weight: 800; letter-spacing: 12px; font-family: 'SF Mono', 'Fira Code', monospace;">
        ${esc(code)}
      </span>
    </div>
    <p style="color: #777; font-size: 13px;">
      Ce code expire dans 15 minutes. Si vous n'avez pas créé de compte, ignorez cet email.
    </p>
  `);

  return {
    subject: `${BRAND} — Code de vérification : ${code}`,
    html,
  };
}

// CL-08: Invoice email sent automatically after payment confirmation (CGI art. 289-VII)
interface InvoiceEmailData {
  orderNumber: number;
  invoiceRef: string;
  customerName: string;
  totalTtc: string;
  invoiceUrl: string;
}

export function invoiceEmail(data: InvoiceEmailData): { subject: string; html: string } {
  const html = layout(`
    <h2 style="color: #E8E8E8; font-size: 18px;">Votre facture ${esc(data.invoiceRef)}</h2>
    <p style="color: #999;">Bonjour ${esc(data.customerName)},</p>
    <p style="color: #999;">
      Le paiement de votre commande n°${esc(String(data.orderNumber))} a été confirmé.
      Votre facture d'un montant de <strong>${esc(data.totalTtc)} € TTC</strong> est disponible.
    </p>
    <p>
      <a href="${esc(data.invoiceUrl)}" style="display: inline-block; background: #00FFD1; color: #0A0A0A; padding: 14px 28px; text-decoration: none; font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">
        TÉLÉCHARGER LA FACTURE
      </a>
    </p>
    <p style="color: #777; font-size: 12px;">
      Cette facture est également accessible depuis votre espace client, rubrique "Mes commandes".
    </p>
  `);

  return {
    subject: `${BRAND} — Facture ${data.invoiceRef} (commande n°${data.orderNumber})`,
    html,
  };
}

export function welcomeEmail(name: string): { subject: string; html: string } {
  const html = layout(`
    <h2 style="color: #E8E8E8; font-size: 18px;">Bienvenue chez ${BRAND} !</h2>
    <p style="color: #999;">Bonjour ${esc(name)},</p>
    <p style="color: #999;">
      Votre compte a été créé avec succès. Vous pouvez maintenant :
    </p>
    <ul style="color: #999;">
      <li>Passer commande et suivre vos livraisons</li>
      <li>Déposer un ticket réparation et suivre l'avancement</li>
      <li>Cumuler des points de fidélité</li>
    </ul>
    <p>
      <a href="${BASE_URL}/produits" style="display: inline-block; background: #00FFD1; color: #0A0A0A; padding: 14px 28px; text-decoration: none; font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">
        VOIR LE CATALOGUE
      </a>
    </p>
  `);

  return {
    subject: `Bienvenue chez ${BRAND} !`,
    html,
  };
}
