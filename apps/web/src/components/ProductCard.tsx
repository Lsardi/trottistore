import Link from "next/link";
import { ImageOff, ShoppingCart, Heart, BarChart2 } from "lucide-react";
import type { Product } from "@/lib/api";
import { formatPriceTTC, priceTTC } from "@/lib/utils";

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
  const defaultVariant = product.variants?.[0];
  const inStock = defaultVariant ? defaultVariant.stockQuantity > 0 : true;
  const hasSalePrice =
    !!product.salePriceHt &&
    parseFloat(product.salePriceHt) < parseFloat(product.priceHt);
  const isNew = isNewProduct(product.createdAt);

  const displayPriceHt = hasSalePrice ? product.salePriceHt! : product.priceHt;
  const ttcFormatted = formatPriceTTC(displayPriceHt, product.tvaRate);
  const ttcNum = priceTTC(displayPriceHt, product.tvaRate);

  const categoryName = product.categories?.[0]?.category?.name;

  return (
    <a
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
          <span className="flex items-center justify-center w-full h-full text-gray-300">
            <ImageOff className="w-10 h-10" />
          </span>
        )}

        {/* Badges */}
        <span className="absolute top-2 left-2 flex flex-col gap-1">
          {hasSalePrice && (
            <span className="badge badge-promo">PROMO</span>
          )}
          {isNew && !hasSalePrice && (
            <span className="badge badge-new">NOUVEAU</span>
          )}
          {!inStock && (
            <span className="badge badge-rupture">RUPTURE</span>
          )}
        </span>
      </div>

      {/* Body */}
      <div className="product-card-body flex flex-col flex-1">
        {/* Category */}
        {categoryName && (
          <p className="product-card-category">{categoryName}</p>
        )}

        {/* Title */}
        <h3 className="product-card-title">{product.name}</h3>

        {/* Price — pushed to bottom */}
        <div className="mt-auto">
          <div className="flex items-baseline gap-2">
            <span className="product-card-price">{ttcFormatted}</span>
            {hasSalePrice && (
              <span className="text-xs text-gray-400 line-through">
                {formatPriceTTC(product.priceHt, product.tvaRate)}
              </span>
            )}
          </div>
          <p className="product-card-price-ht">
            {formatHT(displayPriceHt)} &euro; HT
          </p>
          {ttcNum >= 300 && (
            <p className="text-xs text-[#28afb1] font-medium mt-1">
              ou 3x{" "}
              {new Intl.NumberFormat("fr-FR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(ttcNum / 3)}{" "}
              &euro; sans frais
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="product-card-actions">
          <span
            className="btn-add"
            role="button"
            onClick={(e) => e.preventDefault()}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Ajouter au panier
          </span>
          <span
            className="btn-icon"
            role="button"
            onClick={(e) => e.preventDefault()}
            title="Ajouter aux favoris"
          >
            <Heart className="w-4 h-4" />
          </span>
          <span
            className="btn-icon"
            role="button"
            onClick={(e) => e.preventDefault()}
            title="Comparer"
          >
            <BarChart2 className="w-4 h-4" />
          </span>
        </div>
      </div>
    </a>
  );
}
