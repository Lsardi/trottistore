import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Clock, Wrench, Users, Star } from "lucide-react";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `À propos | ${brand.name}`,
  description: `${brand.name}, spécialiste trottinettes électriques depuis ${brand.since}. Boutique et atelier au ${brand.address.street}, ${brand.address.city}.`,
};

export default function AProposPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="heading-xl mb-2">À PROPOS</h1>
      <p className="font-mono text-sm text-text-muted mb-10">
        {brand.name} — spécialiste trottinettes électriques depuis {brand.since}.
      </p>

      {/* Story */}
      <section className="bg-surface border border-border p-6 mb-8">
        <p className="spec-label mb-4">NOTRE HISTOIRE</p>
        <div className="space-y-4 font-mono text-sm text-text-muted leading-relaxed">
          <p>
            Depuis {brand.since}, {brand.name} accompagne les utilisateurs de trottinettes électriques
            en Île-de-France. Ce qui a commencé comme un atelier de réparation est devenu
            une boutique complète : vente, pièces détachées, diagnostic et service après-vente.
          </p>
          <p>
            Notre approche est simple : on connaît chaque modèle parce qu&apos;on les répare tous les jours.
            Quand on vous conseille une trottinette ou une pièce, c&apos;est parce qu&apos;on sait comment elle vieillit,
            ce qui casse, et comment la maintenir.
          </p>
          <p>
            Aujourd&apos;hui, {brand.name} c&apos;est plus de 2000 références en stock,
            toutes les marques réparées, et une communauté de riders qui nous font confiance.
          </p>
        </div>
      </section>

      {/* Chiffres */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { icon: Wrench, value: "2000+", label: "Pièces en stock" },
          { icon: Users, value: "15+", label: "Marques réparées" },
          { icon: Star, value: brand.googleReviewCount, label: "Avis clients" },
          { icon: Clock, value: `Depuis ${brand.since}`, label: "Expérience" },
        ].map(({ icon: Icon, value, label }) => (
          <div
            key={label}
            className="bg-surface border border-border p-4 text-center"
          >
            <Icon style={{ width: 20, height: 20, color: "var(--color-neon)", margin: "0 auto 8px" }} />
            <p className="font-display font-bold text-text text-lg">{value}</p>
            <p className="font-mono text-text-dim" style={{ fontSize: "0.6rem", textTransform: "uppercase" }}>{label}</p>
          </div>
        ))}
      </section>

      {/* Atelier */}
      <section className="bg-surface border border-border p-6 mb-8">
        <p className="spec-label mb-4">NOTRE ATELIER</p>
        <div className="space-y-3 font-mono text-sm text-text-muted">
          <div className="flex items-start gap-3">
            <MapPin style={{ width: 16, height: 16, color: "var(--color-neon)", flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-text font-bold">{brand.address.street}</p>
              <p>{brand.address.postalCode} {brand.address.city}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock style={{ width: 16, height: 16, color: "var(--color-neon)", flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-text font-bold">Lundi — Samedi</p>
              <p>10h — 19h</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="divider my-8" />
      <div className="flex flex-wrap gap-3 justify-center">
        <Link href="/produits" className="btn-neon">VOIR LE CATALOGUE</Link>
        <Link href="/atelier" className="btn-outline">DÉCOUVRIR L&apos;ATELIER</Link>
      </div>
    </main>
  );
}
