"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, Check, Zap, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { productsApi, type Product } from "@/lib/api";

const SCOOTER_BRANDS = [
  { name: "Dualtron", models: ["Thunder 2", "Mini", "Victor", "Storm", "Eagle Pro", "Spider 2", "Compact", "Ultra 2"] },
  { name: "Xiaomi", models: ["M365", "M365 Pro", "Pro 2", "Essential", "Mi 4", "Mi 4 Pro"] },
  { name: "Ninebot", models: ["Max G30", "Max G30LP", "Max G2", "E2", "F2", "F2 Plus", "F2 Pro"] },
  { name: "Kaabo", models: ["Mantis 10", "Mantis King GT", "Wolf Warrior 11", "Wolf King GT Pro"] },
  { name: "Segway", models: ["Ninebot P65", "Ninebot P100S", "Ninebot GT2"] },
  { name: "Vsett", models: ["8", "9+", "10+", "11+"] },
  { name: "Inokim", models: ["OX", "OXO", "Quick 4", "Light 2"] },
  { name: "Minimotors", models: ["Speedway 5", "Speedway Leger", "Dualtron"] },
] as const;

type Step = "brand" | "model" | "results";

export default function CompatibilitePage() {
  const [step, setStep] = useState<Step>("brand");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchBrand, setSearchBrand] = useState("");

  const currentBrand = SCOOTER_BRANDS.find((b) => b.name === selectedBrand);
  const filteredBrands = searchBrand
    ? SCOOTER_BRANDS.filter((b) => b.name.toLowerCase().includes(searchBrand.toLowerCase()))
    : SCOOTER_BRANDS;

  async function handleSelectModel(model: string) {
    setSelectedModel(model);
    setStep("results");
    setLoading(true);
    try {
      const res = await productsApi.list({
        search: `${selectedBrand} ${model}`,
        limit: 50,
      });
      setProducts(res.data || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("brand");
    setSelectedBrand("");
    setSelectedModel("");
    setProducts([]);
  }

  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 text-sm font-medium px-4 py-2 rounded-full mb-4">
            <Filter className="w-4 h-4" />
            Outil exclusif TrottiStore
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-3">
            Trouvez vos pi&egrave;ces compatibles
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            S&eacute;lectionnez votre trottinette et on vous montre uniquement les pi&egrave;ces qui marchent avec.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {[
            { id: "brand", label: "Marque" },
            { id: "model", label: "Mod\u00e8le" },
            { id: "results", label: "Pi\u00e8ces" },
          ].map((s, i) => (
            <div key={s.id} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all",
                  step === s.id
                    ? "bg-teal-500 text-white shadow-lg shadow-teal-500/30"
                    : (step === "model" && s.id === "brand") || (step === "results" && s.id !== "results")
                      ? "bg-teal-100 text-teal-700"
                      : "bg-gray-200 text-gray-500"
                )}
              >
                {(step === "model" && s.id === "brand") || (step === "results" && s.id !== "results")
                  ? <Check className="w-4 h-4" />
                  : i + 1}
              </div>
              <span className={cn("text-sm font-medium", step === s.id ? "text-teal-700" : "text-gray-400")}>
                {s.label}
              </span>
              {i < 2 && <ChevronRight className="w-4 h-4 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* Step: Brand */}
        {step === "brand" && (
          <div>
            <div className="relative max-w-sm mx-auto mb-8">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher une marque..."
                value={searchBrand}
                onChange={(e) => setSearchBrand(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {filteredBrands.map((brand) => (
                <button
                  key={brand.name}
                  onClick={() => { setSelectedBrand(brand.name); setStep("model"); }}
                  className="bg-white rounded-2xl p-6 text-center border-2 border-transparent hover:border-teal-500 shadow-sm hover:shadow-lg transition-all group"
                >
                  <div className="w-14 h-14 mx-auto bg-gray-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-teal-50 transition-colors">
                    <Zap className="w-7 h-7 text-gray-400 group-hover:text-teal-500 transition-colors" />
                  </div>
                  <p className="font-semibold text-gray-900">{brand.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{brand.models.length} mod&egrave;les</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Model */}
        {step === "model" && currentBrand && (
          <div>
            <button onClick={() => setStep("brand")} className="text-sm text-teal-600 hover:underline mb-6 flex items-center gap-1">
              &larr; Changer de marque
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {selectedBrand}
            </h2>
            <p className="text-gray-500 mb-6">S&eacute;lectionnez votre mod&egrave;le</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {currentBrand.models.map((model) => (
                <button
                  key={model}
                  onClick={() => handleSelectModel(model)}
                  className="bg-white rounded-xl p-4 text-left border-2 border-transparent hover:border-teal-500 shadow-sm hover:shadow-md transition-all group"
                >
                  <p className="font-medium text-gray-900 group-hover:text-teal-600 transition-colors">
                    {model}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{selectedBrand} {model}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Results */}
        {step === "results" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <button onClick={reset} className="text-sm text-teal-600 hover:underline mb-2 flex items-center gap-1">
                  &larr; Nouvelle recherche
                </button>
                <h2 className="text-2xl font-bold text-gray-900">
                  Pi&egrave;ces pour {selectedBrand} {selectedModel}
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  {loading ? "Recherche..." : `${products.length} pi\u00e8ce${products.length !== 1 ? "s" : ""} trouv\u00e9e${products.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl animate-pulse aspect-[3/4]" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-600 mb-2">
                  Pas de r&eacute;sultats sp&eacute;cifiques
                </p>
                <p className="text-gray-400 text-sm mb-6">
                  Parcourez notre catalogue complet pour trouver vos pi&egrave;ces
                </p>
                <Link
                  href="/produits"
                  className="inline-flex items-center gap-2 bg-teal-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-teal-600 transition"
                >
                  Voir tout le catalogue
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {products.map((product) => {
                  const image = product.images?.find((img) => img.isPrimary) || product.images?.[0];
                  const priceTTC = parseFloat(product.priceHt) * (1 + parseFloat(product.tvaRate) / 100);

                  return (
                    <Link
                      key={product.id}
                      href={`/produits/${product.slug}`}
                      className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all group"
                    >
                      <div className="aspect-square bg-gray-50 overflow-hidden">
                        {image && (
                          <img src={image.url} alt={product.name} className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform" loading="lazy" />
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-teal-600 font-medium mb-1">Compatible {selectedBrand} {selectedModel}</p>
                        <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">{product.name}</p>
                        <p className="font-bold text-gray-900">{priceTTC.toFixed(2)} &euro;</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
