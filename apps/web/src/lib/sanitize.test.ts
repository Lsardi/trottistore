import { describe, it, expect } from "vitest";
import sanitizeHtml from "sanitize-html";

// Same config as in produits/[slug]/page.tsx
function sanitizeProductHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h2", "h3", "h4", "span", "div", "table", "thead", "tbody", "tr", "td", "th", "a", "img"],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      span: ["class"],
      div: ["class"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https"],
    disallowedTagsMode: "discard",
  });
}

describe("XSS sanitization — offensive payloads", () => {
  it("strips <script> tags", () => {
    expect(sanitizeProductHtml('<p>Hello</p><script>alert(1)</script>')).toBe("<p>Hello</p>");
  });

  it("strips <script> with attributes", () => {
    expect(sanitizeProductHtml('<script src="evil.js"></script><p>OK</p>')).toBe("<p>OK</p>");
  });

  it("strips onerror attribute", () => {
    expect(sanitizeProductHtml('<img src=x onerror=alert(1)>')).not.toContain("onerror");
  });

  it("strips onload attribute", () => {
    expect(sanitizeProductHtml('<svg onload=alert(1)>')).not.toContain("onload");
  });

  it("strips onclick attribute", () => {
    expect(sanitizeProductHtml('<div onclick="alert(1)">click</div>')).not.toContain("onclick");
  });

  it("strips javascript: in href", () => {
    const result = sanitizeProductHtml('<a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain("javascript:");
  });

  it("strips data:text/html", () => {
    const result = sanitizeProductHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    expect(result).not.toContain("data:");
  });

  it("strips <iframe>", () => {
    expect(sanitizeProductHtml('<iframe src="evil.com"></iframe>')).toBe("");
  });

  it("strips <object>", () => {
    expect(sanitizeProductHtml('<object data="evil.swf"></object>')).toBe("");
  });

  it("strips <embed>", () => {
    expect(sanitizeProductHtml('<embed src="evil.swf">')).toBe("");
  });

  it("strips <style> tags", () => {
    expect(sanitizeProductHtml('<style>body{display:none}</style><p>OK</p>')).toBe("<p>OK</p>");
  });

  it("strips tab-separated onX (bypass attempt)", () => {
    expect(sanitizeProductHtml('<img src=x\tonerror\t=alert(1)>')).not.toContain("onerror");
  });

  it("strips encoded javascript (bypass attempt)", () => {
    const result = sanitizeProductHtml('<a href="&#106;avascript:alert(1)">x</a>');
    expect(result).not.toContain("javascript");
  });

  it("strips SVG with onload", () => {
    expect(sanitizeProductHtml('<svg/onload=alert(1)>')).not.toContain("onload");
  });

  it("allows safe HTML", () => {
    const safe = '<p>Catégorie : <strong>Freinage</strong> — Type : Trottinette</p>';
    expect(sanitizeProductHtml(safe)).toBe(safe);
  });

  it("allows safe links", () => {
    const safe = '<a href="https://trottistore.fr/produits">voir</a>';
    expect(sanitizeProductHtml(safe)).toContain('href="https://trottistore.fr/produits"');
  });

  it("allows safe images", () => {
    const safe = '<img src="https://trottistore.fr/img.jpg" alt="produit">';
    const result = sanitizeProductHtml(safe);
    expect(result).toContain("src=");
    expect(result).toContain("alt=");
  });
});
