import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Marque */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🛴</span>
              <span className="text-lg font-bold text-white">TrottiStore</span>
            </div>
            <p className="text-sm">
              Spécialiste trottinettes électriques depuis 2019.
              Vente, réparation et pièces détachées.
            </p>
          </div>

          {/* Boutique */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Boutique</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/produits" className="hover:text-white transition">Catalogue</Link></li>
              <li><Link href="/produits?sort=newest" className="hover:text-white transition">Nouveautés</Link></li>
              <li><Link href="/produits?inStock=true" className="hover:text-white transition">En stock</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Services</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/reparation" className="hover:text-white transition">Réparation SAV</Link></li>
              <li><Link href="/mon-compte" className="hover:text-white transition">Mon compte</Link></li>
              <li><Link href="/mon-compte" className="hover:text-white transition">Suivi commande</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Contact</h3>
            <ul className="space-y-2 text-sm">
              <li>📍 18 bis Rue Méchin</li>
              <li>93450 L&apos;Île-Saint-Denis</li>
              <li>📞 Contactez-nous</li>
              <li>✉️ contact@trottistore.fr</li>
            </ul>
          </div>
        </div>

        {/* Paiement & légal */}
        <div className="mt-10 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 text-sm">
            <span>💳 CB</span>
            <span> Apple Pay</span>
            <span>📱 Google Pay</span>
            <span>🏦 Virement</span>
            <span>📅 2x 3x 4x sans frais</span>
          </div>
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} TrottiStore — Tous droits réservés
          </p>
        </div>
      </div>
    </footer>
  );
}
