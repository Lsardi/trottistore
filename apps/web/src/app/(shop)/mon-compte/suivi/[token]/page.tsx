"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { repairsApi, type RepairTracking } from "@/lib/api";
import { cn } from "@/lib/utils";
import { trackFunnelEvent } from "@/lib/funnel-tracking";

const STATUS_STEPS = [
  "RECU",
  "DIAGNOSTIC",
  "DEVIS_ENVOYE",
  "DEVIS_ACCEPTE",
  "EN_REPARATION",
  "PRET",
  "RECUPERE",
] as const;

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

export default function RepairTrackingPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [tracking, setTracking] = useState<RepairTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchTracking() {
      setLoading(true);
      setError("");
      try {
        const res = await repairsApi.getTracking(token);
        setTracking(res.data);
      } catch {
        setError("Lien de suivi invalide ou expiré.");
      } finally {
        setLoading(false);
      }
    }
    fetchTracking();
  }, [token]);

  useEffect(() => {
    if (!tracking) return;
    void trackFunnelEvent("repair_tracking_viewed", {
      status: tracking.status,
      hasAppointment: !!tracking.nextAppointment,
    });
  }, [tracking]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neon" />
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
        <p className="font-mono text-sm text-danger">{error || "Suivi indisponible."}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <header className="bg-surface border border-border p-5">
        <p className="spec-label mb-2">SUIVI RÉPARATION</p>
        <h1 className="heading-md mb-2">SAV-{String(tracking.ticketNumber).padStart(4, "0")}</h1>
        <p className="font-mono text-sm text-text-muted">{tracking.productModel}</p>
      </header>

      <section className="bg-surface border border-border p-5">
        <p className="spec-label mb-4">TIMELINE</p>
        <div className="space-y-3">
          {STATUS_STEPS.map((step) => {
            const reached = tracking.statusLog.some((item) => item.toStatus === step);
            const current = tracking.status === step;
            const log = [...tracking.statusLog].reverse().find((item) => item.toStatus === step);
            return (
              <div key={step} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-1 w-2.5 h-2.5 rounded-full",
                    current ? "bg-neon" : reached ? "bg-success" : "bg-border",
                  )}
                />
                <div>
                  <p className={cn("font-mono text-sm", current ? "text-neon" : "text-text")}>{step}</p>
                  {log ? <p className="font-mono text-xs text-text-dim">{formatDate(log.createdAt)}</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-surface border border-border p-5">
        <p className="spec-label mb-3">DÉTAILS</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
          <p className="text-text-muted">Statut actuel: <span className="text-text">{tracking.status}</span></p>
          <p className="text-text-muted">Priorité: <span className="text-text">{tracking.priority}</span></p>
          <p className="text-text-muted">Coût estimé: <span className="text-text">{tracking.estimatedCost ?? "—"}</span></p>
          <p className="text-text-muted">Coût final: <span className="text-text">{tracking.actualCost ?? "—"}</span></p>
          {tracking.nextAppointment ? (
            <p className="text-text-muted sm:col-span-2">
              Prochain RDV: <span className="text-text">{formatDate(tracking.nextAppointment.startsAt)}</span>
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
