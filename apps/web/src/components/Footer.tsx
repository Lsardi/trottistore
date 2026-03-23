import Link from "next/link";
import { MapPin, Phone, Mail, CreditCard, Smartphone, Landmark, CalendarClock } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Marque */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-2xl">🛴</span>
              <span className="text-lg font-bold text-white">TrottiStore</span>
            </div>
            <p className="text-sm leading-relaxed">
              Specialiste trottinettes electriques depuis 2019.
              Vente, reparation et pieces detachees.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="inline-block w-8 h-1 rounded-full bg-teal-500" />
              <span className="text-xs text-teal-400 font-medium">Expert mobilite</span>
            </div>
          </div>

          {/* Boutique */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Boutique</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/produits" className="hover:text-teal-400 transition-colors">
                  Catalogue
                </Link>
              </li>
              <li>
                <Link href="/produits?sort=newest" className="hover:text-teal-400 transition-colors">
                  Nouveautes
                </Link>
              </li>
              <li>
                <Link href="/produits?inStock=true" className="hover:text-teal-400 transition-colors">
                  En stock
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Services</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/reparation" className="hover:text-teal-400 transition-colors">
                  Reparation SAV
                </Link>
              </li>
              <li>
                <Link href="/mon-compte" className="hover:text-teal-400 transition-colors">
                  Mon compte
                </Link>
              </li>
              <li>
                <Link href="/mon-compte" className="hover:text-teal-400 transition-colors">
                  Suivi commande
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Contact</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-teal-500 flex-shrink-0" />
                <span>18 bis Rue Mechin<br />93450 L&apos;Ile-Saint-Denis</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-teal-500 flex-shrink-0" />
                <span>Contactez-nous</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-teal-500 flex-shrink-0" />
                <span>contact@trottistore.fr</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Paiement & legal */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-gray-500" />
                CB
              </span>
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-gray-500" />
                Apple Pay / Google Pay
              </span>
              <span className="flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-gray-500" />
                Virement
              </span>
              <span className="flex items-center gap-1.5 text-teal-400 font-medium">
                <CalendarClock className="w-4 h-4" />
                2x 3x 4x sans frais
              </span>
            </div>
            <p className="text-xs text-gray-600">
              &copy; {new Date().getFullYear()} TrottiStore &mdash; Tous droits reserves
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
