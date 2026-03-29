"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bike, Plus, Trash2, Wrench, Search } from "lucide-react";
import {
  getGarageScooters,
  addScooterToGarage,
  removeScooterFromGarage,
  type GarageScooter,
} from "@/lib/garage";

const QUICK_BRANDS = [
  "Dualtron", "Xiaomi", "Ninebot", "Kaabo", "Vsett", "Segway", "Inokim", "Minimotors",
];

export default function GarageSection() {
  const [scooters, setScooters] = useState<GarageScooter[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");

  useEffect(() => {
    setScooters(getGarageScooters());
    const handler = () => setScooters(getGarageScooters());
    window.addEventListener("trottistore:garage-updated", handler);
    return () => window.removeEventListener("trottistore:garage-updated", handler);
  }, []);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!brand.trim() || !model.trim()) return;
    addScooterToGarage(brand.trim(), model.trim());
    setBrand("");
    setModel("");
    setShowForm(false);
    setScooters(getGarageScooters());
  }

  function handleRemove(id: string) {
    removeScooterFromGarage(id);
    setScooters(getGarageScooters());
  }

  return (
    <section className="bg-surface border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bike className="w-4 h-4 text-neon" />
          <p className="spec-label">MON GARAGE</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="font-mono text-xs text-neon hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          AJOUTER
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 p-4 border border-neon/20 bg-neon-dim/30">
          <div className="flex flex-wrap gap-2 mb-3">
            {QUICK_BRANDS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBrand(b)}
                className={`font-mono text-xs px-2 py-1 border transition-colors ${
                  brand === b ? "border-neon text-neon" : "border-border text-text-dim hover:border-text-dim"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Marque"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="input-dark flex-1"
              required
            />
            <input
              type="text"
              placeholder="Modèle (ex: Pro 2)"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="input-dark flex-1"
              required
            />
            <button type="submit" className="btn-neon whitespace-nowrap">
              OK
            </button>
          </div>
        </form>
      )}

      {scooters.length === 0 ? (
        <p className="font-mono text-sm text-text-muted">
          Ajoutez votre trottinette pour voir les pièces compatibles et recevoir des rappels d&apos;entretien.
        </p>
      ) : (
        <div className="space-y-3">
          {scooters.map((scooter) => (
            <div
              key={scooter.id}
              className="border border-border p-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Bike className="w-5 h-5 text-neon flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-mono text-sm text-text font-bold truncate">
                    {scooter.brand} {scooter.model}
                  </p>
                  <p className="font-mono text-[10px] text-text-dim">
                    Ajoutée le {new Date(scooter.addedAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href={`/compatibilite?brand=${encodeURIComponent(scooter.brand)}&model=${encodeURIComponent(scooter.model)}`}
                  className="font-mono text-xs text-neon hover:underline flex items-center gap-1"
                  title="Voir les pièces compatibles"
                >
                  <Search className="w-3 h-3" />
                  PIECES
                </Link>
                <Link
                  href={`/reparation?issue=&productModel=${encodeURIComponent(`${scooter.brand} ${scooter.model}`)}`}
                  className="font-mono text-xs text-text-muted hover:text-neon flex items-center gap-1"
                  title="Déposer un ticket SAV"
                >
                  <Wrench className="w-3 h-3" />
                </Link>
                <button
                  onClick={() => handleRemove(scooter.id)}
                  className="text-text-dim hover:text-danger transition-colors"
                  title="Retirer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
