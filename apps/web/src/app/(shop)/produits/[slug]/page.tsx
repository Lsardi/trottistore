"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { productsApi, cartApi, type Product } from "@/lib/api";

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
      setCartMessage("Ajouté au panier !");
      setTimeout(() => setCartMessage(""), 3000);
    } catch {
      setCartMessage("Erreur lors de l'ajout");
    } finally {
      setAddingToCart(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="aspect-square bg-gray-200 rounded-xl" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-6 bg-gray-200 rounded w-1/4" />
            <div className="h-20 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Produit introuvable</h1>
        <Link href="/produits" className="text-blue-600 hover:underline">
          ← Retour au catalogue
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
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/produits" className="hover:text-gray-900">Catalogue</Link>
        {product.categories?.[0] && (
          <>
            <span className="mx-2">›</span>
            <span>{product.categories[0].category?.name}</span>
          </>
        )}
        <span className="mx-2">›</span>
        <span className="text-gray-900">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Images */}
        <div>
          <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-4">
            {images[selectedImage] ? (
              <img
                src={images[selectedImage].url}
                alt={images[selectedImage].alt || product.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-6xl">
                🛴
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(i)}
                  className={`w-20 h-20 rounded-lg overflow-hidden border-2 flex-shrink-0 ${
                    i === selectedImage ? "border-blue-500" : "border-gray-200"
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Infos produit */}
        <div>
          {product.brand && (
            <p className="text-sm text-blue-600 font-medium mb-1">{product.brand.name}</p>
          )}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>

          {/* Prix */}
          <div className="mb-6">
            <p className="text-3xl font-bold text-gray-900">{priceTTC}</p>
            <p className="text-sm text-gray-500">{parseFloat(product.priceHt).toFixed(2)} € HT</p>
            {priceNum >= 300 && (
              <p className="text-sm text-green-600 mt-1 font-medium">
                ou {(priceNum / 3).toFixed(2)} €/mois en 3x sans frais
              </p>
            )}
          </div>

          {/* Stock */}
          <div className="mb-6">
            {inStock ? (
              <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-3 py-1 rounded-full text-sm font-medium">
                ✓ En stock
                {variant && variant.stockQuantity <= 5 && (
                  <span className="text-orange-600"> — Plus que {variant.stockQuantity}</span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center text-red-700 bg-red-50 px-3 py-1 rounded-full text-sm font-medium">
                ✕ Rupture de stock
              </span>
            )}
          </div>

          {/* SKU */}
          <p className="text-xs text-gray-400 mb-6">Réf : {product.sku}</p>

          {/* Bouton ajout panier */}
          <button
            onClick={handleAddToCart}
            disabled={!inStock || addingToCart}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed mb-3"
          >
            {addingToCart ? "Ajout en cours..." : "Ajouter au panier"}
          </button>

          {cartMessage && (
            <p className={`text-sm text-center ${cartMessage.includes("Erreur") ? "text-red-600" : "text-green-600"}`}>
              {cartMessage}
            </p>
          )}

          {/* Description */}
          {product.shortDescription && (
            <div className="mt-8 border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
              <div
                className="text-gray-600 text-sm leading-relaxed prose prose-sm"
                dangerouslySetInnerHTML={{ __html: product.shortDescription }}
              />
            </div>
          )}

          {product.description && product.description !== product.shortDescription && (
            <div className="mt-6">
              <div
                className="text-gray-600 text-sm leading-relaxed prose prose-sm"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
