export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">TrottiStore</h1>
          <nav className="flex gap-6 text-sm text-gray-600">
            <a href="/produits" className="hover:text-gray-900">Produits</a>
            <a href="/reparation" className="hover:text-gray-900">R&eacute;paration SAV</a>
            <a href="/panier" className="hover:text-gray-900">Panier</a>
            <a href="/mon-compte" className="hover:text-gray-900">Mon compte</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h2 className="text-5xl font-bold text-gray-900 mb-6">
          Trottinettes &eacute;lectriques &amp; Pi&egrave;ces d&eacute;tach&eacute;es
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Sp&eacute;cialiste depuis 2019. Vente, r&eacute;paration et pi&egrave;ces d&eacute;tach&eacute;es
          pour toutes marques. Paiement en 2x 3x 4x sans frais.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/produits"
            className="bg-gray-900 text-white px-8 py-3 rounded-lg font-medium hover:bg-gray-800 transition"
          >
            Voir le catalogue
          </a>
          <a
            href="/reparation"
            className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition"
          >
            D&eacute;poser un SAV
          </a>
        </div>
      </section>

      {/* Avantages */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl mb-2">&#x1f6f4;</div>
            <h3 className="font-semibold text-gray-900">Sp&eacute;cialiste</h3>
            <p className="text-sm text-gray-600">Expert trottinettes depuis 2019</p>
          </div>
          <div>
            <div className="text-3xl mb-2">&#x1f6e0;&#xfe0f;</div>
            <h3 className="font-semibold text-gray-900">Atelier SAV</h3>
            <p className="text-sm text-gray-600">R&eacute;paration toutes marques sur place</p>
          </div>
          <div>
            <div className="text-3xl mb-2">&#x1f4b3;</div>
            <h3 className="font-semibold text-gray-900">Paiement 2x 3x 4x</h3>
            <p className="text-sm text-gray-600">Sans frais, sans organisme tiers</p>
          </div>
          <div>
            <div className="text-3xl mb-2">&#x1f4e6;</div>
            <h3 className="font-semibold text-gray-900">Livraison rapide</h3>
            <p className="text-sm text-gray-600">Exp&eacute;dition sous 24-48h</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
          <p>&copy; 2026 TrottiStore &mdash; 18 bis Rue M&eacute;chin, 93450 L&rsquo;&Icirc;le-Saint-Denis</p>
        </div>
      </footer>
    </main>
  );
}
