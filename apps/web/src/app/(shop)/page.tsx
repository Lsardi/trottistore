"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Zap,
  Wrench,
  CreditCard,
  Truck,
  Shield,
  Star,
  ArrowRight,
  ChevronRight,
  Clock,
  Phone,
  MapPin,
  BookOpen,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Headphones,
} from "lucide-react";
import { formatPriceTTC } from "@/lib/utils";

interface ProductImage {
  url: string;
  alt: string | null;
}

interface ProductBrand {
  name: string;
  slug: string;
}

interface FeaturedProduct {
  id: string;
  name: string;
  slug: string;
  priceHt: string;
  tvaRate: string;
  isFeatured: boolean;
  brand: ProductBrand | null;
  images: ProductImage[];
}

const TRUST_BADGES = [
  {
    icon: ShieldCheck,
    title: "Garantie 2 ans",
    desc: "Tous nos produits sont garantis 2 ans minimum",
  },
  {
    icon: Shield,
    title: "Paiement securise",
    desc: "Transaction 100% securisee par Stripe",
  },
  {
    icon: Headphones,
    title: "Support 24/7",
    desc: "Une equipe disponible pour vous accompagner",
  },
  {
    icon: Truck,
    title: "Livraison rapide",
    desc: "Expedition sous 24-48h en France metropolitaine",
  },
] as const;

const GOOGLE_REVIEWS = [
  {
    name: "Marc D.",
    date: "Il y a 2 semaines",
    text: "Excellent service ! Ma Dualtron Achilleus est arrivee en 48h, parfaitement emballee. Le SAV m'a rappele pour verifier que tout etait ok.",
  },
  {
    name: "Sophie L.",
    date: "Il y a 1 mois",
    text: "J'ai fait reparer ma trottinette a l'atelier de l'Ile-Saint-Denis. Travail impeccable, prix honnete et tres bon accueil.",
  },
  {
    name: "Karim B.",
    date: "Il y a 3 semaines",
    text: "Paiement en 4x sans frais, c'est top pour une Teverun Fighter. Livraison rapide et produit conforme a la description.",
  },
  {
    name: "Julie M.",
    date: "Il y a 1 mois",
    text: "Tres satisfaite de ma Kuickwheel S9 ! Parfaite pour mes trajets quotidiens. Merci TrottiStore pour les conseils.",
  },
  {
    name: "Thomas R.",
    date: "Il y a 2 mois",
    text: "Specialistes serieux, ils connaissent vraiment leur sujet. J'ai eu un diagnostic gratuit et des recommandations pertinentes.",
  },
];

const BLOG_POSTS = [
  {
    title: "Guide d'achat trottinette electrique 2026",
    excerpt: "Comment choisir la trottinette adaptee a vos besoins : autonomie, puissance, poids, budget... Tous nos conseils.",
    image: "https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNSPACE52V18A-TROTTINETTE-ELECTRIQUE-TEVERUN-SPACE-52V-18AH-300x300.png",
    slug: "guide-achat-trottinette-2026",
    date: "15 mars 2026",
  },
  {
    title: "Comment entretenir sa trottinette electrique",
    excerpt: "Les gestes essentiels pour prolonger la duree de vie de votre trottinette : freins, pneus, batterie, nettoyage.",
    image: "https://www.trottistore.fr/wp-content/uploads/2025/07/MMDUALTRONFOREVER60V18A2025-TROTTINETTE-ELECTRIQUE-DUALTRON-FOREVER-60V-182A-2025-EY4-300x300.jpg",
    slug: "entretenir-trottinette-electrique",
    date: "8 mars 2026",
  },
  {
    title: "Les meilleurs accessoires pour trottinette",
    excerpt: "Eclairage, antivol, casque, sacoche... Decouvrez les accessoires indispensables pour rouler en securite.",
    image: "https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNTETRA-TROTTINETTE-ELECTRIQUE-TEVERUN-TETRA-4-MOTEURS-300x300.jpg",
    slug: "meilleurs-accessoires-trottinette",
    date: "1 mars 2026",
  },
];

const USPS = [
  {
    icon: MapPin,
    title: "Atelier physique",
    desc: "Boutique et atelier de reparation a L'Ile-Saint-Denis (93). Venez nous rencontrer !",
  },
  {
    icon: Sparkles,
    title: "Expert depuis 2019",
    desc: "Plus de 5 ans d'experience dans la mobilite electrique, des milliers de clients satisfaits.",
  },
  {
    icon: CreditCard,
    title: "Paiement en 2x 3x 4x",
    desc: "Payez en plusieurs fois sans frais, directement sur notre site. Sans organisme tiers.",
  },
  {
    icon: Wrench,
    title: "SAV reactif",
    desc: "Diagnostic gratuit, devis avant intervention. Reparation toutes marques en atelier.",
  },
];

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const res = await fetch("/api/v1/products/featured");
        if (res.ok) {
          const data = await res.json();
          setFeaturedProducts(data.data || data.products || data || []);
        }
      } catch {
        // Silently fail — products section will show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchFeatured();
  }, []);

  return (
    <>
      {/* ========== HERO SECTION ========== */}
      <section className="relative bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 text-white overflow-hidden min-h-[600px] flex items-center">
        {/* Background scooter image with overlay */}
        <div className="absolute inset-0">
          <Image
            src="https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNTETRA-TROTTINETTE-ELECTRIQUE-TEVERUN-TETRA-4-MOTEURS-300x300.jpg"
            alt=""
            fill
            className="object-cover opacity-15"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/90 to-gray-950/70" />
        </div>
        {/* Decorative gradient orbs */}
        <div className="absolute top-20 right-20 w-96 h-96 bg-[#28afb1]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-72 h-72 bg-[#28afb1]/10 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 md:py-32 lg:py-40">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-[#28afb1]/10 border border-[#28afb1]/20 text-[#28afb1] text-sm font-medium px-4 py-1.5 rounded-full mb-8">
              <Zap className="w-4 h-4" />
              Specialiste depuis 2019 &mdash; L&apos;Ile-Saint-Denis (93)
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-[1.1] tracking-tight uppercase">
              La mobilite urbaine
              <br />
              <span className="text-[#28afb1]">reinventee</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-xl leading-relaxed">
              Plus de 700 references en stock. Trottinettes electriques, pieces detachees,
              accessoires et reparation pour toutes marques.
            </p>
            <div className="flex gap-4 flex-wrap">
              <Link
                href="/produits?categorySlug=trottinettes-electriques"
                className="inline-flex items-center gap-2 bg-[#28afb1] text-white px-8 py-4 rounded-xl font-semibold hover:bg-[#1f8e90] transition-colors text-lg shadow-lg shadow-[#28afb1]/25"
              >
                Voir les trottinettes
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/reparation"
                className="inline-flex items-center gap-2 border-2 border-white/20 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-colors text-lg"
              >
                Deposer un SAV
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========== TRUST BADGES ========== */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TRUST_BADGES.map((item) => (
              <div
                key={item.title}
                className="flex flex-col items-center text-center p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:border-[#28afb1]/30 hover:shadow-md transition-all"
              >
                <div className="w-14 h-14 rounded-xl bg-[#28afb1]/10 flex items-center justify-center mb-4">
                  <item.icon className="w-7 h-7 text-[#28afb1]" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FEATURED SCOOTERS ========== */}
      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                Nos trottinettes electriques
              </h2>
              <p className="text-gray-500 text-lg">
                Les meilleures marques au meilleur prix
              </p>
            </div>
            <Link
              href="/produits?categorySlug=trottinettes-electriques"
              className="hidden md:inline-flex items-center gap-1 text-[#28afb1] font-semibold hover:text-[#1f8e90] transition-colors"
            >
              Tout voir
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-xl mb-4" />
                  <div className="h-4 bg-gray-200 rounded mb-2 w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : featuredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.slice(0, 12).map((product) => {
                const primaryImage = product.images?.[0];
                const priceTTC = (
                  parseFloat(product.priceHt) *
                  (1 + parseFloat(product.tvaRate) / 100)
                ).toFixed(2);

                return (
                  <Link
                    key={product.id}
                    href={`/produits/${product.slug}`}
                    className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-[#28afb1]/30 transition-all duration-300"
                  >
                    <div className="relative aspect-square bg-gray-50 overflow-hidden">
                      {primaryImage ? (
                        <Image
                          src={primaryImage.url}
                          alt={primaryImage.alt || product.name}
                          fill
                          className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-300">
                          <Zap className="w-16 h-16" />
                        </div>
                      )}
                      {product.brand && (
                        <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-xs font-semibold text-gray-700 px-2.5 py-1 rounded-full">
                          {product.brand.name}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2 group-hover:text-[#28afb1] transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-lg font-bold text-gray-900">
                        A partir de{" "}
                        <span className="text-[#28afb1]">
                          {formatPriceTTC(product.priceHt, product.tvaRate)}
                        </span>
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <Zap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-4">
                Le catalogue est en cours de chargement...
              </p>
              <Link
                href="/produits"
                className="inline-flex items-center gap-2 text-[#28afb1] font-semibold hover:text-[#1f8e90]"
              >
                Voir tous les produits
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          <div className="mt-8 text-center md:hidden">
            <Link
              href="/produits?categorySlug=trottinettes-electriques"
              className="inline-flex items-center gap-2 bg-[#28afb1] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#1f8e90] transition-colors"
            >
              Voir toutes les trottinettes
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ========== CATEGORIES SECTION ========== */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Nos categories
            </h2>
            <p className="text-gray-500 text-lg">
              Tout pour votre trottinette electrique
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Big card: Trottinettes */}
            <Link
              href="/produits?categorySlug=trottinettes-electriques"
              className="group relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-10 text-white overflow-hidden min-h-[320px] flex flex-col justify-end hover:shadow-2xl transition-shadow"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#28afb1]/20 rounded-full blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent" />
              <div className="relative">
                <span className="inline-flex items-center gap-1 text-[#28afb1] text-sm font-semibold mb-3">
                  <Zap className="w-4 h-4" />
                  Categorie phare
                </span>
                <h3 className="text-2xl md:text-3xl font-bold mb-2">
                  Trottinettes Electriques
                </h3>
                <p className="text-gray-400 mb-4 max-w-md">
                  Dualtron, Teverun, Kuickwheel... Les meilleures marques
                  au meilleur prix avec garantie 2 ans.
                </p>
                <span className="inline-flex items-center gap-1 text-[#28afb1] font-semibold group-hover:gap-2 transition-all">
                  Decouvrir
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

            {/* Sub-categories grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: "Eclairages", slug: "eclairages", icon: "💡" },
                { name: "Freinage", slug: "freinage", icon: "🔧" },
                { name: "Amortisseurs", slug: "amortisseurs", icon: "⚙️" },
                { name: "Securite", slug: "securite-en-mobilite-electrique", icon: "🛡️" },
                { name: "Cables & Connectiques", slug: "cables-connectiques", icon: "🔌" },
                { name: "Customisation", slug: "customisation", icon: "🎨" },
              ].map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/produits?categorySlug=${cat.slug}`}
                  className="group bg-gray-50 rounded-2xl p-5 hover:bg-[#28afb1]/5 hover:border-[#28afb1]/20 border-2 border-transparent transition-all"
                >
                  <span className="text-2xl mb-3 block">{cat.icon}</span>
                  <h4 className="font-semibold text-gray-900 text-sm group-hover:text-[#28afb1] transition-colors">
                    {cat.name}
                  </h4>
                  <span className="text-xs text-gray-400 mt-1 block">Pieces &amp; Accessoires</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========== WHY TROTTISTORE ========== */}
      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Pourquoi choisir TrottiStore ?
            </h2>
            <p className="text-gray-500 text-lg">
              Le specialiste de la trottinette electrique en region parisienne
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {USPS.map((usp) => (
              <div key={usp.title} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#28afb1]/10 flex items-center justify-center mx-auto mb-5">
                  <usp.icon className="w-8 h-8 text-[#28afb1]" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-lg">{usp.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{usp.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== GOOGLE REVIEWS ========== */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-1 mb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-6 h-6 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Avis de nos clients
            </h2>
            <p className="text-gray-500">
              4.8/5 sur Google &mdash; Plus de 200 avis
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {GOOGLE_REVIEWS.slice(0, 3).map((review, i) => (
              <div
                key={i}
                className="bg-gray-50 rounded-2xl p-6 border border-gray-100"
              >
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4 leading-relaxed text-sm">
                  &ldquo;{review.text}&rdquo;
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900 text-sm">
                    {review.name}
                  </span>
                  <span className="text-xs text-gray-400">{review.date}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {GOOGLE_REVIEWS.slice(3).map((review, i) => (
              <div
                key={i}
                className="bg-gray-50 rounded-2xl p-6 border border-gray-100"
              >
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4 leading-relaxed text-sm">
                  &ldquo;{review.text}&rdquo;
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900 text-sm">
                    {review.name}
                  </span>
                  <span className="text-xs text-gray-400">{review.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== BLOG / CONSEILS ========== */}
      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                Conseils &amp; Guides
              </h2>
              <p className="text-gray-500 text-lg">
                Nos experts partagent leurs connaissances
              </p>
            </div>
            <Link
              href="/blog"
              className="hidden md:inline-flex items-center gap-1 text-[#28afb1] font-semibold hover:text-[#1f8e90] transition-colors"
            >
              Tous les articles
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BLOG_POSTS.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg hover:border-[#28afb1]/20 transition-all"
              >
                <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                    <BookOpen className="w-3.5 h-3.5" />
                    {post.date}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 group-hover:text-[#28afb1] transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {post.excerpt}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CTA SAV ========== */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#28afb1] via-[#28afb1] to-[#1f8e90]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-[#28afb1]/10 via-transparent to-transparent" />
            <div className="absolute top-10 right-10 w-72 h-72 bg-[#28afb1]/10 rounded-full blur-3xl" />

            <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center p-10 md:p-16">
              <div>
                <Wrench className="w-10 h-10 text-[#28afb1] mb-6" />
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Votre trottinette a besoin d&apos;une reparation ?
                </h2>
                <p className="text-gray-400 mb-8 leading-relaxed">
                  Notre atelier a L&apos;Ile-Saint-Denis repare toutes les marques.
                  Diagnostic gratuit, devis avant intervention. Prise en charge
                  rapide et professionnelle.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/reparation"
                    className="inline-flex items-center gap-2 bg-[#28afb1] text-white px-8 py-4 rounded-xl font-semibold hover:bg-[#1f8e90] transition-colors shadow-lg shadow-[#28afb1]/25"
                  >
                    Deposer un ticket SAV
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/diagnostic"
                    className="inline-flex items-center gap-2 border-2 border-white/20 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-colors"
                  >
                    Diagnostic en ligne
                  </Link>
                </div>
              </div>
              <div className="hidden lg:flex justify-center">
                <div className="relative w-64 h-64">
                  <Image
                    src="https://www.trottistore.fr/wp-content/uploads/2025/07/MMDUALTRONXLTD-TROTTINETTE-ELECTRIQUE-DUALTRON-X-LTD-300x300.jpg"
                    alt="Reparation trottinette electrique"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== PAYMENT METHODS ========== */}
      <section className="py-12 bg-gray-50 border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            Payez comme vous voulez
          </h3>
          <div className="flex justify-center gap-6 md:gap-10 flex-wrap text-sm text-gray-500">
            <span className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-400" />
              Carte bancaire
            </span>
            <span className="flex items-center gap-2">
              <span className="text-lg"></span>
              Apple Pay
            </span>
            <span className="flex items-center gap-2">
              <span className="text-lg">G</span>
              Google Pay
            </span>
            <span className="flex items-center gap-2">
              <span className="text-lg">🏦</span>
              Virement bancaire
            </span>
            <span className="flex items-center gap-2">
              <span className="text-lg">💰</span>
              Especes en boutique
            </span>
            <span className="flex items-center gap-2 text-[#28afb1] font-medium">
              <span className="text-lg">📅</span>
              2x 3x 4x sans frais
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
