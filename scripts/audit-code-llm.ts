#!/usr/bin/env tsx
/**
 * Code audit using a local LLM via Ollama.
 *
 * Walks the source tree by domain, batches files into chunks that fit the
 * model context, asks the model for findings (security, perf, tech debt,
 * smells, a11y), and writes a Markdown report.
 *
 * Usage:
 *   pnpm tsx scripts/audit-code-llm.ts                      # full audit
 *   pnpm tsx scripts/audit-code-llm.ts --domain services/ecommerce
 *   OLLAMA_MODEL=qwen2.5:7b pnpm tsx scripts/audit-code-llm.ts
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";
const OUT = join(ROOT, "AUDIT_LOCAL_LLM.md");

// Domains to audit. Order matters — report sections appear in this order.
const DOMAINS = [
  "apps/web",
  "services/ecommerce",
  "services/crm",
  "services/sav",
  "services/analytics",
  "packages/shared",
  "packages/database",
];

// Hard limit on chars per batch (≈ 4 chars/token → ~12K tokens, leaves
// headroom for prompt + response in a 32K context window).
const MAX_BATCH_CHARS = 15_000;
const MAX_FILE_CHARS = 8_000;

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".next",
  ".turbo",
  "coverage",
  "build",
  ".git",
]);

const EXTS = [".ts", ".tsx", ".js", ".jsx"];

async function walk(dir: string): Promise<string[]> {
  let out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".") continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      out = out.concat(await walk(p));
    } else if (EXTS.some((x) => e.name.endsWith(x))) {
      out.push(p);
    }
  }
  return out;
}

interface Batch {
  files: { path: string; content: string }[];
  chars: number;
}

async function buildBatches(domain: string): Promise<Batch[]> {
  const files = await walk(join(ROOT, domain));
  const batches: Batch[] = [];
  let current: Batch = { files: [], chars: 0 };

  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const content = raw.length > MAX_FILE_CHARS
      ? raw.slice(0, MAX_FILE_CHARS) + "\n// … (truncated)"
      : raw;
    const rel = relative(ROOT, file);

    if (current.chars + content.length > MAX_BATCH_CHARS && current.files.length > 0) {
      batches.push(current);
      current = { files: [], chars: 0 };
    }
    current.files.push({ path: rel, content });
    current.chars += content.length;
  }
  if (current.files.length > 0) batches.push(current);
  return batches;
}

const SYSTEM_PROMPT = `Tu es un auditeur senior de code TypeScript / Node.js / Next.js.
Pour le lot de fichiers fourni, identifie des problèmes RÉELS et VÉRIFIABLES dans ces catégories :
- security  : XSS, injection, secrets en clair, mauvaise gestion auth/JWT/CSRF, validation manquante
- perf      : N+1, requêtes Prisma non optimisées, re-renders inutiles, bundle lourd, mémoire
- techdebt  : duplication, abstractions cassées, types any, dead code, TODOs critiques
- smell     : naming, taille de fonction, complexité, side effects cachés
- a11y      : labels, aria, contraste, focus management (uniquement pour apps/web)
- bug       : logique incorrecte, edge cases ratés, race conditions

Réponds UNIQUEMENT en JSON valide sans texte avant/après :
{"findings": [{"file": "<chemin>", "line": <num | null>, "severity": "low|medium|high|critical", "category": "security|perf|techdebt|smell|a11y|bug", "title": "<titre court>", "detail": "<explication 1-2 phrases>", "fix": "<correctif suggéré>"}]}

Si tu ne trouves rien : {"findings": []}. N'invente rien. Sois précis et concis.`;

interface Finding {
  file: string;
  line: number | null;
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  title: string;
  detail: string;
  fix: string;
}

async function callOllamaOnce(userPrompt: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt: userPrompt,
      system: SYSTEM_PROMPT,
      stream: false,
      format: "json",
      keep_alive: "30m",
      options: { temperature: 0.1, num_ctx: 32768, num_predict: 2000 },
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  return await res.json();
}

async function callOllama(userPrompt: string): Promise<Finding[]> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 15 * 60 * 1000); // 15 min hard limit
    try {
      const data = (await callOllamaOnce(userPrompt, ctrl.signal)) as { response?: string };
      clearTimeout(timeout);
      return parseFindings(data.response || "");
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err as Error;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }
  throw lastErr || new Error("unknown");
}

function parseFindings(raw: string): Finding[] {
  const text = raw.trim();
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.findings)) return parsed.findings;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const parsed = JSON.parse(m[0]);
        if (Array.isArray(parsed.findings)) return parsed.findings;
      } catch {}
    }
  }
  return [];
}

function formatBatchPrompt(batch: Batch): string {
  const blocks = batch.files
    .map((f) => `### FILE: ${f.path}\n\`\`\`ts\n${f.content}\n\`\`\``)
    .join("\n\n");
  return `Audite ces ${batch.files.length} fichiers :\n\n${blocks}`;
}

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function renderReport(byDomain: Record<string, Finding[]>): string {
  const lines: string[] = [];
  const ts = new Date().toISOString();
  const total = Object.values(byDomain).reduce((s, f) => s + f.length, 0);
  lines.push(`# Audit code local LLM`);
  lines.push("");
  lines.push(`Généré le ${ts} avec \`${MODEL}\` via Ollama.`);
  lines.push("");
  lines.push(`**Total findings : ${total}**`);
  lines.push("");

  // Summary table
  lines.push("## Résumé par domaine");
  lines.push("");
  lines.push("| Domaine | Critical | High | Medium | Low | Total |");
  lines.push("|---|---:|---:|---:|---:|---:|");
  for (const [d, fs] of Object.entries(byDomain)) {
    const c = fs.filter((f) => f.severity === "critical").length;
    const h = fs.filter((f) => f.severity === "high").length;
    const m = fs.filter((f) => f.severity === "medium").length;
    const l = fs.filter((f) => f.severity === "low").length;
    lines.push(`| ${d} | ${c} | ${h} | ${m} | ${l} | ${fs.length} |`);
  }
  lines.push("");

  for (const [domain, findings] of Object.entries(byDomain)) {
    lines.push(`## ${domain}`);
    lines.push("");
    if (findings.length === 0) {
      lines.push("_Aucun finding._");
      lines.push("");
      continue;
    }
    const sorted = [...findings].sort(
      (a, b) =>
        (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9),
    );
    for (const f of sorted) {
      const where = f.line ? `${f.file}:${f.line}` : f.file;
      lines.push(`### [${f.severity.toUpperCase()}] ${f.category} — ${f.title}`);
      lines.push(`\`${where}\``);
      lines.push("");
      lines.push(f.detail);
      if (f.fix) {
        lines.push("");
        lines.push(`**Fix :** ${f.fix}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

async function ensureOllama() {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { models?: { name: string }[] };
    const has = j.models?.some((m) => m.name === MODEL || m.name.startsWith(MODEL));
    if (!has) {
      console.error(`✗ Modèle ${MODEL} non trouvé. Pull avec: ollama pull ${MODEL}`);
      process.exit(1);
    }
  } catch {
    console.error("✗ Ollama injoignable sur " + OLLAMA_URL);
    process.exit(1);
  }
}

function fmtTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function bar(pct: number, width = 24): string {
  const filled = Math.round((pct / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

interface Progress {
  totalBatches: number;
  doneBatches: number;
  startMs: number;
  domain: string;
  domainBatchIdx: number;
  domainBatchCount: number;
  batchStartMs: number;
  totalFindings: number;
  isTTY: boolean;
}

function renderProgress(p: Progress, label: string): string {
  const pct = (p.doneBatches / p.totalBatches) * 100;
  const elapsed = (Date.now() - p.startMs) / 1000;
  const avgPerBatch = p.doneBatches > 0 ? elapsed / p.doneBatches : 0;
  const eta = avgPerBatch > 0 ? avgPerBatch * (p.totalBatches - p.doneBatches) : NaN;
  const batchElapsed = (Date.now() - p.batchStartMs) / 1000;
  return (
    `[${bar(pct)}] ${pct.toFixed(0).padStart(3)}% ` +
    `${String(p.doneBatches).padStart(2)}/${p.totalBatches} ` +
    `│ ${p.domain} (${p.domainBatchIdx}/${p.domainBatchCount}) ` +
    `│ ${label} ${fmtTime(batchElapsed)} ` +
    `│ ⏱ ${fmtTime(elapsed)} ETA ${fmtTime(eta)} ` +
    `│ ✚${p.totalFindings}`
  );
}

function clearLine() {
  if (process.stdout.isTTY) process.stdout.write("\r\x1b[2K");
}

function paint(p: Progress, label: string) {
  const line = renderProgress(p, label);
  if (p.isTTY) {
    process.stdout.write("\r\x1b[2K" + line);
  } else {
    // Non-TTY (e.g. log file): only print on label change to keep log readable
    process.stdout.write(line + "\n");
  }
}

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

async function main() {
  const argDomain = (() => {
    const i = process.argv.indexOf("--domain");
    return i >= 0 ? process.argv[i + 1] : null;
  })();
  const domains = argDomain ? [argDomain] : DOMAINS;

  console.log(`Audit code LLM — modèle: ${MODEL}`);
  await ensureOllama();

  // Warmup
  process.stdout.write("Warmup modèle … ");
  const tw = Date.now();
  try {
    await callOllamaOnce("Réponds: {\"findings\": []}");
    console.log(`OK (${((Date.now() - tw) / 1000).toFixed(1)}s)`);
  } catch (e) {
    console.log(`échec warmup (${(e as Error).message}) — on continue`);
  }

  const checkpointPath = join(ROOT, ".audit-llm-checkpoint.json");
  let byDomain: Record<string, Finding[]> = {};
  try {
    const prev = await readFile(checkpointPath, "utf8");
    byDomain = JSON.parse(prev);
    console.log(`Checkpoint trouvé: ${Object.keys(byDomain).length} domaines déjà traités.`);
  } catch {}

  // Pré-calcul de tous les batches pour avoir un total fiable.
  console.log("Indexation des fichiers …");
  const plan: { domain: string; batches: Batch[] }[] = [];
  for (const domain of domains) {
    plan.push({ domain, batches: await buildBatches(domain) });
  }
  const totalBatches = plan.reduce((s, p) => s + p.batches.length, 0);
  const totalFiles = plan.reduce(
    (s, p) => s + p.batches.reduce((ss, b) => ss + b.files.length, 0),
    0,
  );
  console.log(`${totalFiles} fichiers, ${totalBatches} batches sur ${plan.length} domaines.\n`);

  const prog: Progress = {
    totalBatches,
    doneBatches: 0,
    startMs: Date.now(),
    domain: "",
    domainBatchIdx: 0,
    domainBatchCount: 0,
    batchStartMs: Date.now(),
    totalFindings: 0,
    isTTY: !!process.stdout.isTTY,
  };

  for (const { domain, batches } of plan) {
    prog.domain = domain;
    prog.domainBatchCount = batches.length;
    if (batches.length === 0) {
      byDomain[domain] = [];
      await writeFile(checkpointPath, JSON.stringify(byDomain, null, 2), "utf8");
      continue;
    }
    const all: Finding[] = [];
    for (let i = 0; i < batches.length; i++) {
      prog.domainBatchIdx = i + 1;
      prog.batchStartMs = Date.now();
      const b = batches[i];

      // Spinner: redraw progress line every 200ms (TTY only) while the LLM call runs.
      // In non-TTY mode (log file), we tick once every 10s to keep the log readable.
      let tick = 0;
      const tickMs = prog.isTTY ? 200 : 10_000;
      const interval = setInterval(() => {
        paint(prog, `${SPINNER[tick++ % SPINNER.length]} ${b.files.length}f/${(b.chars / 1000).toFixed(0)}K`);
      }, tickMs);
      paint(prog, `⠋ ${b.files.length}f/${(b.chars / 1000).toFixed(0)}K`);

      try {
        const findings = await callOllama(formatBatchPrompt(b));
        all.push(...findings);
        prog.totalFindings += findings.length;
        clearInterval(interval);
        clearLine();
        const took = ((Date.now() - prog.batchStartMs) / 1000).toFixed(1);
        process.stdout.write(
          `  ✓ ${domain} batch ${i + 1}/${batches.length}: ${findings.length} findings (${took}s)\n`,
        );
      } catch (err) {
        clearInterval(interval);
        clearLine();
        process.stdout.write(
          `  ✗ ${domain} batch ${i + 1}/${batches.length}: ${(err as Error).message}\n`,
        );
      }
      prog.doneBatches++;
      paint(prog, "next");
    }
    byDomain[domain] = all;
    await writeFile(checkpointPath, JSON.stringify(byDomain, null, 2), "utf8");
  }

  clearLine();
  const md = renderReport(byDomain);
  await writeFile(OUT, md, "utf8");
  const total = (Date.now() - prog.startMs) / 1000;
  console.log(
    `\n✓ Rapport écrit : ${relative(ROOT, OUT)} — ${prog.totalFindings} findings en ${fmtTime(total)}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
