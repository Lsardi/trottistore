"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ShoppingCart, User, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Catalogue", href: "/produits" },
  { label: "Compatibilit\u00e9", href: "/compatibilite" },
  { label: "Diagnostic", href: "/diagnostic" },
  { label: "R\u00e9paration SAV", href: "/reparation" },
] as const;

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="text-2xl" aria-hidden="true">
              🛴
            </span>
            <span className="text-xl font-bold tracking-tight text-gray-900 group-hover:text-teal-600 transition-colors">
              TrottiStore
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600 hover:text-teal-600 transition-colors relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-teal-500 after:transition-all hover:after:w-full"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Search */}
            <Link
              href="/produits?search="
              className="hidden md:flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
              aria-label="Rechercher"
            >
              <Search className="w-5 h-5" />
            </Link>

            {/* Cart */}
            <Link
              href="/panier"
              className="relative flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
              aria-label="Panier"
            >
              <ShoppingCart className="w-5 h-5" />
            </Link>

            {/* Account */}
            <Link
              href="/mon-compte"
              className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
              aria-label="Mon compte"
            >
              <User className="w-5 h-5" />
            </Link>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-300 ease-in-out",
          menuOpen ? "max-h-64 border-t border-gray-100" : "max-h-0"
        )}
      >
        <nav className="px-4 py-4 space-y-1 bg-white">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center px-3 py-2.5 rounded-lg text-gray-700 hover:bg-teal-50 hover:text-teal-700 font-medium transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/mon-compte"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-teal-50 hover:text-teal-700 font-medium transition-colors sm:hidden"
            onClick={() => setMenuOpen(false)}
          >
            <User className="w-4 h-4" />
            Mon compte
          </Link>
        </nav>
      </div>
    </header>
  );
}
