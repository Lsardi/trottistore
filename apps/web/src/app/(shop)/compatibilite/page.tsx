"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ChevronRight, Check, Zap, Bike } from "lucide-react";
import { cn } from "@/lib/utils";
import { productsApi, type Product } from "@/lib/api";
import { addScooterToGarage, getGarageScooters } from "@/lib/garage";

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
  const [savedToGarage, setSavedToGarage] = useState(false);

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
    <div className="min-h-[80vh]">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="heading-lg mb-3">COMPATIBILITE PIECES</h1>
          <p className="font-mono text-sm text-text-muted max-w-xl mx-auto">
            Selectionnez votre trottinette et on vous montre uniquement les pieces qui marchent avec.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {[
            { id: "brand", label: "Marque" },
            { id: "model", label: "Modele" },
            { id: "results", label: "Pieces" },
          ].map((s, i) => (
            <div key={s.id} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center text-sm font-mono font-bold transition-all border",
                  step === s.id
                    ? "bg-neon text-void border-neon"
                    : (step === "model" && s.id === "brand") || (step === "results" && s.id !== "results")
                      ? "bg-neon-dim text-neon border-neon/30"
                      : "bg-surface border-border text-text-dim"
                )}
              >
                {(step === "model" && s.id === "brand") || (step === "results" && s.id !== "results")
                  ? <Check className="w-4 h-4" />
                  : i + 1}
              </div>
              <span className={cn("font-mono text-xs uppercase tracking-wider", step === s.id ? "text-neon" : "text-text-dim")}>
                {s.label}
              </span>
              {i < 2 && <span className="font-mono text-text-dim">&mdash;</span>}
            </div>
          ))}
        </div>

        {/* Step: Brand */}
        {step === "brand" && (
          <div>
            <div className="relative max-w-sm mx-auto mb-8">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-dim" />
              <input
                type="text"
                placeholder="Rechercher une marque..."
                value={searchBrand}
                onChange={(e) => setSearchBrand(e.target.value)}
                className="input-dark w-full pl-11"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {filteredBrands.map((brand) => (
                <button
                  key={brand.name}
                  onClick={() => { setSelectedBrand(brand.name); setStep("model"); }}
                  className="bg-surface-2 p-6 text-center border border-border hover:border-neon transition-all group"
                >
                  <div className="w-14 h-14 mx-auto bg-void border border-border flex items-center justify-center mb-3 group-hover:border-neon transition-colors">
                    <Zap className="w-7 h-7 text-text-dim group-hover:text-neon transition-colors" />
                  </div>
                  <p className="font-display font-bold text-text">{brand.name}</p>
                  <p className="font-mono text-xs text-text-dim mt-1">{brand.models.length} modeles</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Model */}
        {step === "model" && currentBrand && (
          <div>
            <button onClick={() => setStep("brand")} className="font-mono text-sm text-neon hover:underline mb-6 flex items-center gap-1">
              &larr; Changer de marque
            </button>
            <h2 className="heading-md text-text mb-2">
              {selectedBrand}
            </h2>
            <p className="font-mono text-sm text-text-muted mb-6">Selectionnez votre modele</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {currentBrand.models.map((model) => (
                <button
                  key={model}
                  onClick={() => handleSelectModel(model)}
                  className="bg-surface-2 p-4 text-left border border-border hover:border-neon transition-all group"
                >
                  <p className="font-mono text-sm font-bold text-text group-hover:text-neon transition-colors">
                    {model}
                  </p>
                  <p className="font-mono text-xs text-text-dim mt-1">{selectedBrand} {model}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Results */}
        {step === "results" && (
          <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div>
                <button onClick={reset} className="font-mono text-sm text-neon hover:underline mb-2 flex items-center gap-1">
                  &larr; Nouvelle recherche
                </button>
                <h2 className="heading-md text-text">
                  Pieces pour {selectedBrand} {selectedModel}
                </h2>
                <p className="font-mono text-xs text-text-muted mt-1">
                  {loading ? "Recherche..." : `${products.length} piece${products.length !== 1 ? "s" : ""} trouvee${products.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              {!savedToGarage && !getGarageScooters().some(
                (s) => s.brand.toLowerCase() === selectedBrand.toLowerCase() && s.model.toLowerCase() === selectedModel.toLowerCase()
              ) ? (
                <button
                  onClick={() => {
                    addScooterToGarage(selectedBrand, selectedModel);
                    setSavedToGarage(true);
                  }}
                  className="btn-outline text-xs flex items-center gap-2"
                >
                  <Bike className="w-4 h-4" />
                  SAUVEGARDER DANS MON GARAGE
                </button>
              ) : (
                <span className="font-mono text-xs text-neon flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Dans votre garage
                </span>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-surface border border-border aspect-[3/4]" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16 bg-surface border border-border">
                <Search className="w-12 h-12 text-text-dim mx-auto mb-4" />
                <p className="heading-md text-text-muted mb-2">
                  Pas de resultats specifiques
                </p>
                <p className="font-mono text-xs text-text-dim mb-6">
                  Parcourez notre catalogue complet pour trouver vos pieces
                </p>
                <Link
                  href="/produits"
                  className="btn-neon"
                >
                  VOIR TOUT LE CATALOGUE
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
                      className="product-card group"
                    >
                      <div className="product-card-image">
                        {image && (
                          <Image src={image.url} alt={product.name} fill sizes="(max-width: 768px) 50vw, 33vw" style={{ objectFit: "contain", padding: "8px" }} />
                        )}
                      </div>
                      <div className="product-card-body">
                        <p className="font-mono text-xs text-neon mb-1">Compatible {selectedBrand} {selectedModel}</p>
                        <p className="text-sm font-medium text-text line-clamp-2 mb-2">{product.name}</p>
                        <p className="font-mono font-bold text-neon">{priceTTC.toFixed(2)} &euro;</p>
                      </div>
                      <div className="product-card-neon-line" />
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
