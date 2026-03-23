import Link from "next/link";

const AVANTAGES = [
  { icon: "🛴", title: "Spécialiste", desc: "Expert trottinettes depuis 2019" },
  { icon: "🛠️", title: "Atelier SAV", desc: "Réparation toutes marques sur place" },
  { icon: "💳", title: "Paiement 2x 3x 4x", desc: "Sans frais, sans organisme tiers" },
  { icon: "📦", title: "Livraison rapide", desc: "Expédition sous 24-48h" },
] as const;

const CATEGORIES_POPULAIRES = [
  { name: "Éclairages", slug: "eclairages", icon: "💡" },
  { name: "Freinage", slug: "freinage", icon: "🔴" },
  { name: "Amortisseurs", slug: "amortisseurs", icon: "⚙️" },
  { name: "Câbles & Connectiques", slug: "cables-connectiques", icon: "🔌" },
  { name: "Customisation", slug: "customisation", icon: "🎨" },
  { name: "Sécurité", slug: "securite-en-mobilite-electrique", icon: "🛡️" },
] as const;

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-24 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Trottinettes électriques
            <br />
            <span className="text-blue-400">& Pièces détachées</span>
          </h1>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Spécialiste depuis 2019. Plus de 700 références en stock.
            Vente, réparation et pièces détachées pour toutes marques.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/produits"
              className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-500 transition text-lg"
            >
              Voir le catalogue
            </Link>
            <Link
              href="/reparation"
              className="border-2 border-white/30 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition text-lg"
            >
              Déposer un SAV
            </Link>
          </div>
        </div>
      </section>

      {/* Avantages */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {AVANTAGES.map((item) => (
            <div key={item.title}>
              <div className="text-4xl mb-3">{item.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
              <p className="text-sm text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Catégories populaires */}
      <section className="py-16 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Catégories populaires
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {CATEGORIES_POPULAIRES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/produits?categorySlug=${cat.slug}`}
                className="bg-white rounded-xl p-6 text-center border border-gray-200 hover:border-blue-300 hover:shadow-md transition"
              >
                <div className="text-3xl mb-2">{cat.icon}</div>
                <p className="text-sm font-medium text-gray-900">{cat.name}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SAV */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="bg-gray-900 rounded-2xl p-10 md:p-16 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Votre trottinette a besoin d&apos;une réparation ?
            </h2>
            <p className="text-gray-300 mb-8 max-w-lg mx-auto">
              Notre atelier à L&apos;Île-Saint-Denis répare toutes les marques.
              Diagnostic gratuit, devis avant intervention.
            </p>
            <Link
              href="/reparation"
              className="inline-block bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-500 transition"
            >
              Déposer un ticket SAV
            </Link>
          </div>
        </div>
      </section>

      {/* Paiement */}
      <section className="py-12 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Payez comme vous voulez
          </h3>
          <div className="flex justify-center gap-8 flex-wrap text-sm text-gray-600">
            <span>💳 Carte bancaire</span>
            <span> Apple Pay</span>
            <span>📱 Google Pay</span>
            <span>🏦 Virement bancaire</span>
            <span>💰 Espèces en boutique</span>
            <span>📅 2x 3x 4x sans frais</span>
          </div>
        </div>
      </section>
    </>
  );
}
