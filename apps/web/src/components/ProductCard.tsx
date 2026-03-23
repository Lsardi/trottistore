import Link from "next/link";
import { ImageOff } from "lucide-react";
import type { Product } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatPrice(priceHt: string, tvaRate: string): string {
  const ht = parseFloat(priceHt);
  const tva = parseFloat(tvaRate);
  const ttc = ht * (1 + tva / 100);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(ttc);
}

export default function ProductCard({ product }: { product: Product }) {
  const primaryImage = product.images?.find((img) => img.isPrimary) || product.images?.[0];
  const defaultVariant = product.variants?.[0];
  const inStock = defaultVariant ? defaultVariant.stockQuantity > 0 : true;
  const lowStock = inStock && defaultVariant && defaultVariant.stockQuantity <= 5;
  const priceTTC =
    parseFloat(product.priceHt) * (1 + parseFloat(product.tvaRate) / 100);

  return (
    <Link
      href={`/produits/${product.slug}`}
      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300"
    >
      {/* Image */}
      <div className="aspect-square bg-gray-50 relative overflow-hidden">
        {primaryImage ? (
          <img
            src={primaryImage.url}
            alt={primaryImage.alt || product.name}
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <ImageOff className="w-12 h-12" />
          </div>
        )}

        {/* Stock badge */}
        {!inStock && (
          <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-sm">
            Rupture
          </span>
        )}
        {lowStock && (
          <span className="absolute top-3 right-3 bg-orange-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-sm">
            Plus que {defaultVariant.stockQuantity}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        {/* Category */}
        {product.categories?.[0] && (
          <p className="text-xs font-medium text-teal-600 mb-1.5 uppercase tracking-wide">
            {product.categories[0].category?.name || ""}
          </p>
        )}

        {/* Name */}
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-3 group-hover:text-teal-600 transition-colors leading-snug">
          {product.name}
        </h3>

        {/* Price */}
        <div>
          <p className="text-lg font-bold text-gray-900">
            {formatPrice(product.priceHt, product.tvaRate)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {parseFloat(product.priceHt).toFixed(2)} &euro; HT
          </p>
          {priceTTC >= 300 && (
            <p className="text-xs text-teal-600 font-medium mt-1.5">
              ou 3x {(priceTTC / 3).toFixed(2)} &euro; sans frais
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
