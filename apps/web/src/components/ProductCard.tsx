import Link from "next/link";
import type { Product } from "@/lib/api";

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

  return (
    <Link
      href={`/produits/${product.slug}`}
      className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
    >
      {/* Image */}
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {primaryImage ? (
          <img
            src={primaryImage.url}
            alt={primaryImage.alt || product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Badge stock */}
        {!inStock && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-medium px-2 py-1 rounded">
            Rupture
          </span>
        )}
      </div>

      {/* Infos */}
      <div className="p-4">
        {/* Catégorie */}
        {product.categories?.[0] && (
          <p className="text-xs text-gray-500 mb-1">
            {product.categories[0].category?.name || ""}
          </p>
        )}

        {/* Nom */}
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
          {product.name}
        </h3>

        {/* Prix */}
        <p className="text-lg font-bold text-gray-900">
          {formatPrice(product.priceHt, product.tvaRate)}
        </p>
        <p className="text-xs text-gray-500">
          {parseFloat(product.priceHt).toFixed(2)} € HT
        </p>

        {/* Stock */}
        {inStock && defaultVariant && defaultVariant.stockQuantity <= 5 && (
          <p className="text-xs text-orange-600 mt-1">
            Plus que {defaultVariant.stockQuantity} en stock
          </p>
        )}
      </div>
    </Link>
  );
}
