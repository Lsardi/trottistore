"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bike, ChevronRight } from "lucide-react";
import { getPrimaryScooter, type GarageScooter } from "@/lib/garage";

export default function GarageBanner() {
  const [garageScooter, setGarageScooter] = useState<GarageScooter | null>(null);

  useEffect(() => {
    setGarageScooter(getPrimaryScooter());
  }, []);

  if (!garageScooter) return null;

  return (
    <section
      style={{
        backgroundColor: "rgba(0, 255, 209, 0.05)",
        borderBottom: "1px solid rgba(0, 255, 209, 0.15)",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Bike style={{ width: 18, height: 18, color: "var(--color-neon)" }} />
          <span className="font-mono" style={{ fontSize: "0.75rem", color: "var(--color-text)" }}>
            Votre {garageScooter.brand} {garageScooter.model}
          </span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link
            href={`/compatibilite?brand=${encodeURIComponent(garageScooter.brand)}&model=${encodeURIComponent(garageScooter.model)}`}
            className="font-mono"
            style={{
              fontSize: "0.7rem",
              color: "var(--color-neon)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            PIECES COMPATIBLES
            <ChevronRight style={{ width: 12, height: 12 }} />
          </Link>
          <Link
            href={`/reparation?productModel=${encodeURIComponent(`${garageScooter.brand} ${garageScooter.model}`)}`}
            className="font-mono"
            style={{
              fontSize: "0.7rem",
              color: "var(--color-text-muted)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            REPARATION
            <ChevronRight style={{ width: 12, height: 12 }} />
          </Link>
        </div>
      </div>
    </section>
  );
}
