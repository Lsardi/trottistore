#!/usr/bin/env tsx
/**
 * LLM-powered site audit using Ollama (local, free, no API tokens).
 *
 * Usage:
 *   pnpm audit:llm                    # Audit all pages
 *   pnpm audit:llm -- --page /pro     # Audit a single page
 *
 * Requirements:
 *   - Ollama running locally (brew services start ollama)
 *   - Model pulled (ollama pull qwen2.5-coder:7b)
 *   - Dev server running (pnpm dev)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";

const ROUTES = [
  "/",
  "/produits",
  "/reparation",
  "/diagnostic",
  "/quiz",
  "/compatibilite",
  "/pro",
  "/urgence",
  "/atelier",
  "/avis",
  "/guide",
  "/panier",
  "/mentions-legales",
  "/cgv",
  "/politique-confidentialite",
  "/cookies",
];

interface PageAudit {
  route: string;
  scores: {
    seo: number;
    accessibility: number;
    copywriting: number;
    ux: number;
    overall: number;
  };
  findings: string[];
  suggestions: string[];
}

async function fetchPageHtml(route: string): Promise<string> {
  const res = await fetch(`${BASE_URL}${route}`);
  if (!res.ok) return `<!-- ERROR: ${res.status} -->`;
  const html = await res.text();
  // Strip scripts and styles to reduce token usage, keep structure
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 12000); // Limit to ~12k chars (~3k tokens)
}

async function auditWithOllama(route: string, html: string): Promise<PageAudit> {
  const prompt = `Tu es un auditeur web expert. Analyse cette page HTML d'un site e-commerce français (trottinettes électriques).

Page: ${route}

HTML (tronqué):
${html}

Évalue sur 10 chaque catégorie et liste les problèmes trouvés. Réponds UNIQUEMENT en JSON valide, sans texte avant ou après:

{
  "seo": <score 0-10>,
  "accessibility": <score 0-10>,
  "copywriting": <score 0-10>,
  "ux": <score 0-10>,
  "findings": ["problème 1", "problème 2", ...],
  "suggestions": ["suggestion 1", "suggestion 2", ...]
}

Critères:
- SEO: meta title/description présents et pertinents, H1 unique, alt sur images, données structurées
- Accessibilité: labels sur inputs, lang="fr", hiérarchie Hn, contrastes, skip link
- Copywriting: textes clairs et engageants, CTA actionnables, ton cohérent, pas de fautes
- UX: navigation claire, CTA visible, pas de dead ends, feedback utilisateur`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 1000 },
      }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);

    const data = await res.json();
    const response = data.response || "";

    // Extract JSON from response (model might add markdown fences)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`  ⚠ Could not parse JSON for ${route}`);
      return {
        route,
        scores: { seo: 0, accessibility: 0, copywriting: 0, ux: 0, overall: 0 },
        findings: ["Failed to parse LLM response"],
        suggestions: [],
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const scores = {
      seo: Math.min(10, Math.max(0, parsed.seo || 0)),
      accessibility: Math.min(10, Math.max(0, parsed.accessibility || 0)),
      copywriting: Math.min(10, Math.max(0, parsed.copywriting || 0)),
      ux: Math.min(10, Math.max(0, parsed.ux || 0)),
      overall: 0,
    };
    scores.overall = Math.round((scores.seo + scores.accessibility + scores.copywriting + scores.ux) / 4 * 10) / 10;

    return {
      route,
      scores,
      findings: Array.isArray(parsed.findings) ? parsed.findings.slice(0, 5) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
    };
  } catch (err) {
    console.error(`  ✗ Error auditing ${route}:`, (err as Error).message);
    return {
      route,
      scores: { seo: 0, accessibility: 0, copywriting: 0, ux: 0, overall: 0 },
      findings: [`Audit failed: ${(err as Error).message}`],
      suggestions: [],
    };
  }
}

async function main() {
  const singlePage = process.argv.find((a) => a === "--page");
  const pageArg = singlePage ? process.argv[process.argv.indexOf("--page") + 1] : null;
  const routes = pageArg ? [pageArg] : ROUTES;

  console.log("═".repeat(60));
  console.log("  LLM SITE AUDIT — TrottiStore");
  console.log(`  Model: ${MODEL} | Pages: ${routes.length}`);
  console.log("═".repeat(60));

  // Check Ollama is running
  try {
    await fetch(`${OLLAMA_URL}/api/tags`);
  } catch {
    console.error("✗ Ollama not running. Start it with: brew services start ollama");
    process.exit(1);
  }

  // Check dev server
  try {
    const res = await fetch(BASE_URL);
    if (!res.ok) throw new Error(`${res.status}`);
  } catch {
    console.error(`✗ Dev server not responding at ${BASE_URL}. Run: pnpm dev`);
    process.exit(1);
  }

  const results: PageAudit[] = [];

  for (const route of routes) {
    process.stdout.write(`\n  Auditing ${route}...`);
    const html = await fetchPageHtml(route);
    const audit = await auditWithOllama(route, html);
    results.push(audit);
    process.stdout.write(` ${audit.scores.overall}/10\n`);
  }

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("  SCORE CARD");
  console.log("═".repeat(60));
  console.log(
    "  " +
      ["Page".padEnd(25), "SEO", "A11y", "Copy", "UX", "AVG"].join("  ")
  );
  console.log("─".repeat(60));

  let totalSeo = 0, totalA11y = 0, totalCopy = 0, totalUx = 0;

  for (const r of results) {
    totalSeo += r.scores.seo;
    totalA11y += r.scores.accessibility;
    totalCopy += r.scores.copywriting;
    totalUx += r.scores.ux;
    console.log(
      "  " +
        [
          r.route.padEnd(25),
          String(r.scores.seo).padStart(3),
          String(r.scores.accessibility).padStart(4),
          String(r.scores.copywriting).padStart(4),
          String(r.scores.ux).padStart(3),
          String(r.scores.overall).padStart(4),
        ].join("  ")
    );
  }

  const n = results.length || 1;
  const avgOverall = Math.round(((totalSeo + totalA11y + totalCopy + totalUx) / (n * 4)) * 10) / 10;

  console.log("─".repeat(60));
  console.log(
    "  " +
      [
        "AVERAGE".padEnd(25),
        String(Math.round(totalSeo / n * 10) / 10).padStart(3),
        String(Math.round(totalA11y / n * 10) / 10).padStart(4),
        String(Math.round(totalCopy / n * 10) / 10).padStart(4),
        String(Math.round(totalUx / n * 10) / 10).padStart(3),
        String(avgOverall).padStart(4),
      ].join("  ")
  );
  console.log("═".repeat(60));

  // Top findings
  const allFindings = results.flatMap((r) => r.findings.map((f) => `${r.route}: ${f}`));
  if (allFindings.length > 0) {
    console.log("\n  TOP FINDINGS:");
    allFindings.slice(0, 15).forEach((f) => console.log(`    ✗ ${f}`));
  }

  const allSuggestions = results.flatMap((r) => r.suggestions.map((s) => `${r.route}: ${s}`));
  if (allSuggestions.length > 0) {
    console.log("\n  TOP SUGGESTIONS:");
    allSuggestions.slice(0, 10).forEach((s) => console.log(`    → ${s}`));
  }

  console.log(`\n  Global score: ${avgOverall}/10`);
  console.log("═".repeat(60) + "\n");
}

main().catch(console.error);
