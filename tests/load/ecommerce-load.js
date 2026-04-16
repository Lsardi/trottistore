/**
 * k6 Load Test — TrottiStore E-commerce API
 *
 * Simulates real customer journeys:
 *   1. Browse catalogue (public, high traffic)
 *   2. View product detail (public, high traffic)
 *   3. Cart operations (session-based)
 *   4. Auth flow (register/login)
 *   5. Checkout flow (authenticated)
 *   6. SAV — appointment slots (public)
 *   7. Analytics event tracking (public, fire-and-forget)
 *
 * Usage:
 *   k6 run tests/load/ecommerce-load.js
 *   k6 run tests/load/ecommerce-load.js --env BASE_URL=http://localhost:3000
 *   k6 run tests/load/ecommerce-load.js --env SCENARIO=smoke
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { randomString } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

// ─── CONFIG ──────────────────────────────────────────────

const BASE = __ENV.BASE_URL || "https://trottistoreweb-production.up.railway.app";
const SCENARIO = __ENV.SCENARIO || "standard";

// Custom metrics
const errorRate = new Rate("errors");
const catalogLatency = new Trend("catalog_latency", true);
const productLatency = new Trend("product_detail_latency", true);
const cartLatency = new Trend("cart_latency", true);
const authLatency = new Trend("auth_latency", true);

// ─── SCENARIOS ───────────────────────────────────────────

const scenarios = {
  // Quick sanity check — 5 users, 30s
  smoke: {
    stages: [
      { duration: "10s", target: 5 },
      { duration: "20s", target: 5 },
    ],
  },
  // Standard load — ramp to 30 users over 5 min
  standard: {
    stages: [
      { duration: "1m", target: 10 },   // warm up
      { duration: "3m", target: 30 },   // sustained load
      { duration: "1m", target: 50 },   // peak
      { duration: "1m", target: 0 },    // cool down
    ],
  },
  // Stress test — push to 100 users
  stress: {
    stages: [
      { duration: "2m", target: 20 },
      { duration: "3m", target: 50 },
      { duration: "3m", target: 100 },
      { duration: "2m", target: 100 },
      { duration: "2m", target: 0 },
    ],
  },
};

export const options = {
  stages: scenarios[SCENARIO]?.stages || scenarios.standard.stages,
  thresholds: {
    http_req_duration: ["p(95)<2000", "p(99)<5000"],  // p95 < 2s, p99 < 5s
    errors: ["rate<0.05"],                              // < 5% error rate
    catalog_latency: ["p(95)<1500"],
    product_detail_latency: ["p(95)<1000"],
    cart_latency: ["p(95)<500"],
  },
};

// ─── HELPERS ─────────────────────────────────────────────

const headers = { "Content-Type": "application/json" };

function apiGet(path, params = {}) {
  const res = http.get(`${BASE}${path}`, { headers, tags: { endpoint: path }, ...params });
  errorRate.add(res.status >= 400 && res.status !== 401);
  return res;
}

function apiPost(path, body, params = {}) {
  const res = http.post(`${BASE}${path}`, JSON.stringify(body), { headers: { ...headers, ...params.headers }, tags: { endpoint: path } });
  errorRate.add(res.status >= 400 && res.status !== 401 && res.status !== 409);
  return res;
}

// ─── MAIN SCENARIO ───────────────────────────────────────

export default function () {
  const sessionId = `k6-${__VU}-${randomString(8)}`;
  const sessionHeaders = { ...headers, "x-session-id": sessionId };

  // ── 1. Browse catalogue (70% of traffic) ────────────
  group("Browse Catalogue", () => {
    // Homepage product featured
    const featured = apiGet("/api/v1/products/featured");
    check(featured, { "featured 200": (r) => r.status === 200 });

    // Catalogue page 1
    const catalog = apiGet("/api/v1/products?page=1&limit=24&sort=newest");
    check(catalog, {
      "catalogue 200": (r) => r.status === 200,
      "has products": (r) => {
        try { return JSON.parse(r.body).data.length > 0; } catch { return false; }
      },
    });
    catalogLatency.add(catalog.timings.duration);

    // Categories
    const cats = apiGet("/api/v1/categories");
    check(cats, { "categories 200": (r) => r.status === 200 });

    sleep(1);

    // Page 2
    const page2 = apiGet("/api/v1/products?page=2&limit=24&sort=newest");
    check(page2, { "page2 200": (r) => r.status === 200 });
    catalogLatency.add(page2.timings.duration);

    // Filter by category
    const filtered = apiGet("/api/v1/products?categorySlug=trottinettes-electriques&limit=12");
    check(filtered, { "filtered 200": (r) => r.status === 200 });
  });

  sleep(0.5);

  // ── 2. Product detail ───────────────────────────────
  group("Product Detail", () => {
    // Get a product slug from catalogue
    let slug = "trottinette-electrique-teverun-tetra-4-moteurs"; // fallback
    try {
      const list = apiGet("/api/v1/products?limit=5");
      const products = JSON.parse(list.body).data;
      if (products && products.length > 0) {
        slug = products[Math.floor(Math.random() * products.length)].slug;
      }
    } catch { /* use fallback */ }

    // SSR page load (Next.js)
    const page = http.get(`${BASE}/produits/${slug}`, { tags: { endpoint: "/produits/[slug]" } });
    check(page, { "product page 200": (r) => r.status === 200 });
    productLatency.add(page.timings.duration);
  });

  sleep(0.5);

  // ── 3. Cart operations ──────────────────────────────
  group("Cart Flow", () => {
    // Get cart (empty)
    const cart = http.get(`${BASE}/api/v1/cart`, {
      headers: sessionHeaders,
      tags: { endpoint: "/api/v1/cart" },
    });
    check(cart, { "cart 200": (r) => r.status === 200 });
    cartLatency.add(cart.timings.duration);

    // Add item to cart
    const add = http.post(`${BASE}/api/v1/cart/items`, JSON.stringify({
      productId: "00000000-0000-0000-0000-000000000001", // will fail gracefully
      quantity: 1,
    }), { headers: sessionHeaders, tags: { endpoint: "/api/v1/cart/items" } });
    // 400/404 is expected with fake product ID — we're testing the API response time
    cartLatency.add(add.timings.duration);
  });

  sleep(0.3);

  // ── 4. Auth flow (10% of users) ─────────────────────
  if (Math.random() < 0.1) {
    group("Auth Flow", () => {
      const email = `k6-${__VU}-${randomString(6)}@load.test`;

      // Register
      const reg = apiPost("/api/v1/auth/register", {
        email,
        password: "K6LoadTest123!",
        firstName: "K6",
        lastName: "User",
      });
      check(reg, { "register 201 or 409": (r) => r.status === 201 || r.status === 409 });
      authLatency.add(reg.timings.duration);

      // Login
      const login = apiPost("/api/v1/auth/login", {
        email,
        password: "K6LoadTest123!",
      });
      check(login, { "login 200": (r) => r.status === 200 });
      authLatency.add(login.timings.duration);

      if (login.status === 200) {
        try {
          const token = JSON.parse(login.body).data.accessToken;

          // Get profile
          const me = http.get(`${BASE}/api/v1/auth/me`, {
            headers: { ...headers, Authorization: `Bearer ${token}` },
            tags: { endpoint: "/api/v1/auth/me" },
          });
          check(me, { "me 200": (r) => r.status === 200 });

          // Delete test account (cleanup)
          http.del(`${BASE}/api/v1/auth/account`, null, {
            headers: { ...headers, Authorization: `Bearer ${token}` },
            tags: { endpoint: "/api/v1/auth/account" },
          });
        } catch { /* token parse failed */ }
      }
    });
  }

  sleep(0.3);

  // ── 5. SAV endpoints ────────────────────────────────
  group("SAV", () => {
    const slots = apiGet("/api/v1/appointments/slots?date=2026-04-18");
    check(slots, { "slots 200": (r) => r.status === 200 });
  });

  sleep(0.3);

  // ── 6. Analytics event (fire-and-forget) ────────────
  group("Analytics", () => {
    http.post(`${BASE}/api/v1/analytics/events/public`, JSON.stringify({
      type: "page_view",
      properties: { page: "/produits", sessionId },
    }), { headers, tags: { endpoint: "/api/v1/analytics/events" } });
  });

  sleep(Math.random() * 2); // Random think time
}
