/**
 * k6 Load Test — TrottiStore Admin Operations
 *
 * Simulates a backoffice user doing:
 *   1. Login as admin
 *   2. Browse/update products (catalogue management)
 *   3. Manage orders (status changes, tracking, notes)
 *   4. SAV workflow (create ticket → diagnosis → quote → accept → parts → complete)
 *   5. Stock management
 *
 * Usage:
 *   k6 run tests/load/admin-operations.js --env ADMIN_EMAIL=admin@trottistore.fr --env ADMIN_PASSWORD=xxx
 *   k6 run tests/load/admin-operations.js --env SCENARIO=smoke
 */

import http from "k6/http";
import { check, group, sleep, fail } from "k6";
import { Rate, Trend } from "k6/metrics";

// ─── CONFIG ──────────────────────────────────────────────

const BASE = __ENV.BASE_URL || "https://trottistoreweb-production.up.railway.app";
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || "";
const SCENARIO = __ENV.SCENARIO || "smoke";

const errorRate = new Rate("errors");
const adminApiLatency = new Trend("admin_api_latency", true);
const savLatency = new Trend("sav_workflow_latency", true);
const productLatency = new Trend("product_mgmt_latency", true);

const scenarios = {
  smoke: {
    stages: [
      { duration: "10s", target: 2 },
      { duration: "30s", target: 2 },
    ],
  },
  standard: {
    stages: [
      { duration: "1m", target: 3 },
      { duration: "3m", target: 5 },
      { duration: "1m", target: 0 },
    ],
  },
};

export const options = {
  stages: scenarios[SCENARIO]?.stages || scenarios.smoke.stages,
  thresholds: {
    http_req_duration: ["p(95)<3000"],
    errors: ["rate<0.1"],
    admin_api_latency: ["p(95)<2000"],
    sav_workflow_latency: ["p(95)<2000"],
    product_mgmt_latency: ["p(95)<1500"],
  },
};

// ─── HELPERS ─────────────────────────────────────────────

const jsonHeaders = { "Content-Type": "application/json" };

function authHeaders(token) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function apiGet(path, token) {
  const res = http.get(`${BASE}${path}`, {
    headers: authHeaders(token),
    tags: { endpoint: path.split("?")[0] },
  });
  errorRate.add(res.status >= 400);
  return res;
}

function apiPost(path, body, token) {
  const res = http.post(`${BASE}${path}`, JSON.stringify(body), {
    headers: authHeaders(token),
    tags: { endpoint: path.split("?")[0] },
  });
  errorRate.add(res.status >= 400 && res.status !== 409 && res.status !== 404);
  return res;
}

function apiPut(path, body, token) {
  const res = http.put(`${BASE}${path}`, JSON.stringify(body), {
    headers: authHeaders(token),
    tags: { endpoint: path.split("?")[0] },
  });
  errorRate.add(res.status >= 400 && res.status !== 409);
  return res;
}

function login() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    // No real creds — test with unauthenticated requests (will get 401)
    return null;
  }
  const res = http.post(`${BASE}/api/v1/auth/login`, JSON.stringify({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  }), { headers: jsonHeaders, tags: { endpoint: "/api/v1/auth/login" } });

  if (res.status !== 200) {
    console.error(`Login failed: ${res.status} ${res.body}`);
    return null;
  }
  try {
    return JSON.parse(res.body).data.accessToken;
  } catch {
    return null;
  }
}

// ─── SETUP — Login once per VU ───────────────────────────

export function setup() {
  // If no credentials, run in "dry" mode (test response times of 401s + public endpoints)
  if (!ADMIN_EMAIL) {
    console.log("No ADMIN_EMAIL set — running in dry mode (unauthenticated, expect 401s)");
    return { token: null, dryMode: true };
  }
  const token = login();
  if (!token) fail("Admin login failed in setup");
  return { token, dryMode: false };
}

// ─── MAIN SCENARIO ───────────────────────────────────────

export default function (data) {
  const token = data.token;
  const isDry = data.dryMode;

  // ── 1. Admin dashboard data ─────────────────────────
  group("Admin Dashboard", () => {
    // Orders list
    const orders = apiGet("/api/v1/admin/orders?page=1&limit=20", token);
    check(orders, {
      "orders list": (r) => isDry ? r.status === 401 : r.status === 200,
    });
    adminApiLatency.add(orders.timings.duration);

    sleep(0.5);

    // Products list (uses public endpoint, admin sees all via role)
    const products = apiGet("/api/v1/products?page=1&limit=20", token);
    check(products, {
      "products list": (r) => r.status === 200,
    });
    adminApiLatency.add(products.timings.duration);

    // Stock alerts
    const alerts = apiGet("/api/v1/stock-alerts", token);
    adminApiLatency.add(alerts.timings.duration);

    sleep(0.3);
  });

  // ── 2. Product management ───────────────────────────
  group("Product Management", () => {
    // Get first product from public list, then use admin detail endpoint
    const list = apiGet("/api/v1/products?limit=1", token);
    let productId = null;
    if (list.status === 200) {
      try {
        const products = JSON.parse(list.body).data;
        if (products && products.length > 0) productId = products[0].id;
      } catch { /* */ }
    }

    if (productId && !isDry) {
      // Get product detail (admin)
      const detail = apiGet(`/api/v1/admin/products/${productId}`, token);
      check(detail, { "product detail 200": (r) => r.status === 200 });
      productLatency.add(detail.timings.duration);

      sleep(0.3);

      // Update product (toggle featured)
      const update = apiPut(`/api/v1/admin/products/${productId}`, {
        isFeatured: true,
      }, token);
      check(update, { "product update 200": (r) => r.status === 200 });
      productLatency.add(update.timings.duration);

      // Revert
      apiPut(`/api/v1/admin/products/${productId}`, { isFeatured: false }, token);
    }

    sleep(0.5);

    // Categories list
    const cats = apiGet("/api/v1/admin/categories", token);
    productLatency.add(cats.timings.duration);
  });

  sleep(0.5);

  // ── 3. Order management ─────────────────────────────
  group("Order Management", () => {
    const orderList = apiGet("/api/v1/admin/orders?page=1&limit=5", token);
    let orderId = null;
    if (!isDry && orderList.status === 200) {
      try {
        const orders = JSON.parse(orderList.body).data;
        if (orders && orders.length > 0) orderId = orders[0].id;
      } catch { /* */ }
    }

    if (orderId && !isDry) {
      // Order detail
      const detail = apiGet(`/api/v1/admin/orders/${orderId}`, token);
      check(detail, { "order detail 200": (r) => r.status === 200 });
      adminApiLatency.add(detail.timings.duration);

      sleep(0.3);

      // Add note (field is "note", not "content")
      const note = apiPost(`/api/v1/admin/orders/${orderId}/notes`, {
        note: "k6 load test note",
      }, token);
      check(note, {
        "add note": (r) => r.status === 201 || r.status === 200,
      });
      adminApiLatency.add(note.timings.duration);
    }

    sleep(0.5);
  });

  // ── 4. SAV Workflow ─────────────────────────────────
  group("SAV Workflow", () => {
    // List repair tickets
    const tickets = apiGet("/api/v1/repairs?page=1&limit=10", token);
    check(tickets, {
      "repairs list": (r) => isDry ? r.status === 401 : r.status === 200,
    });
    savLatency.add(tickets.timings.duration);

    let ticketId = null;
    if (!isDry && tickets.status === 200) {
      try {
        const data = JSON.parse(tickets.body).data;
        if (data && data.length > 0) ticketId = data[0].id;
      } catch { /* */ }
    }

    if (ticketId && !isDry) {
      // Ticket detail
      const detail = apiGet(`/api/v1/repairs/${ticketId}`, token);
      check(detail, { "ticket detail 200": (r) => r.status === 200 });
      savLatency.add(detail.timings.duration);
    }

    sleep(0.3);

    // Appointment slots (public)
    const slots = http.get(`${BASE}/api/v1/appointments/slots?date=2026-04-18`, {
      headers: jsonHeaders,
      tags: { endpoint: "/api/v1/appointments/slots" },
    });
    check(slots, { "slots 200": (r) => r.status === 200 });
    savLatency.add(slots.timings.duration);

    // Technicians list
    const techs = apiGet("/api/v1/technicians", token);
    savLatency.add(techs.timings.duration);

    sleep(0.3);

    // SAV stats
    const stats = apiGet("/api/v1/repairs/diagnostic-stats", token);
    savLatency.add(stats.timings.duration);
  });

  sleep(0.5);

  // ── 5. Stock operations ─────────────────────────────
  group("Stock Operations", () => {
    // Stock movements list
    const movements = apiGet("/api/v1/stock/movements?page=1&limit=10", token);
    adminApiLatency.add(movements.timings.duration);

    // Stock alerts
    const alerts = apiGet("/api/v1/stock-alerts", token);
    adminApiLatency.add(alerts.timings.duration);
  });

  sleep(Math.random() * 2);
}
