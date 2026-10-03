import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
let storage: Map<string, string>;
const response = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  storage = new Map([["accessToken", "expired"], ["trottistore-session-id", "session"]]);
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { cookie: "" });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("authentication refresh at checkout", () => {
  it("refreshes /auth/me then retries with the new token", async () => {
    fetchMock.mockResolvedValueOnce(response(401, {}))
      .mockResolvedValueOnce(response(200, { data: { accessToken: "fresh" } }))
      .mockResolvedValueOnce(response(200, { success: true, data: { user: { id: "user" } } }));
    const { authApi } = await import("./api");
    expect((await authApi.me()).data.id).toBe("user");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/auth/refresh");
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer fresh");
    expect(storage.get("accessToken")).toBe("fresh");
  });

  it("keeps the token on a refresh network failure", async () => {
    fetchMock.mockResolvedValueOnce(response(401, {})).mockRejectedValueOnce(new TypeError("network"));
    const { authApi } = await import("./api");
    await expect(authApi.me()).rejects.toThrow("network");
    expect(storage.get("accessToken")).toBe("expired");
  });

  it("keeps the token on a temporary refresh server error", async () => {
    fetchMock.mockResolvedValueOnce(response(401, {})).mockResolvedValueOnce(response(503, {}));
    const { authApi } = await import("./api");
    await expect(authApi.me()).rejects.toMatchObject({ status: 503 });
    expect(storage.get("accessToken")).toBe("expired");
  });

  it("removes the token only after explicit refresh refusal", async () => {
    fetchMock.mockResolvedValueOnce(response(401, {})).mockResolvedValueOnce(response(403, {}));
    const { authApi } = await import("./api");
    await expect(authApi.me()).rejects.toMatchObject({ status: 401 });
    expect(storage.has("accessToken")).toBe(false);
    expect(document.cookie).toContain("max-age=0");
  });
});


describe("cart line identity", () => {
  it("sends variantId for update and delete", async () => {
    fetchMock.mockImplementation(async () => response(200, { success: true, data: { items: [] } }));
    const { cartApi } = await import("./api");
    await cartApi.updateItem("product", { quantity: 2, variantId: "variant" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ quantity: 2, variantId: "variant" });
    await cartApi.removeItem("product", "variant");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/cart/items/product?variantId=variant");
  });
});
