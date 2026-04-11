/**
 * Public scooter brands/models endpoint.
 *
 * Aggregates the distinct `productModel` strings from RepairTickets and
 * groups them by brand. Used by the storefront /compatibilite page to show
 * the actual models we have repaired (i.e. that we can support), instead of
 * the previous static curated list. The storefront merges this dynamic
 * result with its static fallback list to keep known brands always visible.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

interface BrandGroup {
  brand: string;
  models: string[];
}

/**
 * Title-case the first character of each word, lowercase the rest.
 * Preserves alphanumerics with their case for SKU-like tokens (M365, GT2)
 * by leaving any token containing a digit untouched.
 */
function normalizeToken(token: string): string {
  if (!token) return token;
  if (/\d/.test(token)) return token; // M365, GT2, P100S, etc.
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function normalizeWords(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map(normalizeToken)
    .join(" ");
}

/**
 * Parse a productModel string like "Dualtron Thunder 2" into { brand, model }.
 * Falls back to { brand: "Autres", model: input } if the input cannot be split.
 */
function parseProductModel(raw: string): { brand: string; model: string } | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { brand: normalizeToken(parts[0]), model: "" };
  }

  // Brand is the first token, model is the rest.
  const brand = normalizeToken(parts[0]);
  const model = parts.slice(1).map(normalizeToken).join(" ");
  return { brand, model };
}

export async function scooterModelsRoutes(app: FastifyInstance) {
  app.get(
    "/repairs/scooter-models",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      // Get every distinct productModel that appears on a real repair ticket.
      const rows = await app.prisma.repairTicket.findMany({
        select: { productModel: true },
        distinct: ["productModel"],
        where: { productModel: { not: "" } },
      });

      const grouped = new Map<string, Set<string>>();
      for (const row of rows) {
        const parsed = parseProductModel(row.productModel);
        if (!parsed) continue;
        const key = parsed.brand;
        if (!grouped.has(key)) grouped.set(key, new Set());
        if (parsed.model) grouped.get(key)!.add(parsed.model);
      }

      const data: BrandGroup[] = Array.from(grouped.entries())
        .map(([brand, modelsSet]) => ({
          brand,
          models: Array.from(modelsSet).sort((a, b) => a.localeCompare(b, "fr")),
        }))
        .filter((b) => b.models.length > 0)
        .sort((a, b) => a.brand.localeCompare(b.brand, "fr"));

      // Cache 5 minutes (read-mostly, free for any visitor) at the CDN edge.
      reply.header("Cache-Control", "public, max-age=300, s-maxage=300");
      return reply.send({ success: true, data });
    },
  );
}

export { parseProductModel, normalizeWords };
