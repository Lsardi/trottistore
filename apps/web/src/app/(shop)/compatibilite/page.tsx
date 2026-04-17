"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ChevronRight, Check, Zap, Bike, ShieldCheck, PackageSearch, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { productsApi, repairsApi, type Product } from "@/lib/api";
import { addScooterToGarage, getGarageScooters, pushGarageToServer } from "@/lib/garage";

import { SCOOTER_BRANDS, mergeScooterBrands, type ScooterBrand } from "./scooter-brands";

type Step = "brand" | "model" | "results";

/** Brand visual config: we assign a unique icon letter for each brand since we don't have real logos. */
function brandInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export default function CompatibilitePage() {
  const [step, setStep] = useState<Step>("brand");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchBrand, setSearchBrand] = useState("");
  const [savedToGarage, setSavedToGarage] = useState(false);
  const [brands, setBrands] = useState<ScooterBrand[]>(SCOOTER_BRANDS);

  // Fetch the dynamic list (real models we have actually serviced via SAV)
  // and merge it with the static baseline. Soft-fail to the static list.
  useEffect(() => {
    let cancelled = false;
    repairsApi
      .scooterModels()
      .then((res) => {
        if (cancelled) return;
        const dynamic = (res.data || []).map((b) => ({ name: b.brand, models: b.models }));
        if (dynamic.length === 0) return; // keep static baseline as-is
        setBrands(mergeScooterBrands(dynamic));
      })
      .catch(() => {
        // API failure -> static baseline already applied via initial state
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentBrand = brands.find((b) => b.name === selectedBrand);
  const filteredBrands = searchBrand
    ? brands.filter((b) => b.name.toLowerCase().includes(searchBrand.toLowerCase()))
    : brands;

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
          <div className="w-12 h-12 mx-auto flex items-center justify-center bg-neon-dim border border-neon/30 mb-4">
            <ShieldCheck className="w-6 h-6 text-neon" />
          </div>
          <h1 className="heading-lg mb-3">COMPATIBILITE PIECES</h1>
          <p className="font-mono text-sm text-text-muted max-w-xl mx-auto">
            Selectionnez votre trottinette et on vous montre les pieces compatibles depuis notre catalogue.
          </p>
          <p className="font-mono text-[11px] text-text-dim mt-2">
            Votre modele n&apos;est pas liste ? Contactez-nous — on repare toutes les marques.
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
              {i < 2 && (
                <div className={cn(
                  "w-6 h-px",
                  (step === "model" && i === 0) || (step === "results") ? "bg-neon/50" : "bg-border"
                )} />
              )}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredBrands.map((brand) => (
                <button
                  key={brand.name}
                  onClick={() => { setSelectedBrand(brand.name); setStep("model"); }}
                  className="bg-surface-2 p-6 text-center border border-border hover:border-neon transition-all duration-200 cursor-pointer group hover:-translate-y-1 hover:shadow-[0_0_24px_rgba(0,255,209,0.08)]"
                >
                  <div className="w-16 h-16 mx-auto bg-void border border-border flex items-center justify-center mb-3 group-hover:border-neon transition-all duration-200 group-hover:bg-neon-dim">
                    <span className="font-display font-bold text-xl text-text-dim group-hover:text-neon transition-colors duration-200">
                      {brandInitials(brand.name)}
                    </span>
                  </div>
                  <p className="font-display font-bold text-text group-hover:text-neon transition-colors duration-200">{brand.name}</p>
                  <p className="font-mono text-xs text-text-dim mt-1">{brand.models.length} modeles</p>
                </button>
              ))}
            </div>
            {filteredBrands.length === 0 && (
              <div className="text-center py-12">
                <Search className="w-8 h-8 text-text-dim mx-auto mb-3" />
                <p className="font-mono text-sm text-text-muted">Aucune marque trouvee pour &quot;{searchBrand}&quot;</p>
                <button onClick={() => setSearchBrand("")} className="font-mono text-xs text-neon hover:underline mt-2 cursor-pointer transition-colors duration-200">
                  Effacer la recherche
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step: Model */}
        {step === "model" && currentBrand && (
          <div>
            <button onClick={() => setStep("brand")} className="font-mono text-sm text-neon hover:underline mb-6 flex items-center gap-1 cursor-pointer transition-colors duration-200">
              <ArrowLeft className="w-3 h-3" />
              Changer de marque
            </button>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-neon-dim border border-neon/30 flex items-center justify-center">
                <span className="font-display font-bold text-lg text-neon">{brandInitials(selectedBrand)}</span>
              </div>
              <div>
                <h2 className="heading-md text-text">{selectedBrand}</h2>
                <p className="font-mono text-sm text-text-muted">Selectionnez votre modele</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {currentBrand.models.map((model) => (
                <button
                  key={model}
                  onClick={() => handleSelectModel(model)}
                  className="bg-surface-2 p-5 text-left border border-border hover:border-neon transition-all duration-200 cursor-pointer group hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="w-4 h-4 text-text-dim group-hover:text-neon transition-colors duration-200" />
                    <p className="font-mono text-sm font-bold text-text group-hover:text-neon transition-colors duration-200">
                      {model}
                    </p>
                  </div>
                  <p className="font-mono text-xs text-text-dim">{selectedBrand} {model}</p>
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
                <button onClick={reset} className="font-mono text-sm text-neon hover:underline mb-2 flex items-center gap-1 cursor-pointer transition-colors duration-200">
                  <ArrowLeft className="w-3 h-3" />
                  Nouvelle recherche
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
                    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
                    if (token) pushGarageToServer(token).catch(() => undefined);
                  }}
                  className="btn-outline text-xs flex items-center gap-2 cursor-pointer"
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
                  <div key={i} className="bg-surface border border-border aspect-[3/4] animate-pulse" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16 bg-surface border border-border">
                <PackageSearch className="w-14 h-14 text-text-dim mx-auto mb-4" />
                <p className="heading-md text-text-muted mb-2">
                  Pas de resultats specifiques
                </p>
                <p className="font-mono text-xs text-text-dim mb-2 max-w-sm mx-auto">
                  Nous n&apos;avons pas de pieces referencees specifiquement pour le {selectedBrand} {selectedModel}.
                </p>
                <p className="font-mono text-xs text-text-dim mb-6">
                  Parcourez notre catalogue complet pour trouver vos pieces.
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
                        {/* Compatibility badge */}
                        <div className="flex items-center gap-1.5 mb-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-neon flex-shrink-0" />
                          <span className="font-mono text-[11px] text-neon font-bold">Compatible {selectedBrand} {selectedModel}</span>
                        </div>
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
