/**
 * Email templates for ecommerce transactional emails.
 */

const BRAND = "TrottiStore";
const BASE_URL = process.env.BASE_URL || "https://trottistore.fr";

function layout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border: 1px solid #e0e0e0; padding: 32px;">
    <div style="font-size: 20px; font-weight: bold; margin-bottom: 24px; color: #111;">
      ${BRAND}
    </div>
    ${content}
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;">
    <p style="font-size: 12px; color: #888;">
      ${BRAND} — 18 bis Rue Méchin, 93450 L'Île-Saint-Denis<br>
      <a href="${BASE_URL}" style="color: #888;">trottistore.fr</a>
    </p>
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
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${i.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${i.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${i.unitPrice} €</td>
        </tr>`
    )
    .join("");

  const html = layout(`
    <h2 style="color: #111; font-size: 18px;">Merci pour votre commande !</h2>
    <p style="color: #555;">Bonjour ${data.customerName},</p>
    <p style="color: #555;">
      Votre commande <strong>#${data.orderNumber}</strong> a bien été enregistrée.
    </p>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr style="background: #f9f9f9;">
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
      <p style="color: #555; margin: 4px 0;">Sous-total HT : <strong>${data.subtotalHt} €</strong></p>
      <p style="color: #555; margin: 4px 0;">Livraison : <strong>${data.shippingCost} €</strong></p>
      <p style="color: #111; margin: 4px 0; font-size: 16px;">Total TTC : <strong>${data.totalTtc} €</strong></p>
    </div>

    <div style="background: #f9f9f9; padding: 16px; margin: 16px 0;">
      <p style="color: #555; margin: 4px 0;"><strong>Paiement :</strong> ${data.paymentMethod}</p>
      <p style="color: #555; margin: 4px 0;"><strong>Livraison :</strong> ${data.shippingAddress}</p>
    </div>

    <p style="color: #555;">
      Vous pouvez suivre votre commande depuis votre
      <a href="${BASE_URL}/mon-compte" style="color: #00CCa8;">espace client</a>.
    </p>
  `);

  return {
    subject: `Confirmation de commande #${data.orderNumber} — ${BRAND}`,
    html,
  };
}

export function welcomeEmail(name: string): { subject: string; html: string } {
  const html = layout(`
    <h2 style="color: #111; font-size: 18px;">Bienvenue chez ${BRAND} !</h2>
    <p style="color: #555;">Bonjour ${name},</p>
    <p style="color: #555;">
      Votre compte a été créé avec succès. Vous pouvez maintenant :
    </p>
    <ul style="color: #555;">
      <li>Passer commande et suivre vos livraisons</li>
      <li>Déposer un ticket réparation et suivre l'avancement</li>
      <li>Cumuler des points de fidélité</li>
    </ul>
    <p>
      <a href="${BASE_URL}/produits" style="display: inline-block; background: #00CCa8; color: #111; padding: 12px 24px; text-decoration: none; font-weight: bold;">
        VOIR LE CATALOGUE
      </a>
    </p>
  `);

  return {
    subject: `Bienvenue chez ${BRAND} !`,
    html,
  };
}
