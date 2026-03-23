"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import {
  Zap,
  Wrench,
  CreditCard,
  Star,
  ArrowRight,
  ChevronDown,
  MapPin,
  Sparkles,
  BookOpen,
  Clock,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import {
  FadeIn,
  StaggerContainer,
  StaggerItem,
  AnimatedCounter,
  TextReveal,
  HorizontalScroll,
  RevealImage,
  ScaleOnScroll,
  Parallax,
  MagneticButton,
} from "@/components/motion";
import { formatPriceTTC } from "@/lib/utils";

// ─── TYPES ────────────────────────────────────────────────

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

// ─── STATIC DATA ──────────────────────────────────────────

const GOOGLE_REVIEWS = [
  {
    name: "Marc D.",
    date: "Il y a 2 semaines",
    rating: 5,
    text: "Excellent service ! Ma Dualtron Achilleus est arrivee en 48h, parfaitement emballee. Le SAV m'a rappele pour verifier que tout etait ok.",
  },
  {
    name: "Sophie L.",
    date: "Il y a 1 mois",
    rating: 5,
    text: "J'ai fait reparer ma trottinette a l'atelier de l'Ile-Saint-Denis. Travail impeccable, prix honnete et tres bon accueil.",
  },
  {
    name: "Karim B.",
    date: "Il y a 3 semaines",
    rating: 5,
    text: "Paiement en 4x sans frais, c'est top pour une Teverun Fighter. Livraison rapide et produit conforme a la description.",
  },
  {
    name: "Julie M.",
    date: "Il y a 1 mois",
    rating: 5,
    text: "Tres satisfaite de ma Kuickwheel S9 ! Parfaite pour mes trajets quotidiens. Merci TrottiStore pour les conseils.",
  },
  {
    name: "Thomas R.",
    date: "Il y a 2 mois",
    rating: 5,
    text: "Specialistes serieux, ils connaissent vraiment leur sujet. J'ai eu un diagnostic gratuit et des recommandations pertinentes.",
  },
];

const BLOG_POSTS = [
  {
    title: "Guide d'achat trottinette electrique 2026",
    excerpt:
      "Comment choisir la trottinette adaptee a vos besoins : autonomie, puissance, poids, budget...",
    image:
      "https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNSPACE52V18A-TROTTINETTE-ELECTRIQUE-TEVERUN-SPACE-52V-18AH-300x300.png",
    slug: "guide-achat-trottinette-2026",
    date: "15 mars 2026",
  },
  {
    title: "Comment entretenir sa trottinette electrique",
    excerpt:
      "Les gestes essentiels pour prolonger la duree de vie de votre trottinette : freins, pneus, batterie.",
    image:
      "https://www.trottistore.fr/wp-content/uploads/2025/07/MMDUALTRONFOREVER60V18A2025-TROTTINETTE-ELECTRIQUE-DUALTRON-FOREVER-60V-182A-2025-EY4-300x300.jpg",
    slug: "entretenir-trottinette-electrique",
    date: "8 mars 2026",
  },
  {
    title: "Les meilleurs accessoires pour trottinette",
    excerpt:
      "Eclairage, antivol, casque, sacoche... Les accessoires indispensables pour rouler en securite.",
    image:
      "https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNTETRA-TROTTINETTE-ELECTRIQUE-TEVERUN-TETRA-4-MOTEURS-300x300.jpg",
    slug: "meilleurs-accessoires-trottinette",
    date: "1 mars 2026",
  },
];

const USPS = [
  {
    icon: MapPin,
    title: "Atelier physique a L'Ile-Saint-Denis",
    desc: "Boutique et atelier de reparation. Venez voir, toucher, essayer. Nous sommes de vrais passionnes, pas un entrepot anonyme.",
  },
  {
    icon: Sparkles,
    title: "Expert depuis 2019",
    desc: "Plus de 5 ans d'experience, des milliers de clients. On connait chaque trottinette sur le bout des doigts.",
  },
  {
    icon: CreditCard,
    title: "Paiement en 2x 3x 4x sans frais",
    desc: "Payez en plusieurs fois directement chez nous, sans organisme tiers et sans interet. Simple et transparent.",
  },
  {
    icon: Wrench,
    title: "SAV reactif sous 48h",
    desc: "Diagnostic gratuit, devis avant intervention. Reparation toutes marques, pieces d'origine. Prise en charge rapide.",
  },
];

const CATEGORIES = [
  {
    name: "Trottinettes Electriques",
    slug: "trottinettes-electriques",
    desc: "Dualtron, Teverun, Kuickwheel... Les meilleures marques au meilleur prix",
    icon: Zap,
    size: "large" as const,
  },
  {
    name: "Pieces detachees",
    slug: "pieces-detachees",
    desc: "Tout pour reparer et entretenir votre trottinette",
    icon: Wrench,
    size: "large" as const,
  },
  { name: "Eclairages", slug: "eclairages", emoji: "💡", size: "small" as const },
  { name: "Freinage", slug: "freinage", emoji: "🔧", size: "small" as const },
  { name: "Amortisseurs", slug: "amortisseurs", emoji: "⚙️", size: "small" as const },
  { name: "Securite", slug: "securite-en-mobilite-electrique", emoji: "🛡️", size: "small" as const },
];

// ─── SCROLL CHEVRON COMPONENT ─────────────────────────────

function ScrollIndicator() {
  return (
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40"
      animate={{ y: [0, 8, 0] }}
      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
    >
      <span className="text-xs tracking-widest uppercase">Scroll</span>
      <ChevronDown className="w-5 h-5" />
    </motion.div>
  );
}

// ─── HOMEPAGE ─────────────────────────────────────────────

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
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchFeatured();
  }, []);

  return (
    <>
      {/* ================================================================
          SECTION 1 — HERO (full viewport, dark)
          ================================================================ */}
      <section className="relative min-h-screen bg-gray-950 text-white flex items-center overflow-hidden">
        {/* Ambient gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-950 to-black" />
        <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-[#28afb1]/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-[#28afb1]/5 rounded-full blur-[100px]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full py-24 md:py-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Left — Text */}
            <div className="max-w-2xl">
              <FadeIn delay={0.1} direction="none">
                <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white/60 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
                  <Zap className="w-3.5 h-3.5 text-[#28afb1]" />
                  Specialiste mobilite electrique depuis 2019
                </div>
              </FadeIn>

              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold leading-[0.95] tracking-tight mb-8">
                <span className="block overflow-hidden">
                  <TextReveal delay={0.2}>La mobilite</TextReveal>
                </span>
                <span className="block overflow-hidden">
                  <TextReveal delay={0.35}>urbaine</TextReveal>
                </span>
                <span className="block overflow-hidden text-[#28afb1]">
                  <TextReveal delay={0.5}>reinventee</TextReveal>
                </span>
              </h1>

              <FadeIn delay={0.8} direction="up">
                <p className="text-lg md:text-xl text-white/50 mb-10 max-w-lg leading-relaxed">
                  Plus de 2000 references &bull; Expert depuis 2019 &bull; Paiement 2x 3x 4x
                </p>
              </FadeIn>

              <FadeIn delay={1.0} direction="up">
                <div className="flex gap-4 flex-wrap">
                  <Link
                    href="/produits?categorySlug=trottinettes-electriques"
                    className="inline-flex items-center gap-2 bg-[#28afb1] text-white px-8 py-4 rounded-xl font-semibold hover:bg-[#1f8e90] transition-all text-lg shadow-lg shadow-[#28afb1]/20 hover:shadow-[#28afb1]/30 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Decouvrir
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/reparation"
                    className="inline-flex items-center gap-2 border border-white/20 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/5 hover:border-white/30 transition-all text-lg"
                  >
                    Reparation SAV
                  </Link>
                </div>
              </FadeIn>
            </div>

            {/* Right — Hero scooter image */}
            <FadeIn delay={0.6} direction="none" className="hidden lg:block">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-t from-[#28afb1]/10 via-transparent to-transparent rounded-full blur-3xl scale-150" />
                <motion.div
                  animate={{ y: [0, -12, 0] }}
                  transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
                >
                  <img
                    src="https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNTETRA-TROTTINETTE-ELECTRIQUE-TEVERUN-TETRA-4-MOTEURS-300x300.jpg"
                    alt="Trottinette electrique Teverun Tetra"
                    className="w-[400px] h-[400px] object-contain drop-shadow-[0_20px_60px_rgba(40,175,177,0.3)]"
                  />
                </motion.div>
              </div>
            </FadeIn>
          </div>
        </div>

        <ScrollIndicator />
      </section>

      {/* ================================================================
          SECTION 2 — ANIMATED STATS BAR (dark, narrow)
          ================================================================ */}
      <section className="bg-gray-950 border-t border-white/5 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            {[
              { value: 2000, suffix: "+", label: "Produits en catalogue" },
              { value: 15, suffix: "", label: "Marques partenaires" },
              { value: 2019, suffix: "", label: "Depuis", prefix: "" },
              { value: 4.8, suffix: "/5", label: "Avis Google" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-2">
                  {stat.label === "Avis Google" ? (
                    // Special handling for decimal
                    <span>
                      <AnimatedCounter value={48} className="tabular-nums" />
                      <span className="text-white/30">{""}</span>
                    </span>
                  ) : (
                    <AnimatedCounter
                      value={stat.value}
                      suffix={stat.suffix}
                      prefix={stat.prefix}
                      className="tabular-nums"
                    />
                  )}
                </div>
                <p className="text-white/40 text-sm font-medium tracking-wide uppercase">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 3 — FEATURED SCOOTERS (dark, horizontal scroll)
          ================================================================ */}
      <section className="bg-gray-950 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-8">
          <FadeIn>
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-[#28afb1] text-sm font-semibold tracking-widest uppercase mb-3">
                  Selection
                </p>
                <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
                  Nos trottinettes
                </h2>
              </div>
              <Link
                href="/produits?categorySlug=trottinettes-electriques"
                className="hidden md:inline-flex items-center gap-1 text-white/50 hover:text-[#28afb1] font-medium transition-colors text-sm"
              >
                Voir tout
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </FadeIn>
        </div>

        {loading ? (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
            <div className="flex gap-6 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-[300px] bg-white/5 rounded-2xl p-4 animate-pulse"
                >
                  <div className="aspect-square bg-white/10 rounded-xl mb-4" />
                  <div className="h-4 bg-white/10 rounded mb-2 w-3/4" />
                  <div className="h-4 bg-white/10 rounded w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ) : featuredProducts.length > 0 ? (
          <HorizontalScroll>
            {/* Leading spacer */}
            <div className="flex-shrink-0 w-8 md:w-16" />
            {featuredProducts.slice(0, 10).map((product, i) => {
              const primaryImage = product.images?.[0];
              const priceTTC = formatPriceTTC(product.priceHt, product.tvaRate);
              const price4x = formatPriceTTC(
                (parseFloat(product.priceHt) / 4).toFixed(2),
                product.tvaRate
              );

              return (
                <Link
                  key={product.id}
                  href={`/produits/${product.slug}`}
                  className="group flex-shrink-0 w-[300px] md:w-[340px] bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden hover:bg-white/[0.06] hover:border-[#28afb1]/20 transition-all duration-500"
                >
                  <div className="relative aspect-square bg-gradient-to-b from-white/[0.02] to-transparent overflow-hidden">
                    {primaryImage ? (
                      <img
                        src={primaryImage.url}
                        alt={primaryImage.alt || product.name}
                        className="w-full h-full object-contain p-6 group-hover:scale-110 transition-transform duration-700 ease-out"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-white/20">
                        <Zap className="w-16 h-16" />
                      </div>
                    )}
                    {product.brand && (
                      <span className="absolute top-4 left-4 bg-white/10 backdrop-blur-md text-xs font-semibold text-white/70 px-3 py-1 rounded-full border border-white/10">
                        {product.brand.name}
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-sm font-medium text-white/80 mb-3 line-clamp-2 group-hover:text-white transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-xl font-bold text-white">
                      A partir de{" "}
                      <span className="text-[#28afb1]">{priceTTC}</span>
                    </p>
                    <p className="text-xs text-white/30 mt-1">
                      ou 4x {price4x} sans frais
                    </p>
                  </div>
                </Link>
              );
            })}
            {/* Trailing spacer */}
            <div className="flex-shrink-0 w-8 md:w-16" />
          </HorizontalScroll>
        ) : (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
            <div className="text-center py-20 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
              <Zap className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/40 text-lg mb-4">
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
          </div>
        )}

        {/* Mobile CTA */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20 pt-4 md:hidden">
          <Link
            href="/produits?categorySlug=trottinettes-electriques"
            className="inline-flex items-center gap-2 bg-[#28afb1] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#1f8e90] transition-colors w-full justify-center"
          >
            Voir toutes les trottinettes
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ================================================================
          SECTION 4 — CATEGORIES (light section — contrast break)
          ================================================================ */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-[#28afb1] text-sm font-semibold tracking-widest uppercase mb-3">
                Catalogue
              </p>
              <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
                Pieces &amp; Accessoires
              </h2>
            </div>
          </FadeIn>

          <ScaleOnScroll>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {CATEGORIES.filter((c) => c.size === "large").map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/produits?categorySlug=${cat.slug}`}
                  className="group relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-10 text-white overflow-hidden min-h-[260px] flex flex-col justify-end hover:shadow-2xl hover:shadow-gray-900/20 transition-all duration-500"
                >
                  <div className="absolute top-0 right-0 w-48 h-48 bg-[#28afb1]/15 rounded-full blur-3xl transition-all group-hover:w-64 group-hover:h-64" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent" />
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-[#28afb1]/15 flex items-center justify-center mb-4">
                      <cat.icon className="w-6 h-6 text-[#28afb1]" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold mb-2">
                      {cat.name}
                    </h3>
                    <p className="text-white/50 mb-4 max-w-md text-sm">
                      {cat.desc}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[#28afb1] font-semibold group-hover:gap-2 transition-all text-sm">
                      Decouvrir
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {CATEGORIES.filter((c) => c.size === "small").map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/produits?categorySlug=${cat.slug}`}
                  className="group bg-gray-50 rounded-2xl p-6 hover:bg-[#28afb1]/5 border-2 border-transparent hover:border-[#28afb1]/15 transition-all duration-300 hover:scale-[1.02]"
                >
                  <span className="text-3xl mb-4 block">{"emoji" in cat ? cat.emoji : ""}</span>
                  <h4 className="font-semibold text-gray-900 group-hover:text-[#28afb1] transition-colors">
                    {cat.name}
                  </h4>
                  <span className="text-xs text-gray-400 mt-1 block">
                    Pieces &amp; Accessoires
                  </span>
                </Link>
              ))}
            </div>
          </ScaleOnScroll>
        </div>
      </section>

      {/* ================================================================
          SECTION 5 — WHY TROTTISTORE (dark section)
          ================================================================ */}
      <section className="bg-gray-950 text-white py-20 md:py-28 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left — Image reveal */}
            <RevealImage
              src="https://www.trottistore.fr/wp-content/uploads/2025/07/MMDUALTRONXLTD-TROTTINETTE-ELECTRIQUE-DUALTRON-X-LTD-300x300.jpg"
              alt="Atelier TrottiStore"
              className="aspect-square rounded-3xl"
            />

            {/* Right — USP list */}
            <div>
              <FadeIn>
                <p className="text-[#28afb1] text-sm font-semibold tracking-widest uppercase mb-3">
                  Nos engagements
                </p>
                <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-12">
                  Pourquoi choisir
                  <br />
                  <span className="text-[#28afb1]">TrottiStore ?</span>
                </h2>
              </FadeIn>

              <StaggerContainer className="space-y-8" staggerDelay={0.15}>
                {USPS.map((usp, i) => (
                  <StaggerItem key={usp.title}>
                    <div className="flex gap-5">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#28afb1]/10 flex items-center justify-center">
                        <usp.icon className="w-6 h-6 text-[#28afb1]" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold mb-1">{usp.title}</h3>
                        <p className="text-white/40 text-sm leading-relaxed">
                          {usp.desc}
                        </p>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 6 — GOOGLE REVIEWS (light section)
          ================================================================ */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight">
                  4.8
                </span>
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className="w-5 h-5 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-400 mt-0.5">
                    sur Google &mdash; 200+ avis
                  </span>
                </div>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
                Ce que disent nos clients
              </h2>
            </div>
          </FadeIn>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" staggerDelay={0.1}>
            {GOOGLE_REVIEWS.slice(0, 3).map((review, i) => (
              <StaggerItem key={i}>
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 h-full">
                  <div className="flex items-center gap-0.5 mb-4">
                    {Array.from({ length: review.rating }).map((_, j) => (
                      <Star
                        key={j}
                        className="w-4 h-4 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-5 leading-relaxed text-sm">
                    &ldquo;{review.text}&rdquo;
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className="font-semibold text-gray-900 text-sm">
                      {review.name}
                    </span>
                    <span className="text-xs text-gray-400">{review.date}</span>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6" staggerDelay={0.1}>
            {GOOGLE_REVIEWS.slice(3).map((review, i) => (
              <StaggerItem key={i}>
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 h-full">
                  <div className="flex items-center gap-0.5 mb-4">
                    {Array.from({ length: review.rating }).map((_, j) => (
                      <Star
                        key={j}
                        className="w-4 h-4 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-5 leading-relaxed text-sm">
                    &ldquo;{review.text}&rdquo;
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className="font-semibold text-gray-900 text-sm">
                      {review.name}
                    </span>
                    <span className="text-xs text-gray-400">{review.date}</span>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ================================================================
          SECTION 7 — DIAGNOSTIC CTA (dark, dramatic)
          ================================================================ */}
      <section className="relative bg-gray-950 text-white py-28 md:py-36 overflow-hidden">
        <Parallax className="absolute inset-0" speed={0.4}>
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/80 via-gray-950/60 to-gray-950/90 z-10" />
          <img
            src="https://www.trottistore.fr/wp-content/uploads/2025/07/MMDUALTRONFOREVER60V18A2025-TROTTINETTE-ELECTRIQUE-DUALTRON-FOREVER-60V-182A-2025-EY4-300x300.jpg"
            alt=""
            className="w-full h-[130%] object-cover opacity-30"
          />
        </Parallax>

        <div className="relative z-20 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <div className="w-16 h-16 rounded-2xl bg-[#28afb1]/15 flex items-center justify-center mx-auto mb-8">
              <Wrench className="w-8 h-8 text-[#28afb1]" />
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6">
              Votre trottinette
              <br />
              <span className="text-[#28afb1]">a un probleme ?</span>
            </h2>
            <p className="text-white/50 text-lg md:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
              Notre diagnostic intelligent identifie la panne en 2 clics.
              Gratuit, rapide, et sans engagement.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <MagneticButton
              href="/diagnostic"
              className="inline-flex items-center gap-2 bg-[#28afb1] text-white px-10 py-5 rounded-xl font-semibold text-lg shadow-lg shadow-[#28afb1]/25 hover:bg-[#1f8e90] transition-colors"
            >
              Lancer le diagnostic
              <ArrowRight className="w-5 h-5" />
            </MagneticButton>
          </FadeIn>
        </div>
      </section>

      {/* ================================================================
          SECTION 8 — BLOG / NEWSLETTER (light)
          ================================================================ */}
      <section className="bg-gray-50 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="flex items-end justify-between mb-14">
              <div>
                <p className="text-[#28afb1] text-sm font-semibold tracking-widest uppercase mb-3">
                  Le blog
                </p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
                  Conseils &amp; Guides
                </h2>
              </div>
              <Link
                href="/blog"
                className="hidden md:inline-flex items-center gap-1 text-gray-400 hover:text-[#28afb1] font-medium transition-colors text-sm"
              >
                Tous les articles
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </FadeIn>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6" staggerDelay={0.15}>
            {BLOG_POSTS.map((post) => (
              <StaggerItem key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl hover:border-[#28afb1]/15 transition-all duration-500 h-full"
                >
                  <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                  </div>
                  <div className="p-6">
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
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ================================================================
          SECTION 9 — PAYMENT METHODS (dark, footer-adjacent)
          ================================================================ */}
      <section className="bg-gray-950 border-t border-white/5 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn direction="none">
            <p className="text-center text-white/30 text-sm font-medium tracking-widest uppercase mb-8">
              Modes de paiement acceptes
            </p>
            <div className="flex justify-center gap-8 md:gap-12 flex-wrap text-sm text-white/40">
              <span className="flex items-center gap-2 hover:text-white/60 transition-colors">
                <CreditCard className="w-5 h-5" />
                Carte bancaire
              </span>
              <span className="flex items-center gap-2 hover:text-white/60 transition-colors">
                <span className="text-base"></span>
                Apple Pay
              </span>
              <span className="flex items-center gap-2 hover:text-white/60 transition-colors">
                <span className="text-base font-bold">G</span>
                Google Pay
              </span>
              <span className="flex items-center gap-2 hover:text-white/60 transition-colors">
                <ShieldCheck className="w-5 h-5" />
                Virement
              </span>
              <span className="flex items-center gap-2 text-[#28afb1]/70 font-medium">
                <Clock className="w-5 h-5" />
                2x 3x 4x sans frais
              </span>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
