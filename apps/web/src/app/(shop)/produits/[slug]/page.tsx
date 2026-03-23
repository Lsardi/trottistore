"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Check,
  X,
  ShoppingCart,
  Loader2,
  ImageOff,
  AlertCircle,
} from "lucide-react";
import { productsApi, cartApi, type Product } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatPriceTTC(priceHt: string, tvaRate: string): string {
  const ht = parseFloat(priceHt);
  const tva = parseFloat(tvaRate);
  const ttc = ht * (1 + tva / 100);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(ttc);
}

export default function ProductPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await productsApi.getBySlug(slug);
        setProduct(res.data);
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  async function handleAddToCart() {
    if (!product) return;
    setAddingToCart(true);
    try {
      await cartApi.addItem({
        productId: product.id,
        variantId: product.variants?.[0]?.id,
        quantity: 1,
      });
      setCartMessage("Ajoute au panier !");
      setTimeout(() => setCartMessage(""), 3000);
    } catch {
      setCartMessage("Erreur lors de l'ajout");
    } finally {
      setAddingToCart(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
          <div className="space-y-4">
            <div className="aspect-square bg-gray-100 rounded-2xl" />
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-20 h-20 bg-gray-100 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="space-y-4 py-4">
            <div className="h-4 bg-gray-100 rounded w-24" />
            <div className="h-8 bg-gray-100 rounded w-3/4" />
            <div className="h-8 bg-gray-100 rounded w-1/3" />
            <div className="h-12 bg-gray-100 rounded w-full mt-6" />
            <div className="h-40 bg-gray-100 rounded mt-8" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 text-center">
        <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Produit introuvable</h1>
        <Link href="/produits" className="text-teal-600 hover:text-teal-700 font-medium">
          &larr; Retour au catalogue
        </Link>
      </div>
    );
  }

  const variant = product.variants?.[0];
  const inStock = variant ? variant.stockQuantity > 0 : true;
  const images = product.images?.length ? product.images : [];
  const priceTTC = formatPriceTTC(product.priceHt, product.tvaRate);
  const priceNum = parseFloat(product.priceHt) * (1 + parseFloat(product.tvaRate) / 100);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm text-gray-400 mb-8 overflow-x-auto">
        <Link href="/produits" className="hover:text-teal-600 transition-colors whitespace-nowrap">
          Catalogue
        </Link>
        {product.categories?.[0] && (
          <>
            <ChevronRight className="w-4 h-4 mx-1.5 flex-shrink-0" />
            <span className="whitespace-nowrap">{product.categories[0].category?.name}</span>
          </>
        )}
        <ChevronRight className="w-4 h-4 mx-1.5 flex-shrink-0" />
        <span className="text-gray-700 font-medium truncate">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
        {/* Images */}
        <div className="space-y-4">
          <div className="aspect-square bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
            {images[selectedImage] ? (
              <img
                src={images[selectedImage].url}
                alt={images[selectedImage].alt || product.name}
                className="w-full h-full object-contain p-4"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <ImageOff className="w-20 h-20" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(i)}
                  className={cn(
                    "w-20 h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 bg-gray-50 transition-all",
                    i === selectedImage
                      ? "border-teal-500 ring-2 ring-teal-500/20"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <img src={img.url} alt="" className="w-full h-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="py-2">
          {product.brand && (
            <p className="text-sm text-teal-600 font-semibold mb-2 uppercase tracking-wide">
              {product.brand.name}
            </p>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 leading-tight">
            {product.name}
          </h1>

          {/* Price */}
          <div className="mb-6 pb-6 border-b border-gray-100">
            <p className="text-3xl md:text-4xl font-bold text-gray-900">{priceTTC}</p>
            <p className="text-sm text-gray-400 mt-1">
              {parseFloat(product.priceHt).toFixed(2)} &euro; HT
            </p>
            {priceNum >= 300 && (
              <p className="text-sm text-teal-600 mt-2 font-medium flex items-center gap-1">
                ou {(priceNum / 3).toFixed(2)} &euro;/mois en 3x sans frais
              </p>
            )}
          </div>

          {/* Stock */}
          <div className="mb-6">
            {inStock ? (
              <span className="inline-flex items-center gap-1.5 text-green-700 bg-green-50 px-3 py-1.5 rounded-full text-sm font-medium">
                <Check className="w-4 h-4" />
                En stock
                {variant && variant.stockQuantity <= 5 && (
                  <span className="text-orange-600 ml-1">
                    &mdash; Plus que {variant.stockQuantity}
                  </span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-red-700 bg-red-50 px-3 py-1.5 rounded-full text-sm font-medium">
                <X className="w-4 h-4" />
                Rupture de stock
              </span>
            )}
          </div>

          {/* SKU */}
          <p className="text-xs text-gray-400 mb-6">Ref : {product.sku}</p>

          {/* Add to cart */}
          <button
            onClick={handleAddToCart}
            disabled={!inStock || addingToCart}
            className="w-full bg-teal-500 text-white py-4 rounded-xl font-semibold text-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
          >
            {addingToCart ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Ajout en cours...
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5" />
                Ajouter au panier
              </>
            )}
          </button>

          {cartMessage && (
            <p
              className={cn(
                "text-sm text-center mt-3 font-medium",
                cartMessage.includes("Erreur") ? "text-red-600" : "text-green-600"
              )}
            >
              {cartMessage}
            </p>
          )}

          {/* Description */}
          {product.shortDescription && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
              <div
                className="text-gray-600 text-sm leading-relaxed prose prose-sm prose-teal max-w-none"
                dangerouslySetInnerHTML={{ __html: product.shortDescription }}
              />
            </div>
          )}

          {product.description && product.description !== product.shortDescription && (
            <div className="mt-6">
              <div
                className="text-gray-600 text-sm leading-relaxed prose prose-sm prose-teal max-w-none"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
