/**
 * Regression tests for email template HTML escaping (CL-03).
 *
 * Every template that interpolates user-controlled input MUST NOT render
 * that input as executable HTML. These tests inject known-bad payloads
 * and assert they come out escaped.
 */
import { describe, expect, it } from "vitest";
import {
  orderConfirmationEmail,
  orderShippedEmail,
  passwordResetEmail,
  staffInvitationEmail,
  welcomeEmail,
} from "./templates.js";

const XSS_PAYLOAD = "<script>alert('xss')</script>";
const XSS_ATTR_PAYLOAD = `" onerror="alert(1)`;
const XSS_IMG_PAYLOAD = "<img src=x onerror=alert(1)>";

describe("email templates — XSS hardening (CL-03)", () => {
  describe("orderConfirmationEmail", () => {
    it("escapes customerName with <script> payload", () => {
      const { html } = orderConfirmationEmail({
        orderNumber: 42,
        customerName: XSS_PAYLOAD,
        items: [{ name: "Test", quantity: 1, unitPrice: "10" }],
        subtotalHt: "10",
        shippingCost: "5",
        totalTtc: "15",
        paymentMethod: "CARD",
        shippingAddress: "1 rue Test",
      });
      expect(html).not.toContain(XSS_PAYLOAD);
      expect(html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
    });

    it("escapes product name with <img onerror> payload", () => {
      const { html } = orderConfirmationEmail({
        orderNumber: 42,
        customerName: "Alice",
        items: [{ name: XSS_IMG_PAYLOAD, quantity: 1, unitPrice: "10" }],
        subtotalHt: "10",
        shippingCost: "5",
        totalTtc: "15",
        paymentMethod: "CARD",
        shippingAddress: "1 rue Test",
      });
      expect(html).not.toContain("<img src=x onerror=alert(1)>");
      expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    });

    it("escapes shippingAddress with attribute-breaking payload", () => {
      const { html } = orderConfirmationEmail({
        orderNumber: 42,
        customerName: "Alice",
        items: [{ name: "Test", quantity: 1, unitPrice: "10" }],
        subtotalHt: "10",
        shippingCost: "5",
        totalTtc: "15",
        paymentMethod: "CARD",
        shippingAddress: XSS_ATTR_PAYLOAD,
      });
      expect(html).not.toContain('" onerror="');
      expect(html).toContain("&quot; onerror=&quot;");
    });

    it("escapes ampersand & and single quote ' in all fields", () => {
      const { html } = orderConfirmationEmail({
        orderNumber: 42,
        customerName: "Rock & Roll's Friend",
        items: [{ name: "Cable 5m & extra", quantity: 1, unitPrice: "10" }],
        subtotalHt: "10",
        shippingCost: "5",
        totalTtc: "15",
        paymentMethod: "CARD",
        shippingAddress: "O'Neil Street",
      });
      expect(html).toContain("Rock &amp; Roll&#39;s Friend");
      expect(html).toContain("Cable 5m &amp; extra");
      expect(html).toContain("O&#39;Neil Street");
    });
  });

  describe("orderShippedEmail", () => {
    it("escapes customerName, trackingNumber, shippingAddress", () => {
      const { html } = orderShippedEmail({
        orderNumber: 42,
        customerName: XSS_PAYLOAD,
        trackingNumber: "FR<script>alert(1)</script>",
        shippingAddress: XSS_IMG_PAYLOAD,
      });
      expect(html).not.toContain("<script>alert");
      expect(html).not.toContain("<img src=x onerror");
      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain("&lt;img");
    });

    it("works without optional shippingAddress", () => {
      const { html } = orderShippedEmail({
        orderNumber: 42,
        customerName: "Alice",
        trackingNumber: "FR1234",
      });
      expect(html).toContain("Alice");
      expect(html).toContain("FR1234");
    });
  });

  describe("passwordResetEmail", () => {
    it("escapes name but preserves resetUrl as-is (server-constructed, safe)", () => {
      const url = "https://trottistore.fr/reset-password?token=abc123-def456";
      const { html } = passwordResetEmail(XSS_PAYLOAD, url);
      expect(html).not.toContain("<script>alert('xss')</script>");
      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain(url);
    });
  });

  describe("staffInvitationEmail", () => {
    it("escapes name and role", () => {
      const { html } = staffInvitationEmail(
        XSS_PAYLOAD,
        "ADMIN<script>",
        "https://trottistore.fr/reset-password?token=xxx",
      );
      expect(html).not.toContain("<script>alert");
      expect(html).not.toContain("ADMIN<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("welcomeEmail", () => {
    it("escapes name", () => {
      const { html } = welcomeEmail(XSS_PAYLOAD);
      expect(html).not.toContain("<script>alert('xss')</script>");
      expect(html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
    });
  });

  describe("empty fields (safety)", () => {
    it("does not throw on empty strings", () => {
      const { html } = orderConfirmationEmail({
        orderNumber: 42,
        customerName: "",
        items: [],
        subtotalHt: "0",
        shippingCost: "0",
        totalTtc: "0",
        paymentMethod: "CARD",
        shippingAddress: "",
      });
      expect(html).toContain("<h2");
      expect(html).toContain("Merci pour votre commande");
    });
  });
});
