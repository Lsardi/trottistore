"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  X,
  ChevronDown,
  Phone,
  Wrench,
  Zap,
  Lightbulb,
  Disc,
  Settings,
  Cable,
  Paintbrush,
  Shield,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PIECES_SUBCATEGORIES = [
  { name: "Eclairages", slug: "eclairages", icon: Lightbulb },
  { name: "Freinage", slug: "freinage", icon: Disc },
  { name: "Amortisseurs", slug: "amortisseurs", icon: Settings },
  { name: "Cables & Connectiques", slug: "cables-connectiques", icon: Cable },
  { name: "Customisation", slug: "customisation", icon: Paintbrush },
  { name: "Securite", slug: "securite-en-mobilite-electrique", icon: Shield },
] as const;

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [piecesOpen, setPiecesOpen] = useState(false);
  const [mobilePiecesOpen, setMobilePiecesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPiecesOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/produits?search=${encodeURIComponent(searchQuery.trim())}`;
      setSearchOpen(false);
      setSearchQuery("");
    }
  }

  return (
    <>
      {/* Top bar with phone */}
      <div className="bg-gray-900 text-white text-sm hidden md:block">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-9 items-center justify-between">
            <p className="text-gray-400 text-xs">
              Livraison rapide en France metropolitaine &mdash; Paiement en 2x 3x 4x sans frais
            </p>
            <a
              href="tel:+33100000000"
              className="flex items-center gap-1.5 text-gray-300 hover:text-white transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              01 XX XX XX XX
            </a>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              <span className="text-2xl" aria-hidden="true">
                🛴
              </span>
              <span className="text-xl font-bold tracking-tight text-gray-900 group-hover:text-[#28afb1] transition-colors">
                TrottiStore
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {/* Trottinettes Electriques */}
              <Link
                href="/produits?categorySlug=trottinettes-electriques"
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 hover:text-[#28afb1] rounded-lg hover:bg-[#28afb1]/5 transition-colors"
              >
                <Zap className="w-4 h-4" />
                Trottinettes Electriques
              </Link>

              {/* Pieces & Accessoires with dropdown */}
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setPiecesOpen(!piecesOpen)}
                  onMouseEnter={() => setPiecesOpen(true)}
                  className={cn(
                    "flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    piecesOpen
                      ? "text-[#28afb1] bg-[#28afb1]/5"
                      : "text-gray-700 hover:text-[#28afb1] hover:bg-[#28afb1]/5"
                  )}
                >
                  Pieces &amp; Accessoires
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 transition-transform duration-200",
                      piecesOpen && "rotate-180"
                    )}
                  />
                </button>

                {/* Mega-menu dropdown */}
                <div
                  onMouseLeave={() => setPiecesOpen(false)}
                  className={cn(
                    "absolute top-full left-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 p-6 w-[480px] transition-all duration-200 origin-top-left",
                    piecesOpen
                      ? "opacity-100 scale-100 pointer-events-auto"
                      : "opacity-0 scale-95 pointer-events-none"
                  )}
                >
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Pieces &amp; Accessoires
                    </h3>
                    <p className="text-xs text-gray-400">
                      Tout pour entretenir et personnaliser votre trottinette
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {PIECES_SUBCATEGORIES.map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/produits?categorySlug=${cat.slug}`}
                        onClick={() => setPiecesOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#28afb1]/5 group/item transition-colors"
                      >
                        <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover/item:bg-[#28afb1]/10 flex items-center justify-center shrink-0 transition-colors">
                          <cat.icon className="w-4.5 h-4.5 text-gray-500 group-hover/item:text-[#28afb1] transition-colors" />
                        </div>
                        <span className="text-sm font-medium text-gray-700 group-hover/item:text-[#28afb1] transition-colors">
                          {cat.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <Link
                      href="/produits"
                      onClick={() => setPiecesOpen(false)}
                      className="flex items-center gap-2 text-sm text-[#28afb1] font-semibold hover:text-[#1f8e90] transition-colors"
                    >
                      Voir tout le catalogue
                      <span className="text-xs">&rarr;</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Reparation SAV */}
              <Link
                href="/reparation"
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 hover:text-[#28afb1] rounded-lg hover:bg-[#28afb1]/5 transition-colors"
              >
                <Wrench className="w-4 h-4" />
                Reparation SAV
              </Link>

              {/* Diagnostic */}
              <Link
                href="/diagnostic"
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 hover:text-[#28afb1] rounded-lg hover:bg-[#28afb1]/5 transition-colors"
              >
                <Activity className="w-4 h-4" />
                Diagnostic
              </Link>
            </nav>

            {/* Desktop search bar */}
            <div className="hidden lg:block flex-1 max-w-xs">
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un produit..."
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-gray-100 border border-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28afb1]/30 focus:border-[#28afb1]/50 focus:bg-white transition-all"
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </form>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Phone (mobile) */}
              <a
                href="tel:+33100000000"
                className="md:hidden flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-[#28afb1] hover:bg-[#28afb1]/5 transition-colors"
                aria-label="Appeler"
              >
                <Phone className="w-5 h-5" />
              </a>

              {/* Search (mobile/tablet) */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-[#28afb1] hover:bg-[#28afb1]/5 transition-colors"
                aria-label="Rechercher"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Cart */}
              <Link
                href="/panier"
                className="relative flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-[#28afb1] hover:bg-[#28afb1]/5 transition-colors"
                aria-label="Panier"
              >
                <ShoppingCart className="w-5 h-5" />
              </Link>

              {/* Account */}
              <Link
                href="/mon-compte"
                className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-[#28afb1] hover:bg-[#28afb1]/5 transition-colors"
                aria-label="Mon compte"
              >
                <User className="w-5 h-5" />
              </Link>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              >
                {menuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile search overlay */}
        <div
          className={cn(
            "lg:hidden overflow-hidden transition-all duration-300 ease-in-out border-t border-gray-100",
            searchOpen ? "max-h-16" : "max-h-0 border-none"
          )}
        >
          <form onSubmit={handleSearchSubmit} className="px-4 py-3 bg-white">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un produit..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-gray-100 border border-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28afb1]/30 focus:border-[#28afb1]/50 focus:bg-white transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
            </div>
          </form>
        </div>

        {/* Mobile nav */}
        <div
          className={cn(
            "lg:hidden overflow-hidden transition-all duration-300 ease-in-out",
            menuOpen ? "max-h-[500px] border-t border-gray-100" : "max-h-0"
          )}
        >
          <nav className="px-4 py-4 space-y-1 bg-white">
            {/* Trottinettes */}
            <Link
              href="/produits?categorySlug=trottinettes-electriques"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-[#28afb1]/5 hover:text-[#28afb1] font-medium transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <Zap className="w-4 h-4" />
              Trottinettes Electriques
            </Link>

            {/* Pieces & Accessoires accordion */}
            <div>
              <button
                onClick={() => setMobilePiecesOpen(!mobilePiecesOpen)}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-gray-700 hover:bg-[#28afb1]/5 hover:text-[#28afb1] font-medium transition-colors"
              >
                <span>Pieces &amp; Accessoires</span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    mobilePiecesOpen && "rotate-180"
                  )}
                />
              </button>
              <div
                className={cn(
                  "overflow-hidden transition-all duration-300",
                  mobilePiecesOpen ? "max-h-72" : "max-h-0"
                )}
              >
                <div className="pl-6 py-1 space-y-0.5">
                  {PIECES_SUBCATEGORIES.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/produits?categorySlug=${cat.slug}`}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-[#28afb1]/5 hover:text-[#28afb1] transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <cat.icon className="w-4 h-4" />
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Reparation SAV */}
            <Link
              href="/reparation"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-[#28afb1]/5 hover:text-[#28afb1] font-medium transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <Wrench className="w-4 h-4" />
              Reparation SAV
            </Link>

            {/* Diagnostic */}
            <Link
              href="/diagnostic"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-[#28afb1]/5 hover:text-[#28afb1] font-medium transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <Activity className="w-4 h-4" />
              Diagnostic
            </Link>

            <hr className="my-2 border-gray-100" />

            {/* Account (mobile) */}
            <Link
              href="/mon-compte"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-[#28afb1]/5 hover:text-[#28afb1] font-medium transition-colors sm:hidden"
              onClick={() => setMenuOpen(false)}
            >
              <User className="w-4 h-4" />
              Mon compte
            </Link>

            {/* Phone CTA (mobile) */}
            <a
              href="tel:+33100000000"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#28afb1] font-medium transition-colors"
            >
              <Phone className="w-4 h-4" />
              01 XX XX XX XX
            </a>
          </nav>
        </div>
      </header>
    </>
  );
}
