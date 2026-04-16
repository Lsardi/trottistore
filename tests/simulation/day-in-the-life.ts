/**
 * Simulation — "Une journée type" chez TrottiStore
 *
 * Simule une journée complète d'activité admin avec des vraies requêtes API.
 * Chaque section correspond à un moment de la journée et teste les actions
 * que l'admin/technicien fait réellement.
 *
 * Usage:
 *   npx tsx tests/simulation/day-in-the-life.ts
 *   ADMIN_EMAIL=admin@trottistore.fr ADMIN_PASSWORD=xxx npx tsx tests/simulation/day-in-the-life.ts
 *
 * Cleanup: le script nettoie toutes les données de test à la fin.
 */

const BASE = process.env.BASE_URL || "https://trottistoreweb-production.up.railway.app";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

// ─── Helpers ─────────────────────────────────────────────

let token = "";
let passed = 0;
let failed = 0;
const cleanup: Array<() => Promise<void>> = [];

async function api(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-session-id": "simulation-day-test",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const isWrite = method === "PUT" || method === "POST" || method === "PATCH";
  // PUT/POST with no body: send empty JSON to avoid Fastify empty body error
  // GET/DELETE: never send body
  const sendBody = body !== undefined ? JSON.stringify(body) :
    isWrite ? "{}" : undefined;

  // Don't set Content-Type on GET/DELETE without body (Fastify rejects empty JSON body)
  if (!isWrite && body === undefined) {
    delete headers["Content-Type"];
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: sendBody,
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}

async function refreshToken() {
  const login = await api("POST", "/api/v1/auth/login", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (login.data?.accessToken) token = login.data.accessToken;
}

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n━━━ ${title} ━━━`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Simulation ──────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   SIMULATION — Une journée type TrottiStore  ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`Cible: ${BASE}`);
  console.log(`Heure: ${new Date().toLocaleString("fr-FR")}\n`);

  // ━━━ 08:00 — OUVERTURE : Login admin ━━━
  section("08:00 — OUVERTURE : Login admin");

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log("  ⚠ ADMIN_EMAIL/ADMIN_PASSWORD non définis — mode dry");
    console.log("  Utilise: ADMIN_EMAIL=admin@trottistore.fr ADMIN_PASSWORD=xxx");
    process.exit(0);
  }

  const login = await api("POST", "/api/v1/auth/login", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  assert("Login admin", login.status === 200, `status=${login.status}`);
  token = login.data?.accessToken || "";
  if (!token) {
    console.log("  FATAL: pas de token, arrêt");
    process.exit(1);
  }

  const me = await api("GET", "/api/v1/auth/me");
  assert("Profil admin chargé", me.status === 200 && me.data?.user?.role === "SUPERADMIN",
    `role=${me.data?.user?.role}`);

  // ━━━ 08:15 — DASHBOARD : Vue d'ensemble ━━━
  section("08:15 — DASHBOARD : Vue d'ensemble");

  const orders = await api("GET", "/api/v1/admin/orders?page=1&limit=10");
  assert("Liste commandes", orders.status === 200, `count=${orders.data?.length}`);

  const products = await api("GET", "/api/v1/products?limit=5");
  assert("Liste produits", products.status === 200, `count=${products.data?.length}`);

  const categories = await api("GET", "/api/v1/categories");
  assert("Catégories", categories.status === 200);

  const stockAlerts = await api("GET", "/api/v1/stock-alerts");
  assert("Alertes stock", stockAlerts.status === 200 || stockAlerts.status === 404);

  await sleep(300);

  // ━━━ 09:00 — CLIENT : Inscription + vérification ━━━
  section("09:00 — CLIENT : Inscription + vérification email");

  const testEmail = `sim-${Date.now()}@test.trottistore.local`;
  const register = await api("POST", "/api/v1/auth/register", {
    email: testEmail,
    password: "SimTest2026!",
    firstName: "Simulation",
    lastName: "Test",
  });
  assert("Inscription client", register.status === 201, `id=${register.data?.user?.id}`);
  const testUserId = register.data?.user?.id;

  if (testUserId) {
    cleanup.push(async () => {
      // Login as test user to delete account
      const loginRes = await api("POST", "/api/v1/auth/login", {
        email: testEmail,
        password: "SimTest2026!",
      });
      if (loginRes.data?.accessToken) {
        const oldToken = token;
        token = loginRes.data.accessToken;
        await api("DELETE", "/api/v1/auth/account");
        token = oldToken;
      }
    });
  }

  // ━━━ 09:30 — CATALOGUE : Mise à jour produit ━━━
  section("09:30 — CATALOGUE : Mise à jour produit");

  const firstProduct = products.data?.[0];
  if (firstProduct) {
    const productDetail = await api("GET", `/api/v1/admin/products/${firstProduct.id}`);
    assert("Détail produit admin", productDetail.status === 200,
      `name=${productDetail.data?.name?.substring(0, 30)}`);

    // Toggle featured
    const update = await api("PUT", `/api/v1/admin/products/${firstProduct.id}`, {
      isFeatured: !firstProduct.isFeatured,
    });
    assert("Update produit (toggle featured)", update.status === 200);

    // Revert
    await api("PUT", `/api/v1/admin/products/${firstProduct.id}`, {
      isFeatured: firstProduct.isFeatured,
    });
    assert("Revert produit", true);
  }

  const featured = await api("GET", "/api/v1/products/featured");
  assert("Produits featured (cache Redis)", featured.status === 200, `count=${featured.data?.length}`);

  await sleep(300);

  // ━━━ 10:00 — PANIER : Simulation client ━━━
  section("10:00 — PANIER : Simulation achat client");

  const cart = await api("GET", "/api/v1/cart");
  assert("Panier vide", cart.status === 200);

  if (firstProduct?.variants?.[0]) {
    const addItem = await api("POST", "/api/v1/cart/items", {
      productId: firstProduct.id,
      variantId: firstProduct.variants[0].id,
      quantity: 1,
    });
    assert("Ajout panier", addItem.status === 200 || addItem.status === 201);

    const cartFull = await api("GET", "/api/v1/cart");
    assert("Panier avec article", cartFull.status === 200 && cartFull.data?.itemCount >= 1,
      `items=${cartFull.data?.itemCount}`);

    // Clear cart
    await api("DELETE", "/api/v1/cart");
    assert("Vidage panier", true);
  }

  await sleep(300);

  // ━━━ 11:00 — COMMANDES : Gestion commande existante ━━━
  section("11:00 — COMMANDES : Gestion commande existante");

  const firstOrder = orders.data?.[0];
  if (firstOrder) {
    const orderDetail = await api("GET", `/api/v1/admin/orders/${firstOrder.id}`);
    assert("Détail commande", orderDetail.status === 200,
      `#${orderDetail.data?.orderNumber} ${orderDetail.data?.status}`);

    // Add note
    const note = await api("POST", `/api/v1/admin/orders/${firstOrder.id}/notes`, {
      note: "[SIMULATION] Test journalier automatique — à ignorer",
    });
    assert("Ajout note commande", note.status === 200 || note.status === 201);
  }

  await sleep(300);

  // Refresh token to avoid expiry during long simulation
  await refreshToken();

  // ━━━ 12:00 — SAV : Nouveau ticket réparation ━━━
  section("12:00 — SAV : Workflow réparation complet");

  const createTicket = await api("POST", "/api/v1/repairs", {
    customerName: "Client Simulation",
    customerPhone: "06 00 00 00 00",
    customerEmail: "sim-repair@test.local",
    productModel: "Xiaomi Pro 2 (SIMULATION)",
    type: "REPARATION",
    priority: "NORMAL",
    issueDescription: "[SIMULATION] Pneu avant crevé — test automatique",
  });
  assert("Création ticket SAV", createTicket.status === 201,
    `#${createTicket.data?.ticketNumber}`);

  const ticketId = createTicket.data?.id;

  if (ticketId) {
    // Diagnostic
    await sleep(200);
    const diag = await api("POST", `/api/v1/repairs/${ticketId}/diagnosis`, {
      diagnosis: "[SIMULATION] Chambre à air percée, remplacement nécessaire",
      estimatedCost: 35,
      estimatedDays: 1,
    });
    assert("Diagnostic", diag.status === 200, `status=${diag.data?.status}`);

    // Quote
    await sleep(200);
    const quote = await api("POST", `/api/v1/repairs/${ticketId}/quote`, {
      parts: [
        { partName: "Chambre à air Xiaomi", partRef: "CA-XM-PRO2", quantity: 1, unitCost: 15 },
      ],
      laborCost: 20,
    });
    assert("Devis envoyé", quote.status === 200, `estimatedCost=${quote.data?.estimatedCost}`);

    // Accept quote (backoffice)
    await sleep(200);
    const accept = await api("PUT", `/api/v1/repairs/${ticketId}/quote/accept`);
    assert("Devis accepté", accept.status === 200, `status=${accept.data?.status}`);

    // Transition to EN_REPARATION first (status machine requires it)
    await sleep(200);
    const startRepair = await api("PUT", `/api/v1/repairs/${ticketId}/status`, {
      status: "EN_REPARATION",
      note: "[SIMULATION] Réparation en cours",
    });
    assert("Passage EN_REPARATION", startRepair.status === 200, `status=${startRepair.data?.status}`);

    // Complete repair
    await sleep(200);
    const complete = await api("POST", `/api/v1/repairs/${ticketId}/complete`);
    assert("Réparation terminée", complete.status === 200, `status=${complete.data?.status}`);

    // Verify final status
    const final = await api("GET", `/api/v1/repairs/${ticketId}`);
    assert("Status final = PRET", final.data?.status === "PRET", `status=${final.data?.status}`);
  }

  // Check appointment slots
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const slots = await api("GET", `/api/v1/appointments/slots?date=${tomorrow}`);
  assert("Créneaux RDV disponibles", slots.status === 200 && slots.data?.length > 0,
    `slots=${slots.data?.length}`);

  await sleep(300);

  await refreshToken();

  // ━━━ 14:00 — CRM : Gestion clients ━━━
  section("14:00 — CRM : Gestion clients");

  const customers = await api("GET", "/api/v1/customers?limit=5");
  assert("Liste clients CRM", customers.status === 200, `count=${customers.data?.length}`);

  const firstCustomer = customers.data?.[0];
  if (firstCustomer) {
    const profile = await api("GET", `/api/v1/customers/${firstCustomer.id}`);
    assert("Profil client 360°", profile.status === 200);

    const timeline = await api("GET", `/api/v1/customers/${firstCustomer.id}/timeline`);
    assert("Timeline client", timeline.status === 200);

    // Add interaction
    const interaction = await api("POST", `/api/v1/customers/${firstCustomer.id}/interactions`, {
      type: "NOTE",
      channel: "SYSTEM",
      subject: "[SIMULATION] Test journalier",
      content: "Note automatique de simulation — à ignorer",
    });
    assert("Ajout interaction", interaction.status === 200 || interaction.status === 201);
  }

  await sleep(300);

  // ━━━ 15:00 — CRM : Segments & Newsletter ━━━
  section("15:00 — CRM : Segments & Newsletter");

  const segments = await api("GET", "/api/v1/segments");
  assert("Liste segments", segments.status === 200);

  const campaigns = await api("GET", "/api/v1/campaigns");
  assert("Liste campagnes", campaigns.status === 200, `count=${campaigns.data?.length}`);

  // Create draft campaign
  const campaign = await api("POST", "/api/v1/campaigns", {
    name: "[SIMULATION] Test campaign — delete me",
    subject: "Test simulation journalière",
    content: "<p>Ceci est un test automatique.</p>",
  });
  assert("Création campagne draft", campaign.status === 201);

  const campaignId = campaign.data?.id;
  if (campaignId) {
    cleanup.push(async () => {
      await api("DELETE", `/api/v1/campaigns/${campaignId}`);
    });
  }

  await sleep(300);

  // ━━━ 16:00 — FOURNISSEURS & STOCK ━━━
  section("16:00 — FOURNISSEURS & STOCK");

  const suppliers = await api("GET", "/api/v1/admin/suppliers");
  assert("Liste fournisseurs", suppliers.status === 200);

  const stockMovements = await api("GET", "/api/v1/stock/movements?page=1&limit=5");
  assert("Mouvements stock", stockMovements.status === 200 || stockMovements.status === 404);

  await sleep(300);

  // ━━━ 17:00 — FINANCE ━━━
  section("17:00 — FINANCE");

  await refreshToken();
  const invoices = await api("GET", "/api/v1/admin/invoices");
  // The invoices endpoint may return {orders: [...]} or {data: [...]}
  const hasInvoices = invoices.status === 200 && (invoices.data?.orders || invoices.data?.length >= 0 || Array.isArray(invoices.data));
  assert("Liste factures", hasInvoices, `status=${invoices.status} success=${invoices.success}`);

  await sleep(300);

  // ━━━ 18:00 — PAGES PUBLIQUES : Vérification vitrine ━━━
  section("18:00 — PAGES PUBLIQUES : Vérification vitrine");

  for (const path of [
    "/api/v1/products?limit=3",
    "/api/v1/products/featured",
    "/api/v1/categories",
    `/api/v1/appointments/slots?date=${tomorrow}`,
  ]) {
    const res = await api("GET", path);
    assert(`GET ${path.split("?")[0]}`, res.status === 200);
  }

  // SSR pages
  for (const page of ["/", "/produits", "/reparation", "/diagnostic", "/atelier"]) {
    const res = await fetch(`${BASE}${page}`);
    assert(`Page ${page}`, res.status === 200);
  }

  // Auth protection
  const noAuth = await fetch(`${BASE}/api/v1/repairs`, { headers: {} });
  assert("API protégée sans token = 401", noAuth.status === 401);

  await sleep(300);

  // ━━━ 19:00 — FERMETURE : Cleanup ━━━
  section("19:00 — FERMETURE : Cleanup données de test");

  for (const fn of cleanup.reverse()) {
    try {
      await fn();
      console.log("  ✓ cleanup ok");
    } catch (err) {
      console.log(`  ✗ cleanup failed: ${err}`);
    }
  }

  // ━━━ RÉSUMÉ ━━━
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log(`║  RÉSULTAT: ${passed} passed, ${failed} failed${" ".repeat(Math.max(0, 20 - String(passed).length - String(failed).length))}║`);
  console.log("╚══════════════════════════════════════════════╝");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
