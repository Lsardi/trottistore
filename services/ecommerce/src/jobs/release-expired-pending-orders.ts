import type { FastifyInstance } from "fastify";

/** Order creation decrements variant stock, or reserves it for installment orders.
 * Products without variants have no inventory field in the current schema.
 */
export async function releaseExpiredPendingOrders(app: FastifyInstance, olderThanMinutes = 60): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const orders = await app.prisma.order.findMany({
    where: { status: "PENDING", paymentStatus: "PENDING", createdAt: { lt: cutoff } },
    select: { id: true, paymentMethod: true },
  });
  let released = 0;
  for (const order of orders) {
    const changed = await app.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: order.id, status: "PENDING", paymentStatus: "PENDING", createdAt: { lt: cutoff } },
        data: { status: "CANCELLED" },
      });
      if (claimed.count !== 1) return false;
      const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
      for (const item of items) {
        if (!item.variantId) continue;
        await tx.productVariant.update({ where: { id: item.variantId }, data: order.paymentMethod.startsWith("INSTALLMENT_")
          ? { stockReserved: { decrement: item.quantity } }
          : { stockQuantity: { increment: item.quantity } } });
      }
      await tx.paymentInstallment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: "PENDING", toStatus: "CANCELLED", note: "Unpaid order expired" } });
      return true;
    });
    if (changed) released += 1;
  }
  return released;
}
