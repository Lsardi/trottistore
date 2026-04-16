"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Tags,
  Users,
  Wrench,
  BarChart3,
  Search,
  ExternalLink,
  User,
  UserCog,
  Mail,
  Settings,
  Hammer,
  Link2,
  Percent,
  Rss,
  FileText,
  FileSpreadsheet,
  Truck,
  ShieldCheck,
  Star,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/brand";

type NavItem = { label: string; href: string; icon: LucideIcon };
type NavSection = { label: string; items: NavItem[] };

// Sections are ordered by how often you touch them in a day. Each section
// has a clear metier purpose — this is the container we'll later drop the
// new features into (atelier hub, fournisseurs, factures, etc).
const NAV_SECTIONS: NavSection[] = [
  {
    label: "Opérations",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Commandes", href: "/admin/commandes", icon: ShoppingCart },
      { label: "Atelier", href: "/admin/atelier", icon: Hammer },
      { label: "SAV", href: "/admin/sav", icon: Wrench },
      { label: "Stock", href: "/admin/stock", icon: Boxes },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { label: "Produits", href: "/admin/produits", icon: Package },
      { label: "Catégories", href: "/admin/categories", icon: Tags },
      { label: "Compatibilité", href: "/admin/compatibilite", icon: Link2 },
      { label: "Promos", href: "/admin/promos", icon: Percent },
      { label: "Feeds", href: "/admin/feeds", icon: Rss },
    ],
  },
  {
    label: "Clients",
    items: [
      { label: "Clients", href: "/admin/clients", icon: Users },
      { label: "Newsletter", href: "/admin/newsletter", icon: Mail },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Factures", href: "/admin/factures", icon: FileText },
      { label: "Export compta", href: "/admin/export-compta", icon: FileSpreadsheet },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Système",
    items: [
      { label: "Équipe", href: "/admin/equipe", icon: UserCog },
      { label: "Fournisseurs", href: "/admin/fournisseurs", icon: Truck },
      { label: "Paramètres", href: "/admin/parametres", icon: Settings },
      { label: "Audit", href: "/admin/audit", icon: ShieldCheck },
    ],
  },
];

// Flat list used by the mobile top-bar scroll strip — grouping there would
// be too much visual noise on a narrow screen.
const NAV_ITEMS_FLAT: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);

// Quick lookup from href to full NavItem for rendering the favorites section.
const NAV_ITEM_BY_HREF: Record<string, NavItem> = Object.fromEntries(
  NAV_ITEMS_FLAT.map((item) => [item.href, item]),
);

// localStorage keys — kept as constants so we don't typo between reader/writer.
const STORAGE_COLLAPSED = "admin-sidebar-collapsed-sections";
const STORAGE_FAVORITES = "admin-sidebar-favorites";

function readSetFromStorage(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === "string"));
    }
  } catch {
    /* ignore */
  }
  return new Set();
}

function writeSetToStorage(key: string, value: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(value)));
  } catch {
    /* ignore quota / privacy modes */
  }
}

// The search form uses `useSearchParams`, which Next.js 15 requires to be
// wrapped in a Suspense boundary so the layout shell can still prerender.
// Extracting it into its own component lets us do exactly that.
function SidebarSearchForm({
  placeholder,
  className,
}: {
  placeholder: string;
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams?.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const normalized = query.trim();
    if (!normalized) return;
    router.push(`/admin/recherche?q=${encodeURIComponent(normalized)}`);
  }

  return (
    <form onSubmit={handleSearch} className={className}>
      <div className="relative">
        <Search className="h-4 w-4 text-text-dim absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="input-dark w-full pl-9"
        />
      </div>
    </form>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Auth guard — redirect to login if no access token
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.replace("/mon-compte");
      return;
    }
    // Verify token is valid and user has a backoffice role
    const BACKOFFICE_ROLES = ["SUPERADMIN", "ADMIN", "MANAGER", "TECHNICIAN", "STAFF"];
    fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("unauthorized")))
      .then((data) => {
        if (data?.data?.role && BACKOFFICE_ROLES.includes(data.data.role)) {
          setAuthChecked(true);
        } else {
          router.replace("/mon-compte");
        }
      })
      .catch(() => {
        localStorage.removeItem("accessToken");
        router.replace("/mon-compte");
      });
  }, [router]);

  // Persisted UI state — collapsible sections + favorites.
  // Hydrated in a useEffect so SSR doesn't dump the wrong set and trigger
  // a mismatch.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!authChecked) return;
    setCollapsed(readSetFromStorage(STORAGE_COLLAPSED));
    setFavorites(readSetFromStorage(STORAGE_FAVORITES));
    setHydrated(true);
  }, [authChecked]);

  function toggleCollapsed(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      writeSetToStorage(STORAGE_COLLAPSED, next);
      return next;
    });
  }

  function toggleFavorite(href: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      writeSetToStorage(STORAGE_FAVORITES, next);
      return next;
    });
  }

  // Displayed sections = favorites (if any) + the 6 metier sections.
  // Favorites are derived from the set of starred hrefs, preserving
  // their original NavItem order based on NAV_ITEMS_FLAT.
  const favoriteItems: NavItem[] = hydrated
    ? NAV_ITEMS_FLAT.filter((item) => favorites.has(item.href))
    : [];
  const displayedSections: NavSection[] =
    favoriteItems.length > 0
      ? [{ label: "★ Favoris", items: favoriteItems }, ...NAV_SECTIONS]
      : NAV_SECTIONS;

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <p className="font-mono text-sm text-text-dim">Vérification de l&apos;accès...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 border-b border-border bg-void/95 backdrop-blur">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/admin" className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center bg-neon shrink-0">
              <Package className="h-4 w-4 text-void" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-text truncate">{brand.name}</p>
              <p className="font-mono text-[10px] text-text-dim">Admin</p>
            </div>
          </Link>
          <Link
            href="/"
            className="font-mono text-[11px] text-text-dim border border-border px-2.5 py-1.5 shrink-0"
          >
            Boutique
          </Link>
        </div>
        <Suspense fallback={<div className="px-3 pb-2 h-9" />}>
          <SidebarSearchForm placeholder="Recherche globale..." className="px-3 pb-2" />
        </Suspense>
        <nav className="px-3 pb-3 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {NAV_ITEMS_FLAT.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 border font-mono text-[11px] whitespace-nowrap",
                    isActive
                      ? "border-neon bg-neon-dim text-neon"
                      : "border-border text-text-muted",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Sidebar desktop */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-void border-r border-border flex-col z-40">
        {/* Logo */}
        <div className="px-6 py-6">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-neon">
              <Package className="h-5 w-5 text-void" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-bold tracking-tight text-text">{brand.name}</span>
              <span className="badge badge-neon">Admin</span>
            </div>
          </Link>
        </div>

        <Suspense fallback={<div className="px-3 pb-3 h-9" />}>
          <SidebarSearchForm placeholder="Produits, commandes, clients..." className="px-3 pb-3" />
        </Suspense>

        {/* Nav — grouped by metier section, sections collapsible + favorites */}
        <nav className="flex-1 px-3 overflow-y-auto">
          {displayedSections.map((section, sectionIdx) => {
            const isFavoriteSection = section.label.startsWith("★");
            const isCollapsed = collapsed.has(section.label);
            return (
              <div key={section.label} className={cn(sectionIdx > 0 && "mt-4")}>
                <button
                  type="button"
                  onClick={() => toggleCollapsed(section.label)}
                  className="w-full flex items-center justify-between px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim hover:text-text-muted transition-colors"
                  aria-expanded={!isCollapsed}
                >
                  <span className={cn(isFavoriteSection && "text-neon")}>
                    {section.label}
                  </span>
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
                {!isCollapsed ? (
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive =
                        item.href === "/admin"
                          ? pathname === "/admin"
                          : pathname.startsWith(item.href);
                      const Icon = item.icon;
                      const isFav = favorites.has(item.href);

                      return (
                        <div
                          key={`${section.label}-${item.href}`}
                          className={cn(
                            "group relative flex items-center gap-3 pl-3 pr-8 py-2 font-mono text-sm transition-all duration-150 border-l-2",
                            isActive
                              ? "border-neon bg-neon-dim text-neon"
                              : "border-transparent text-text-muted hover:bg-surface hover:text-text",
                          )}
                        >
                          <Link href={item.href} className="flex items-center gap-3 flex-1 min-w-0">
                            <Icon
                              className={cn(
                                "h-[18px] w-[18px] shrink-0",
                                isActive ? "text-neon" : "text-text-dim group-hover:text-text-muted",
                              )}
                            />
                            <span className="truncate">{item.label}</span>
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleFavorite(item.href);
                            }}
                            className={cn(
                              "absolute right-2 top-1/2 -translate-y-1/2 p-1 transition-opacity",
                              isFav
                                ? "opacity-100 text-neon"
                                : "opacity-0 group-hover:opacity-100 text-text-dim hover:text-neon",
                            )}
                            aria-label={isFav ? `Retirer ${item.label} des favoris` : `Ajouter ${item.label} aux favoris`}
                            title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                          >
                            <Star
                              className="h-3.5 w-3.5"
                              fill={isFav ? "currentColor" : "none"}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-3 pb-4 space-y-3">
          {/* View shop link */}
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2.5 font-mono text-sm text-text-dim transition hover:bg-surface hover:text-text-muted"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Voir la boutique</span>
          </Link>

          {/* User avatar placeholder */}
          <div className="border-t border-border pt-3">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center bg-surface border border-border">
                <User className="h-4 w-4 text-text-dim" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm text-text truncate">Administrateur</p>
                <p className="font-mono text-xs text-text-dim truncate">admin@{brand.domain}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-h-screen p-4 md:ml-64 md:p-8">
        {children}
      </main>
    </div>
  );
}
