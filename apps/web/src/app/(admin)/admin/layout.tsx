import Link from "next/link";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: "📊" },
  { label: "Commandes", href: "/admin/commandes", icon: "📦" },
  { label: "Produits", href: "/admin/produits", icon: "🛴" },
  { label: "Clients", href: "/admin/clients", icon: "👥" },
  { label: "SAV", href: "/admin/sav", icon: "🔧" },
  { label: "Analytics", href: "/admin/analytics", icon: "📈" },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 text-white p-6 z-40">
        <Link href="/admin" className="flex items-center gap-2 mb-10">
          <span className="text-2xl">🛴</span>
          <span className="text-lg font-bold">TrottiStore</span>
          <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full ml-auto">Admin</span>
        </Link>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition text-sm"
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-6 left-6 right-6">
          <div className="border-t border-gray-800 pt-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition"
            >
              ← Voir la boutique
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
