import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export function computeShippingCents(shippingMethod: string, subtotalHt: Decimal): number {
  return shippingMethod === "STORE_PICKUP" || subtotalHt.gte(100) ? 0 : 690;
}

/** Revalidate and claim the code inside the order transaction; rollback releases the claim. */
export async function claimDiscount(tx: Prisma.TransactionClient, code: string | undefined, subtotalHt: Decimal): Promise<Decimal> {
  if (!code) return new Decimal(0);
  const invalid = () => Object.assign(new Error("Code invalide, expiré ou épuisé"), { statusCode: 400, code: "INVALID_DISCOUNT" });
  const record = await tx.discountCode.findUnique({ where: { code: code.toUpperCase() } });
  const now = new Date();
  if (!record || !record.isActive || (record.startsAt && record.startsAt > now)
    || (record.expiresAt && record.expiresAt <= now)
    || (record.minCartHt && subtotalHt.lt(record.minCartHt))) throw invalid();
  const claimed = await tx.discountCode.updateMany({
    where: { id: record.id, isActive: true, value: record.value, kind: record.kind,
      minCartHt: record.minCartHt, startsAt: record.startsAt, expiresAt: record.expiresAt,
      maxUses: record.maxUses, ...(record.maxUses !== null ? { usedCount: { lt: record.maxUses } } : {}) },
    data: { usedCount: { increment: 1 } },
  });
  if (claimed.count !== 1) throw invalid();
  const amount = record.kind === "PERCENT" ? subtotalHt.mul(record.value).div(100) : new Decimal(record.value);
  return Decimal.min(subtotalHt, amount).toDecimalPlaces(2);
}
