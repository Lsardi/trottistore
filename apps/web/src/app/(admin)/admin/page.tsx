export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 text-white p-6">
        <h1 className="text-xl font-bold mb-8">TrottiStore Admin</h1>
        <nav className="space-y-2">
          {[
            { label: "Dashboard", href: "/admin", icon: "\u{1f4ca}" },
            { label: "Commandes", href: "/admin/commandes", icon: "\u{1f4e6}" },
            { label: "Produits", href: "/admin/produits", icon: "\u{1f6f4}" },
            { label: "Clients", href: "/admin/clients", icon: "\u{1f465}" },
            { label: "SAV", href: "/admin/sav", icon: "\u{1f527}" },
            { label: "Analytics", href: "/admin/analytics", icon: "\u{1f4c8}" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="ml-64 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Dashboard</h2>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: "CA Aujourd'hui", value: "---.-- \u20ac", trend: "+0%" },
            { label: "Commandes en cours", value: "--", trend: "" },
            { label: "Tickets SAV ouverts", value: "--", trend: "" },
            { label: "Stock critique", value: "--", trend: "" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">{kpi.label}</p>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              {kpi.trend && (
                <p className="text-sm text-green-600 mt-1">{kpi.trend}</p>
              )}
            </div>
          ))}
        </div>

        {/* Placeholder content */}
        <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-400">
          <p className="text-lg">Les donn&eacute;es s'afficheront ici une fois les services connect&eacute;s.</p>
          <p className="text-sm mt-2">Services : E-commerce (:3001) | CRM (:3002) | Analytics (:3003) | SAV (:3004)</p>
        </div>
      </main>
    </div>
  );
}
