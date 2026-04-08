"use client";

import { useState } from "react";
import ConsentCheckbox from "@/components/ConsentCheckbox";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [buttonText, setButtonText] = useState("S'INSCRIRE");
  const [consent, setConsent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !consent) return;

    try {
      await fetch("/api/v1/analytics/events/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: [
            {
              type: "diagnostic_category_selected",
              properties: { action: "newsletter_signup", email: normalizedEmail },
            },
          ],
        }),
      });
    } catch {
      // Keep UX non-blocking on tracking errors.
    }

    setEmail("");
    setConsent(false);
    setButtonText("INSCRIT ✓");
    setTimeout(() => setButtonText("S'INSCRIRE"), 3000);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minWidth: 280,
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 0 }}>
        <input
          type="email"
          required
          placeholder="Votre adresse email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-dark"
          style={{
            flex: 1,
            borderRight: "none",
          }}
        />
        <button
          type="submit"
          disabled={!consent}
          className="btn-neon disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ whiteSpace: "nowrap" }}
        >
          {buttonText}
        </button>
      </div>
      <ConsentCheckbox checked={consent} onChange={setConsent} id="newsletter-consent" />
    </form>
  );
}
