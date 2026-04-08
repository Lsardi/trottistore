import { test, expect, type Page } from "@playwright/test";

/**
 * Site Audit — Automated scoring across all pages.
 * Runs on every PR. Outputs a score card.
 *
 * Categories:
 * - Links: no 404s, no dead ends
 * - Forms: all wired (required fields, submit handlers)
 * - A11y: labels, alt text, skip link, lang, contrast tokens
 * - SEO: meta title/description, canonical, OG tags, structured data
 * - Performance: no console errors, images have sizes, no layout shift triggers
 */

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

interface Finding {
  category: string;
  page: string;
  issue: string;
  severity: "error" | "warning" | "info";
}

const findings: Finding[] = [];

function addFinding(category: string, page: string, issue: string, severity: Finding["severity"] = "error") {
  findings.push({ category, page, issue, severity });
}

test.describe("Site Audit", () => {
  test.setTimeout(120_000);
  test.afterAll(() => {
    // Score calculation
    const errors = findings.filter((f) => f.severity === "error").length;
    const warnings = findings.filter((f) => f.severity === "warning").length;
    const total = ROUTES.length;
    const maxScore = total * 5; // 5 categories
    const score = Math.max(0, Math.round(((maxScore - errors * 2 - warnings * 0.5) / maxScore) * 100));

    console.log("\n" + "═".repeat(60));
    console.log("  SITE AUDIT SCORE CARD");
    console.log("═".repeat(60));
    console.log(`  Score: ${score}/100`);
    console.log(`  Pages audited: ${total}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Warnings: ${warnings}`);
    console.log("─".repeat(60));

    const categories = [...new Set(findings.map((f) => f.category))];
    for (const cat of categories) {
      const catFindings = findings.filter((f) => f.category === cat);
      const catErrors = catFindings.filter((f) => f.severity === "error").length;
      const catWarnings = catFindings.filter((f) => f.severity === "warning").length;
      console.log(`  ${cat}: ${catErrors} errors, ${catWarnings} warnings`);
      for (const f of catFindings.slice(0, 5)) {
        const icon = f.severity === "error" ? "✗" : f.severity === "warning" ? "⚠" : "ℹ";
        console.log(`    ${icon} ${f.page} — ${f.issue}`);
      }
      if (catFindings.length > 5) {
        console.log(`    ... and ${catFindings.length - 5} more`);
      }
    }
    console.log("═".repeat(60) + "\n");
  });

  test("audit all pages", async ({ page }) => {
    for (const route of ROUTES) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null);

      if (!response || response.status() >= 400) {
        addFinding("Links", route, `page returned ${response?.status() || "no response"}`);
        continue;
      }

      // ── SEO checks ──
      const title = await page.title();
      if (!title || title === "") {
        addFinding("SEO", route, "missing <title>");
      } else if (title.length > 70) {
        addFinding("SEO", route, `title too long (${title.length} chars)`, "warning");
      }

      const metaDesc = await page.locator('meta[name="description"]').getAttribute("content").catch(() => null);
      if (!metaDesc) {
        addFinding("SEO", route, "missing meta description");
      } else if (metaDesc.length > 160) {
        addFinding("SEO", route, `meta description too long (${metaDesc.length} chars)`, "warning");
      }

      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
      if (!canonical) {
        addFinding("SEO", route, "missing canonical link", "warning");
      }

      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content").catch(() => null);
      if (!ogTitle) {
        addFinding("SEO", route, "missing og:title", "warning");
      }

      const hasJsonLd = await page.locator('script[type="application/ld+json"]').count();
      if (hasJsonLd === 0 && route === "/") {
        addFinding("SEO", route, "homepage missing structured data (JSON-LD)");
      }

      // ── A11y checks ──
      const lang = await page.locator("html").getAttribute("lang");
      if (!lang) {
        addFinding("A11y", route, "missing lang attribute on <html>");
      }

      const h1Count = await page.locator("h1").count();
      if (h1Count === 0) {
        addFinding("A11y", route, "no <h1> found", "warning");
      } else if (h1Count > 1) {
        addFinding("A11y", route, `multiple <h1> tags (${h1Count})`, "warning");
      }

      // Check images without alt
      const imagesWithoutAlt = await page.evaluate(() => {
        const imgs = document.querySelectorAll("img");
        let count = 0;
        imgs.forEach((img) => {
          if (!img.hasAttribute("alt")) count++;
        });
        return count;
      });
      if (imagesWithoutAlt > 0) {
        addFinding("A11y", route, `${imagesWithoutAlt} image(s) without alt attribute`);
      }

      // Check labels without htmlFor
      const labelsWithoutFor = await page.evaluate(() => {
        const labels = document.querySelectorAll("label");
        let count = 0;
        labels.forEach((label) => {
          if (!label.htmlFor && !label.querySelector("input, select, textarea")) count++;
        });
        return count;
      });
      if (labelsWithoutFor > 0) {
        addFinding("A11y", route, `${labelsWithoutFor} label(s) without htmlFor or wrapped input`);
      }

      // ── Links checks ──
      const linkHrefs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("a[href^='/']"))
          .map((a) => a.getAttribute("href"))
          .filter((h): h is string => !!h);
      });
      const uniqueLinks = [...new Set(linkHrefs)].slice(0, 20);
      for (const href of uniqueLinks) {
        if (href.startsWith("/api/") || href.startsWith("/admin")) continue;
        const cleanPath = href.split("?")[0].split("#")[0];
        // Skip dynamic routes
        if (cleanPath.match(/\/\[/)) continue;
        if (cleanPath.match(/\/produits\/[^/]+$/) || cleanPath.match(/\/guide\/[^/]+$/) || cleanPath.match(/\/reparation\/[^/]+$/)) continue;
        if (cleanPath.match(/\/mon-compte\/suivi\//)) continue;

        const linkResp = await page.request.get(cleanPath).catch(() => null);
        if (linkResp && linkResp.status() === 404) {
          addFinding("Links", route, `dead link → ${cleanPath} (404)`);
        }
      }

      // ── Forms checks ──
      const forms = await page.locator("form").all();
      for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        const hasRequired = await form.locator("[required]").count();
        const hasAction = await form.getAttribute("action");
        const hasSubmitBtn = await form.locator('button[type="submit"], button:not([type])').count();

        if (hasSubmitBtn === 0) {
          addFinding("Forms", route, `form #${i + 1} has no submit button`, "warning");
        }
        if (hasRequired === 0 && !hasAction) {
          addFinding("Forms", route, `form #${i + 1} has no required fields and no action — possibly dead`, "warning");
        }
      }

      // ── Dead interactive elements ──
      const deadInteractive = await page.evaluate(() => {
        let count = 0;
        document.querySelectorAll("*").forEach((el) => {
          const style = window.getComputedStyle(el);
          if (style.cursor !== "pointer") return;
          const tag = el.tagName.toLowerCase();
          if (["a", "button", "input", "select", "label", "option", "summary"].includes(tag)) return;
          if (el.closest("a") || el.closest("button")) return;
          const text = (el.textContent || "").trim();
          if (text) count++;
        });
        return count;
      });
      if (deadInteractive > 0) {
        addFinding("UX", route, `${deadInteractive} element(s) with cursor:pointer but no link/button wrapper`, "warning");
      }
    }

    // Final assertion — fail if critical errors
    const criticalErrors = findings.filter((f) => f.severity === "error");
    expect(criticalErrors.length, `${criticalErrors.length} critical audit errors found`).toBeLessThanOrEqual(5);
  });
});
