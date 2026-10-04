import type { FastifyInstance } from "fastify";

/**
 * Notify customers who asked to be told when a product is back in stock.
 * Fire-and-forget: callers invoke it after a stock increase and never await
 * it on the request path. Each alert is marked NOTIFIED once mailed.
 */
export function notifyBackInStock(app: FastifyInstance, variantId: string): void {
  void (async () => {
    try {
      const variant = await app.prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { productId: true, name: true, product: { select: { name: true, slug: true } } },
      });
      if (!variant) return;

      const alerts = await app.prisma.stockAlert.findMany({
        where: { productId: variant.productId, status: "ACTIVE", notifiedAt: null },
        take: 100,
      });
      if (alerts.length === 0) return;

      const { sendEmail } = await import("@trottistore/shared/notifications");
      const baseUrl = process.env.BASE_URL || "http://localhost:3000";
      const productName = variant.product?.name || "Produit";
      const productUrl = `${baseUrl}/produits/${variant.product?.slug || ""}`;

      for (const alert of alerts) {
        try {
          await sendEmail(
            alert.email,
            `${productName} est de retour en stock !`,
            `<p>Bonjour,</p>
             <p>Le produit <strong>${productName}</strong>${variant.name ? ` (${variant.name})` : ""} que vous attendiez est de retour en stock !</p>
             <p><a href="${productUrl}">Voir le produit</a></p>
             <p>L'équipe TrottiStore</p>`,
          );
          await app.prisma.stockAlert.update({
            where: { id: alert.id },
            data: { notifiedAt: new Date(), status: "NOTIFIED" },
          });
        } catch (err) {
          app.log.error({ err, alertId: alert.id }, "Failed to send stock alert notification");
        }
      }
    } catch (err) {
      app.log.error({ err }, "Stock alert notification batch failed");
    }
  })();
}
