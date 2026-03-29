import autocannon from "autocannon";

const BASE_URL = process.env.LOAD_TEST_URL || "http://localhost:3001";

interface TestScenario {
  name: string;
  url: string;
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
  duration?: number;
  connections?: number;
  expectedRps?: number;
}

const scenarios: TestScenario[] = [
  {
    name: "GET /health (baseline)",
    url: "/health",
    duration: 10,
    connections: 10,
    expectedRps: 1000,
  },
  {
    name: "GET /api/v1/products (catalogue)",
    url: "/api/v1/products?page=1&limit=24",
    duration: 10,
    connections: 20,
    expectedRps: 100,
  },
  {
    name: "GET /api/v1/products/:slug (product detail)",
    url: "/api/v1/products/test-product",
    duration: 10,
    connections: 20,
    expectedRps: 200,
  },
  {
    name: "GET /api/v1/categories",
    url: "/api/v1/categories",
    duration: 10,
    connections: 10,
    expectedRps: 500,
  },
  {
    name: "POST /api/v1/auth/login (auth stress)",
    url: "/api/v1/auth/login",
    method: "POST",
    body: JSON.stringify({ email: "test@test.com", password: "wrong" }),
    headers: { "content-type": "application/json" },
    duration: 10,
    connections: 10,
    expectedRps: 50,
  },
];

async function runScenario(scenario: TestScenario): Promise<{
  name: string;
  rps: number;
  latencyAvg: number;
  latencyP99: number;
  errors: number;
  timeouts: number;
  pass: boolean;
}> {
  return new Promise((resolve) => {
    const instance = autocannon({
      url: `${BASE_URL}${scenario.url}`,
      method: scenario.method || "GET",
      body: scenario.body,
      headers: scenario.headers,
      duration: scenario.duration || 10,
      connections: scenario.connections || 10,
      timeout: 5,
    });

    autocannon.track(instance, { renderProgressBar: false });

    instance.on("done", (result) => {
      resolve({
        name: scenario.name,
        rps: Math.round(result.requests.average),
        latencyAvg: Math.round(result.latency.average * 100) / 100,
        latencyP99: Math.round(result.latency.p99 * 100) / 100,
        errors: result.errors,
        timeouts: result.timeouts,
        pass: result.requests.average >= (scenario.expectedRps || 0),
      });
    });
  });
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  LOAD TEST — TrottiStore API");
  console.log(`  Target: ${BASE_URL}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const results = [];

  for (const scenario of scenarios) {
    console.log(`Running: ${scenario.name}...`);
    const result = await runScenario(scenario);
    results.push(result);

    const status = result.pass ? "PASS" : "FAIL";
    console.log(
      `  ${status} — ${result.rps} req/s | avg ${result.latencyAvg}ms | p99 ${result.latencyP99}ms | errors: ${result.errors}\n`,
    );
  }

  console.log(
    "\n═══════════════════════════════════════════════════════════",
  );
  console.log("  RESULTS SUMMARY");
  console.log(
    "═══════════════════════════════════════════════════════════",
  );
  console.log("");
  console.log(
    "  Scenario                          RPS    Avg(ms)  P99(ms)  Status",
  );
  console.log(
    "  ─────────────────────────────────  ─────  ───────  ───────  ──────",
  );

  for (const r of results) {
    const name = r.name.padEnd(35);
    const rps = String(r.rps).padStart(5);
    const avg = String(r.latencyAvg).padStart(7);
    const p99 = String(r.latencyP99).padStart(7);
    const status = r.pass ? "PASS" : "FAIL";
    console.log(`  ${name}  ${rps}  ${avg}  ${p99}  ${status}`);
  }

  const allPass = results.every((r) => r.pass);
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

  console.log("");
  console.log(`  Total errors: ${totalErrors}`);
  console.log(`  Overall: ${allPass ? "ALL PASS" : "SOME FAILURES"}`);
  console.log(
    "═══════════════════════════════════════════════════════════\n",
  );

  if (!allPass) process.exit(1);
}

main();
