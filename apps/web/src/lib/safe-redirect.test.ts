import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("same-origin redirect paths", () => {
  it.each(["/\\evil.com", "//evil.com", "https://evil.com", "//[", "javascript:alert(1)", "evil.com"])('rejects %s', (path) => {
    expect(safeRedirectPath(path, "https://trottistore.fr")).toBe("/mon-compte");
  });
  it("preserves relative paths, query strings and anchors", () => {
    expect(safeRedirectPath("/checkout?mode=pickup#paiement", "https://trottistore.fr")).toBe("/checkout?mode=pickup#paiement");
  });
});
