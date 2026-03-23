/**
 * Customer health score and RFM scoring utilities.
 *
 * Health score is a composite 0-100 metric based on:
 *   - Recency  (max 40 pts): how recently the customer ordered
 *   - Frequency (max 30 pts): how many orders they placed
 *   - Monetary  (max 30 pts): how much they spent in total
 */

export interface ProfileInput {
  lastOrderAt: Date | string | null;
  totalOrders: number;
  /** Accepts Prisma Decimal (has .toNumber()) or plain number */
  totalSpent: number | { toNumber(): number };
}

export interface RFMScores {
  recency: number;
  frequency: number;
  monetary: number;
}

function toNumber(value: number | { toNumber(): number }): number {
  if (typeof value === "number") return value;
  return value.toNumber();
}

/**
 * Recency score (0-40).
 * Days since last order:
 *   0-30   -> 40
 *   31-90  -> 25
 *   91-180 -> 10
 *   180+   -> 0
 *   null (never ordered) -> 0
 */
function recencyScore(lastOrderAt: Date | string | null): number {
  if (!lastOrderAt) return 0;
  const last = typeof lastOrderAt === "string" ? new Date(lastOrderAt) : lastOrderAt;
  const daysSince = Math.floor(
    (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysSince <= 30) return 40;
  if (daysSince <= 90) return 25;
  if (daysSince <= 180) return 10;
  return 0;
}

/**
 * Frequency score (0-30).
 * Total orders:
 *   0     -> 0
 *   1     -> 10
 *   2-5   -> 20
 *   6-10  -> 25
 *   10+   -> 30
 */
function frequencyScore(totalOrders: number): number {
  if (totalOrders <= 0) return 0;
  if (totalOrders === 1) return 10;
  if (totalOrders <= 5) return 20;
  if (totalOrders <= 10) return 25;
  return 30;
}

/**
 * Monetary score (0-30).
 * Total spent (EUR):
 *   0-100     -> 5
 *   100-500   -> 15
 *   500-1000  -> 20
 *   1000+     -> 30
 */
function monetaryScore(totalSpent: number): number {
  if (totalSpent <= 0) return 0;
  if (totalSpent < 100) return 5;
  if (totalSpent < 500) return 15;
  if (totalSpent < 1000) return 20;
  return 30;
}

/**
 * Calculate the individual R, F, M component scores.
 */
export function calculateRFM(profile: ProfileInput): RFMScores {
  return {
    recency: recencyScore(profile.lastOrderAt),
    frequency: frequencyScore(profile.totalOrders),
    monetary: monetaryScore(toNumber(profile.totalSpent)),
  };
}

/**
 * Calculate a composite health score (0-100) for a customer profile.
 */
export function calculateHealthScore(profile: ProfileInput): number {
  const rfm = calculateRFM(profile);
  return rfm.recency + rfm.frequency + rfm.monetary;
}
