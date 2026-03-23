"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Wrench,
  BarChart3,
  ExternalLink,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Commandes", href: "/admin/commandes", icon: ShoppingCart },
  { label: "Produits", href: "/admin/produits", icon: Package },
  { label: "Clients", href: "/admin/clients", icon: Users },
  { label: "SAV", href: "/admin/sav", icon: Wrench },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 text-white flex flex-col z-40">
        {/* Logo */}
        <div className="px-6 py-6">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#28afb1]">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight">TrottiStore</span>
              <span className="rounded bg-[#28afb1]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#28afb1]">
                Admin
              </span>
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
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "border-l-[3px] border-[#28afb1] bg-[#28afb1]/10 text-[#28afb1]"
                    : "border-l-[3px] border-transparent text-gray-400 hover:bg-gray-800 hover:text-white"
                )}
              >
                <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-[#28afb1]" : "text-gray-500 group-hover:text-gray-300")} />
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
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-gray-500 transition hover:bg-gray-800 hover:text-gray-300"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Voir la boutique</span>
          </Link>

          {/* User avatar placeholder */}
          <div className="border-t border-gray-800 pt-3">
            <div className="flex items-center gap-3 rounded-lg px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700">
                <User className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-300 truncate">Administrateur</p>
                <p className="text-xs text-gray-500 truncate">admin@trottistore.fr</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 min-h-screen p-8">
        {children}
      </main>
    </div>
  );
}
