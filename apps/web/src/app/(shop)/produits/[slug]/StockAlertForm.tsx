"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { stockAlertsApi } from "@/lib/api";

export default function StockAlertForm({
  productId,
  variantId,
}: {
  productId: string;
  variantId?: string;
}) {
  const [alertEmail, setAlertEmail] = useState("");
  const [alertSent, setAlertSent] = useState(false);
  const [alertSubmitting, setAlertSubmitting] = useState(false);
  const [alertError, setAlertError] = useState("");

  return (
    <div>
      <div
        className="w-full h-12 font-mono text-xs uppercase tracking-wider flex items-center justify-center mb-3"
        style={{ backgroundColor: "var(--color-surface-2)", color: "var(--color-text-dim)", border: "1px solid var(--color-border)" }}
      >
        RUPTURE DE STOCK
      </div>
      {alertSent ? (
        <div
          className="flex items-center gap-2 p-3"
          style={{ backgroundColor: "rgba(0, 255, 209, 0.08)", border: "1px solid rgba(0, 255, 209, 0.2)" }}
        >
          <Bell style={{ width: 16, height: 16, color: "var(--color-neon)" }} />
          <p className="font-mono text-xs" style={{ color: "var(--color-neon)" }}>
            Vous serez prevenu(e) des le retour en stock.
          </p>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setAlertError("");
            setAlertSubmitting(true);
            try {
              await stockAlertsApi.create({
                productId,
                variantId,
                email: alertEmail,
              });
              setAlertSent(true);
            } catch {
              setAlertError("Impossible d'enregistrer l'alerte pour le moment.");
            } finally {
              setAlertSubmitting(false);
            }
          }}
          className="flex gap-0"
        >
          <input
            type="email"
            required
            placeholder="Votre email pour être prévenu"
            value={alertEmail}
            onChange={(e) => setAlertEmail(e.target.value)}
            className="input-dark flex-1"
            style={{ borderRight: "none" }}
          />
          <button
            type="submit"
            disabled={alertSubmitting}
            className="btn-neon whitespace-nowrap disabled:opacity-60"
            style={{ borderRadius: 0 }}
          >
            <Bell style={{ width: 14, height: 14 }} />
            {alertSubmitting ? "ENVOI..." : "ALERTEZ-MOI"}
          </button>
        </form>
      )}
      {alertError && (
        <p className="font-mono text-xs mt-2" style={{ color: "var(--color-danger)" }}>
          {alertError}
        </p>
      )}
    </div>
  );
}
