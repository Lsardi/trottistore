"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  Menu,
  X,
  ChevronDown,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACCESSOIRES_SUBCATEGORIES = [
  { name: "Eclairages", slug: "eclairages" },
  { name: "Freinage", slug: "freinage" },
  { name: "Amortisseurs", slug: "amortisseurs" },
  { name: "Cables & Connectiques", slug: "cables-connectiques" },
  { name: "Customisation", slug: "customisation" },
  { name: "Securite", slug: "securite-en-mobilite-electrique" },
] as const;

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accessoiresOpen, setAccessoiresOpen] = useState(false);
  const [mobileAccessoiresOpen, setMobileAccessoiresOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setAccessoiresOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/produits?search=${encodeURIComponent(searchQuery.trim())}`;
      setSearchQuery("");
    }
  }

  return (
    <>
      {/* ── Top Bar ── dark strip */}
      <div className="bg-[#1a1a1a] text-white text-xs hidden md:block">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-9 items-center justify-between">
            {/* Left: phone */}
            <a
              href="tel:+33604463055"
              className="flex items-center gap-1.5 text-gray-300 hover:text-white"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Contact 06 04 46 30 55</span>
            </a>

            {/* Right: wishlist, cart, login */}
            <div className="flex items-center gap-4">
              <Link
                href="/wishlist"
                className="flex items-center gap-1 text-gray-300 hover:text-white"
              >
                <Heart className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/panier"
                className="relative flex items-center gap-1 text-gray-300 hover:text-white"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span className="absolute -top-1.5 -right-2.5 bg-[#28afb1] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  0
                </span>
              </Link>
              <Link
                href="/mon-compte"
                className="text-gray-300 hover:text-white ml-1"
              >
                Se connecter
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Bar ── logo + search + icons */}
      <div className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-[60px] items-center gap-4 lg:gap-8">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden flex items-center justify-center w-10 h-10 text-gray-700"
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {menuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>

            {/* Logo */}
            <Link href="/" className="shrink-0">
              <span className="text-xl lg:text-2xl font-bold tracking-tight text-gray-900">
                TrottiStore
              </span>
            </Link>

            {/* Search bar — prominent, center */}
            <form
              onSubmit={handleSearchSubmit}
              className="hidden md:flex flex-1 max-w-2xl mx-auto"
            >
              <div className="flex w-full border border-gray-300 rounded overflow-hidden">
                {/* Category dropdown */}
                <select className="h-10 px-3 bg-gray-100 border-r border-gray-300 text-sm text-gray-700 focus:outline-none cursor-pointer">
                  <option>Tout</option>
                  <option>Trottinettes</option>
                  <option>Accessoires</option>
                  <option>Pieces</option>
                </select>
                {/* Input */}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un produit..."
                  className="flex-1 h-10 px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                />
                {/* Search button */}
                <button
                  type="submit"
                  className="h-10 px-4 bg-[#28afb1] text-white hover:bg-[#1f8e90]"
                  aria-label="Rechercher"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </form>

            {/* Right icons */}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              {/* Mobile phone */}
              <a
                href="tel:+33604463055"
                className="md:hidden flex items-center justify-center w-10 h-10 text-gray-600"
                aria-label="Appeler"
              >
                <Phone className="w-5 h-5" />
              </a>

              {/* Mobile search toggle — opens search below */}
              <button
                onClick={() => {
                  const el = document.getElementById("mobile-search");
                  if (el) el.classList.toggle("hidden");
                }}
                className="md:hidden flex items-center justify-center w-10 h-10 text-gray-600"
                aria-label="Rechercher"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Cart */}
              <Link
                href="/panier"
                className="relative flex items-center justify-center w-10 h-10 text-gray-600 hover:text-[#28afb1]"
                aria-label="Panier"
              >
                <ShoppingCart className="w-5 h-5" />
              </Link>

              {/* Account */}
              <Link
                href="/mon-compte"
                className="hidden sm:flex items-center justify-center w-10 h-10 text-gray-600 hover:text-[#28afb1]"
                aria-label="Mon compte"
              >
                <User className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile search bar (toggled) */}
        <div id="mobile-search" className="hidden md:hidden px-4 pb-3">
          <form onSubmit={handleSearchSubmit} className="flex border border-gray-300 rounded overflow-hidden">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un produit..."
              className="flex-1 h-10 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
            <button
              type="submit"
              className="h-10 px-3 bg-[#28afb1] text-white"
              aria-label="Rechercher"
            >
              <Search className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* ── Navigation Bar ── categories */}
      <nav className="hidden lg:block bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-11 items-center gap-0">
            {/* Trottinettes Electriques */}
            <Link
              href="/produits?categorySlug=trottinettes-electriques"
              className="px-5 h-full flex items-center text-sm font-semibold uppercase text-gray-800 hover:text-[#28afb1]"
            >
              TROTTINETTES ELECTRIQUES
            </Link>

            {/* Divider */}
            <span className="w-px h-5 bg-gray-200" />

            {/* Accessoires et Pieces — with mega-menu */}
            <div ref={dropdownRef} className="relative h-full">
              <button
                onClick={() => setAccessoiresOpen(!accessoiresOpen)}
                onMouseEnter={() => setAccessoiresOpen(true)}
                className={cn(
                  "px-5 h-full flex items-center gap-1 text-sm font-semibold uppercase",
                  accessoiresOpen
                    ? "text-[#28afb1]"
                    : "text-gray-800 hover:text-[#28afb1]"
                )}
              >
                ACCESSOIRES ET PIECES
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5",
                    accessoiresOpen && "rotate-180"
                  )}
                />
              </button>

              {/* Mega-menu dropdown */}
              {accessoiresOpen && (
                <div
                  onMouseLeave={() => setAccessoiresOpen(false)}
                  className="absolute top-full left-0 bg-white border border-gray-200 shadow-lg p-6 w-[500px] z-50"
                >
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    {ACCESSOIRES_SUBCATEGORIES.map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/produits?categorySlug=${cat.slug}`}
                        onClick={() => setAccessoiresOpen(false)}
                        className="text-sm text-gray-700 hover:text-[#28afb1] py-1"
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <Link
                      href="/produits"
                      onClick={() => setAccessoiresOpen(false)}
                      className="text-sm text-[#28afb1] font-semibold hover:text-[#1f8e90]"
                    >
                      Voir tout le catalogue
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Mobile nav slide-down ── */}
      {menuOpen && (
        <div className="lg:hidden bg-white border-b border-gray-200 z-50">
          <nav className="px-4 py-3 space-y-1">
            <Link
              href="/produits?categorySlug=trottinettes-electriques"
              className="block px-3 py-2.5 text-sm font-semibold uppercase text-gray-800 hover:text-[#28afb1]"
              onClick={() => setMenuOpen(false)}
            >
              TROTTINETTES ELECTRIQUES
            </Link>

            {/* Accessoires accordion */}
            <div>
              <button
                onClick={() => setMobileAccessoiresOpen(!mobileAccessoiresOpen)}
                className="flex items-center justify-between w-full px-3 py-2.5 text-sm font-semibold uppercase text-gray-800 hover:text-[#28afb1]"
              >
                ACCESSOIRES ET PIECES
                <ChevronDown
                  className={cn(
                    "w-4 h-4",
                    mobileAccessoiresOpen && "rotate-180"
                  )}
                />
              </button>
              {mobileAccessoiresOpen && (
                <div className="pl-6 pb-2 space-y-1">
                  {ACCESSOIRES_SUBCATEGORIES.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/produits?categorySlug=${cat.slug}`}
                      className="block px-3 py-2 text-sm text-gray-600 hover:text-[#28afb1]"
                      onClick={() => setMenuOpen(false)}
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <hr className="my-2 border-gray-100" />

            <Link
              href="/mon-compte"
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:text-[#28afb1] sm:hidden"
              onClick={() => setMenuOpen(false)}
            >
              <User className="w-4 h-4" />
              Se connecter
            </Link>

            <a
              href="tel:+33604463055"
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-[#28afb1] font-medium"
            >
              <Phone className="w-4 h-4" />
              06 04 46 30 55
            </a>
          </nav>
        </div>
      )}
    </>
  );
}
