"use client";

import { useState } from "react";
import ConsentCheckbox from "@/components/ConsentCheckbox";

interface NewsletterFormProps {
  source?: string;
}

export default function NewsletterForm({ source = "home" }: NewsletterFormProps) {
  const [email, setEmail] = useState("");
  const [buttonText, setButtonText] = useState("S'INSCRIRE");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !consent || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, consent: true, source }),
      });
      if (res.ok) {
        setEmail("");
        setConsent(false);
        setButtonText("INSCRIT ✓");
      } else {
        setButtonText("ERREUR");
      }
    } catch {
      setButtonText("ERREUR");
    } finally {
      setSubmitting(false);
      setTimeout(() => setButtonText("S'INSCRIRE"), 3000);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minWidth: 0,
        maxWidth: "100%",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 0, minWidth: 0, maxWidth: "100%" }}>
        <input
          type="email"
          required
          placeholder="Votre adresse email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-dark"
          style={{
            flex: "1 1 0",
            minWidth: 0,
            width: 0,
            borderRight: "none",
          }}
        />
        <button
          type="submit"
          disabled={!consent || submitting}
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
