import Link from "next/link";
import {
  Zap,
  Wrench,
  CreditCard,
  Truck,
  Lightbulb,
  Disc,
  Settings,
  Cable,
  Paintbrush,
  Shield,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

const AVANTAGES = [
  {
    icon: Zap,
    title: "Specialiste",
    desc: "Expert trottinettes electriques depuis 2019",
  },
  {
    icon: Wrench,
    title: "Atelier SAV",
    desc: "Reparation toutes marques sur place",
  },
  {
    icon: CreditCard,
    title: "Paiement 2x 3x 4x",
    desc: "Sans frais, sans organisme tiers",
  },
  {
    icon: Truck,
    title: "Livraison rapide",
    desc: "Expedition sous 24-48h",
  },
] as const;

const CATEGORIES_POPULAIRES = [
  { name: "Eclairages", slug: "eclairages", icon: Lightbulb },
  { name: "Freinage", slug: "freinage", icon: Disc },
  { name: "Amortisseurs", slug: "amortisseurs", icon: Settings },
  { name: "Cables & Connectiques", slug: "cables-connectiques", icon: Cable },
  { name: "Customisation", slug: "customisation", icon: Paintbrush },
  { name: "Securite", slug: "securite-en-mobilite-electrique", icon: Shield },
] as const;

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-teal-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-500/20 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 md:py-32 text-center">
          <p className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-300 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
            <Zap className="w-4 h-4" />
            Specialiste depuis 2019
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
            Specialiste trottinettes
            <br />
            <span className="text-teal-400">electriques</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            Plus de 700 references en stock. Pieces detachees, accessoires
            et reparation pour toutes marques.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/produits"
              className="inline-flex items-center gap-2 bg-teal-500 text-white px-8 py-4 rounded-xl font-semibold hover:bg-teal-600 transition-colors text-lg shadow-lg shadow-teal-500/25"
            >
              Voir le catalogue
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
      </section>

      {/* Trust badges */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {AVANTAGES.map((item) => (
              <div
                key={item.title}
                className="flex flex-col items-center text-center p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:border-teal-200 hover:shadow-md transition-all"
              >
                <div className="w-14 h-14 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
                  <item.icon className="w-7 h-7 text-teal-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular categories */}
      <section className="py-16 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Categories populaires
            </h2>
            <p className="text-gray-500">Trouvez rapidement les pieces qu&apos;il vous faut</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {CATEGORIES_POPULAIRES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/produits?categorySlug=${cat.slug}`}
                className="group bg-white rounded-2xl p-6 text-center border-2 border-transparent hover:border-teal-500 shadow-sm hover:shadow-lg transition-all duration-200"
              >
                <div className="w-12 h-12 mx-auto rounded-xl bg-gray-100 group-hover:bg-teal-50 flex items-center justify-center mb-3 transition-colors">
                  <cat.icon className="w-6 h-6 text-gray-500 group-hover:text-teal-600 transition-colors" />
                </div>
                <p className="text-sm font-medium text-gray-900">{cat.name}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SAV */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative bg-gray-900 rounded-3xl p-10 md:p-16 text-center text-white overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent" />
            <div className="relative">
              <Wrench className="w-10 h-10 text-teal-400 mx-auto mb-6" />
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Votre trottinette a besoin d&apos;une reparation ?
              </h2>
              <p className="text-gray-400 mb-8 max-w-lg mx-auto leading-relaxed">
                Notre atelier a L&apos;Ile-Saint-Denis repare toutes les marques.
                Diagnostic gratuit, devis avant intervention.
              </p>
              <Link
                href="/reparation"
                className="inline-flex items-center gap-2 bg-teal-500 text-white px-8 py-4 rounded-xl font-semibold hover:bg-teal-600 transition-colors shadow-lg shadow-teal-500/25"
              >
                Deposer un ticket SAV
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Payment methods */}
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
            <span className="flex items-center gap-2 text-teal-600 font-medium">
              <span className="text-lg">📅</span>
              2x 3x 4x sans frais
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
