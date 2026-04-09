"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Tags,
  Users,
  Wrench,
  BarChart3,
  ExternalLink,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/brand";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Commandes", href: "/admin/commandes", icon: ShoppingCart },
  { label: "Produits", href: "/admin/produits", icon: Package },
  { label: "Categories", href: "/admin/categories", icon: Tags },
  { label: "Stock", href: "/admin/stock", icon: Boxes },
  { label: "Clients", href: "/admin/clients", icon: Users },
  { label: "SAV", href: "/admin/sav", icon: Wrench },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
        <nav className="px-3 pb-3 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {NAV_ITEMS.map((item) => {
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

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
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
                  "group flex items-center gap-3 px-3 py-2.5 font-mono text-sm transition-all duration-150 border-l-2",
                  isActive
                    ? "border-neon bg-neon-dim text-neon"
                    : "border-transparent text-text-muted hover:bg-surface hover:text-text"
                )}
              >
                <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-neon" : "text-text-dim group-hover:text-text-muted")} />
                <span>{item.label}</span>
              </Link>
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
