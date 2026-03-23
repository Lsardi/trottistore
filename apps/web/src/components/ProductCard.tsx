import Link from "next/link";
import { ImageOff } from "lucide-react";
import type { Product } from "@/lib/api";
import { formatPriceTTC } from "@/lib/utils";

function formatHT(priceHt: string): string {
  const num = parseFloat(priceHt);
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function isNewProduct(createdAt?: string): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return created >= thirtyDaysAgo;
}

export default function ProductCard({ product }: { product: Product }) {
  const primaryImage =
    product.images?.find((img) => img.isPrimary) || product.images?.[0];
  const hasSalePrice =
    !!product.salePriceHt &&
    parseFloat(product.salePriceHt) < parseFloat(product.priceHt);
  const isNew = isNewProduct(product.createdAt);

  const displayPriceHt = hasSalePrice ? product.salePriceHt! : product.priceHt;
  const ttcFormatted = formatPriceTTC(displayPriceHt, product.tvaRate);

  const categoryName = product.categories?.[0]?.category?.name;

  return (
    <Link
      href={`/produits/${product.slug}`}
      className="product-card group flex flex-col h-full"
    >
      {/* Image */}
      <div className="product-card-image">
        {primaryImage ? (
          <img
            src={primaryImage.url}
            alt={primaryImage.alt || product.name}
            loading="lazy"
          />
        ) : (
          <span className="flex items-center justify-center w-full h-full" style={{ color: "#2A2A2A" }}>
            <ImageOff className="w-10 h-10" />
          </span>
        )}

        {/* Badges */}
        <span className="absolute top-3 left-3 flex flex-col gap-1 z-[2]">
          {hasSalePrice && (
            <span className="badge badge-danger">PROMO</span>
          )}
          {isNew && !hasSalePrice && (
            <span className="badge badge-neon">NOUVEAU</span>
          )}
        </span>
      </div>

      {/* Body */}
      <div className="product-card-body flex flex-col flex-1">
        {/* Category label */}
        {categoryName && (
          <p className="spec-label mb-1">{categoryName}</p>
        )}

        {/* Product name */}
        <h3 className="heading-md text-[#E8E8E8] leading-tight mb-3" style={{ fontSize: "0.95rem" }}>
          {product.name}
        </h3>

        {/* Price block — pushed to bottom */}
        <div className="mt-auto">
          <div className="flex items-baseline gap-2">
            <span className="price-main" style={{ fontSize: "1.25rem" }}>{ttcFormatted}</span>
            {hasSalePrice && (
              <span className="font-mono text-xs line-through" style={{ color: "#555555" }}>
                {formatPriceTTC(product.priceHt, product.tvaRate)}
              </span>
            )}
          </div>
          <p className="price-sub mt-0.5">
            {formatHT(displayPriceHt)} &euro; HT
          </p>
        </div>
      </div>

      {/* Neon line — hidden by default, appears on hover */}
      <div className="product-card-neon-line" />
    </Link>
  );
}
