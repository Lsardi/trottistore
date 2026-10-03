import sanitizeHtml from "sanitize-html";

/**
 * Server-safe HTML sanitizer using sanitize-html (no DOM dependency).
 * Whitelist approach: only allow safe tags and attributes.
 */
export function sanitizeProductHtml(html?: string | null): string {
  if (!html) return "";
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

