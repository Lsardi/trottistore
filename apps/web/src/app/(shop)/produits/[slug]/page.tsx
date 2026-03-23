"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  ShoppingCart,
  Heart,
  BarChart2,
  Minus,
  Plus,
  ImageOff,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { productsApi, cartApi, type Product } from "@/lib/api";
import { formatPriceTTC, priceTTC } from "@/lib/utils";
import ProductCard from "@/components/ProductCard";

function formatHT(priceHt: string): string {
  const num = parseFloat(priceHt);
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export default function ProductPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [cartSuccess, setCartSuccess] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await productsApi.getBySlug(slug);
        setProduct(res.data);

        // Load related products from same category
        if (res.data.categories?.[0]?.category?.slug) {
          try {
            const relRes = await productsApi.list({
              categorySlug: res.data.categories[0].category.slug,
              limit: 8,
            });
            setRelatedProducts(
              relRes.data.filter((p) => p.id !== res.data.id).slice(0, 4)
            );
          } catch {
            // not critical
          }
        }
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
        quantity,
      });
      setCartSuccess(true);
      setCartMessage("Produit ajouté au panier !");
      setTimeout(() => {
        setCartMessage("");
        setCartSuccess(false);
      }, 3000);
    } catch {
      setCartMessage("Erreur lors de l'ajout au panier");
      setTimeout(() => setCartMessage(""), 3000);
    } finally {
      setAddingToCart(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-64 mb-8" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="aspect-square bg-gray-100 rounded-lg" />
              <div className="space-y-4 py-4">
                <div className="h-3 bg-gray-100 rounded w-24" />
                <div className="h-8 bg-gray-100 rounded w-full" />
                <div className="h-8 bg-gray-100 rounded w-2/3" />
                <div className="h-10 bg-gray-100 rounded w-40 mt-4" />
                <div className="h-4 bg-gray-100 rounded w-32 mt-2" />
                <div className="h-12 bg-gray-100 rounded-full w-full mt-8" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ──
  if (!product) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Produit introuvable
          </h1>
          <Link
            href="/produits"
            className="text-[#28afb1] hover:text-[#1f8e90] font-medium inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au catalogue
          </Link>
        </div>
      </div>
    );
  }

  const variant = product.variants?.[0];
  const inStock = variant ? variant.stockQuantity > 0 : true;
  const images = product.images?.length ? product.images : [];
  const hasSalePrice =
    !!product.salePriceHt &&
    parseFloat(product.salePriceHt) < parseFloat(product.priceHt);

  const displayPriceHt = hasSalePrice ? product.salePriceHt! : product.priceHt;
  const ttcFormatted = formatPriceTTC(displayPriceHt, product.tvaRate);
  const ttcNum = priceTTC(displayPriceHt, product.tvaRate);

  const categoryName = product.categories?.[0]?.category?.name;
  const categorySlug = product.categories?.[0]?.category?.slug;

  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* ── Breadcrumb ── */}
        <nav className="flex items-center text-sm text-gray-500 mb-6 md:mb-8">
          <Link href="/" className="hover:text-[#28afb1] transition-colors">
            Accueil
          </Link>
          <ChevronRight className="w-4 h-4 mx-1.5 text-gray-400 flex-shrink-0" />
          <Link
            href="/produits"
            className="hover:text-[#28afb1] transition-colors"
          >
            Catalogue
          </Link>
          {categoryName && categorySlug && (
            <>
              <ChevronRight className="w-4 h-4 mx-1.5 text-gray-400 flex-shrink-0" />
              <Link
                href={`/produits?categorySlug=${categorySlug}`}
                className="hover:text-[#28afb1] transition-colors"
              >
                {categoryName}
              </Link>
            </>
          )}
          <ChevronRight className="w-4 h-4 mx-1.5 text-gray-400 flex-shrink-0" />
          <span className="text-gray-900 font-medium truncate">
            {product.name}
          </span>
        </nav>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-8 lg:gap-12">
          {/* LEFT: Image gallery */}
          <div>
            {/* Main image */}
            <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
              <div className="aspect-square flex items-center justify-center p-4 md:p-8">
                {images[selectedImage] ? (
                  <img
                    src={images[selectedImage].url}
                    alt={images[selectedImage].alt || product.name}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <ImageOff className="w-20 h-20 text-gray-300" />
                )}
              </div>
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 mt-3">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded border-2 overflow-hidden flex-shrink-0 bg-white transition-colors ${
                      i === selectedImage
                        ? "border-[#28afb1]"
                        : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="w-full h-full object-contain p-1"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Product info */}
          <div className="py-2">
            {/* Brand */}
            {product.brand && (
              <p className="text-sm font-medium text-[#28afb1] mb-2">
                {product.brand.name}
              </p>
            )}

            {/* Title */}
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight mb-4">
              {product.name}
            </h1>

            {/* Price */}
            <div className="mb-4">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl md:text-3xl font-bold text-gray-900">
                  {ttcFormatted}
                </span>
                {hasSalePrice && (
                  <span className="text-base text-gray-400 line-through">
                    {formatPriceTTC(product.priceHt, product.tvaRate)}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {formatHT(displayPriceHt)} &euro; HT
              </p>
              {ttcNum >= 300 && (
                <p className="text-sm text-[#28afb1] font-medium mt-2">
                  Payez en 3x{" "}
                  {new Intl.NumberFormat("fr-FR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(ttcNum / 3)}{" "}
                  &euro; sans frais
                </p>
              )}
            </div>

            {/* Stock */}
            <div className="flex items-center gap-2 mb-3">
              {inStock ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-green-700">
                    En stock
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-red-600">
                    Rupture de stock
                  </span>
                </>
              )}
            </div>

            {/* SKU */}
            {product.sku && (
              <p className="text-xs text-gray-400 mb-6">
                Réf : {product.sku}
              </p>
            )}

            {/* Separator */}
            <hr className="border-gray-100 mb-6" />

            {/* Quantity + Add to cart */}
            {inStock && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Quantité
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
                      aria-label="Diminuer la quantité"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val >= 1) setQuantity(val);
                      }}
                      min={1}
                      className="w-12 h-10 text-center text-sm font-medium border-x border-gray-200 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
                      aria-label="Augmenter la quantité"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add to cart button + icons */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleAddToCart}
                disabled={!inStock || addingToCart}
                className="btn-primary flex-1 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cartSuccess ? (
                  "Ajouté au panier !"
                ) : addingToCart ? (
                  "Ajout en cours..."
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    AJOUTER AU PANIER
                  </>
                )}
              </button>
              <button
                className="w-11 h-11 flex items-center justify-center border border-gray-200 rounded-full text-gray-400 hover:text-[#28afb1] hover:border-[#28afb1] transition-colors"
                title="Ajouter aux favoris"
              >
                <Heart className="w-5 h-5" />
              </button>
              <button
                className="w-11 h-11 flex items-center justify-center border border-gray-200 rounded-full text-gray-400 hover:text-[#28afb1] hover:border-[#28afb1] transition-colors"
                title="Comparer"
              >
                <BarChart2 className="w-5 h-5" />
              </button>
            </div>

            {/* Cart message */}
            {cartMessage && (
              <p
                className={`text-sm font-medium mb-4 ${
                  cartSuccess ? "text-green-600" : "text-red-600"
                }`}
              >
                {cartMessage}
              </p>
            )}

            {/* Category / weight info */}
            <div className="border-t border-gray-100 pt-4 mt-2 space-y-1.5">
              {categoryName && (
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">
                    Catégorie :
                  </span>{" "}
                  {categoryName}
                </p>
              )}
              {product.weightGrams && (
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">Poids :</span>{" "}
                  {(product.weightGrams / 1000).toFixed(1)} kg
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Description ── */}
        {(product.shortDescription || product.description) && (
          <div className="mt-12 md:mt-16 border-t border-gray-100 pt-10">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
              Description
            </h2>

            {product.shortDescription && (
              <div
                className="text-gray-700 text-base leading-relaxed prose prose-sm max-w-none mb-6
                  prose-headings:text-gray-900 prose-strong:text-gray-900 prose-a:text-[#28afb1]
                  prose-p:text-gray-700 prose-li:text-gray-700"
                dangerouslySetInnerHTML={{ __html: product.shortDescription }}
              />
            )}

            {product.description &&
              product.description !== product.shortDescription && (
                <div
                  className="text-gray-600 text-sm leading-relaxed prose prose-sm max-w-none
                    prose-headings:text-gray-800 prose-strong:text-gray-800 prose-a:text-[#28afb1]
                    prose-p:text-gray-600 prose-li:text-gray-600"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              )}
          </div>
        )}

        {/* ── Related products ── */}
        {relatedProducts.length > 0 && (
          <div className="mt-12 md:mt-16 border-t border-gray-100 pt-10">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
              Produits similaires
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {relatedProducts.map((rp) => (
                <ProductCard key={rp.id} product={rp} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
