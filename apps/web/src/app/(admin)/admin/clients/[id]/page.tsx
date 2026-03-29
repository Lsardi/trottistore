"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { customersApi, type CustomerGarage } from "@/lib/api";
import { ArrowLeft, Loader2, Wrench, ShoppingBag, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

export default function AdminClientGaragePage() {
  const params = useParams<{ id: string }>();
  const customerId = params?.id;

  const [garage, setGarage] = useState<CustomerGarage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await customersApi.getGarage(customerId);
        setGarage(res.data);
      } catch {
        setError("Impossible de charger la fiche garage client.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [customerId]);

  const timeline = useMemo(() => garage?.timeline || [], [garage]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="heading-lg">FICHE CLIENT GARAGE</h1>
          <p className="font-mono text-sm text-text-muted mt-1">Historique reparation + achats + interactions.</p>
        </div>
        <Link href="/admin/clients" className="btn-outline inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour clients
        </Link>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-neon" />
        </div>
      ) : error ? (
        <div className="border border-danger/40 bg-danger/10 p-3 font-mono text-xs text-danger">{error}</div>
      ) : !garage ? (
        <div className="border border-border bg-surface p-4 font-mono text-sm text-text-muted">Aucune donnee disponible.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface border border-border p-4">
              <p className="spec-label">Niveau</p>
              <p className="font-mono text-lg font-bold text-neon mt-1">{garage.profile.loyaltyTier}</p>
            </div>
            <div className="bg-surface border border-border p-4">
              <p className="spec-label">Points</p>
              <p className="font-mono text-lg font-bold text-neon mt-1">{garage.profile.loyaltyPoints}</p>
            </div>
            <div className="bg-surface border border-border p-4">
              <p className="spec-label">Reparations actives</p>
              <p className="font-mono text-lg font-bold text-warning mt-1">{garage.stats.activeRepairs}</p>
            </div>
            <div className="bg-surface border border-border p-4">
              <p className="spec-label">Depense totale</p>
              <p className="font-mono text-lg font-bold text-neon mt-1">{formatCurrency(garage.stats.totalSpent)}</p>
            </div>
          </div>

          <div className="bg-surface border border-border p-4">
            <h2 className="font-display font-bold text-text mb-3">Modeles trottinettes</h2>
            {garage.profile.scooterModels?.length ? (
              <div className="flex flex-wrap gap-2">
                {garage.profile.scooterModels.map((model) => (
                  <span key={model} className="badge badge-muted">{model}</span>
                ))}
              </div>
            ) : (
              <p className="font-mono text-sm text-text-muted">Aucun modele enregistre.</p>
            )}
          </div>

          <section className="bg-surface border border-border p-4">
            <h2 className="font-display font-bold text-text mb-4">Timeline 360</h2>
            {timeline.length === 0 ? (
              <p className="font-mono text-sm text-text-muted">Aucun evenement pour ce client.</p>
            ) : (
              <div className="space-y-3">
                {timeline.map((event, index) => {
                  const data = event.data as Record<string, unknown>;
                  const icon =
                    event.type === "REPAIR" ? <Wrench className="h-4 w-4 text-warning" /> :
                    event.type === "ORDER" ? <ShoppingBag className="h-4 w-4 text-neon" /> :
                    <MessageSquare className="h-4 w-4 text-text-muted" />;

                  return (
                    <div key={`${event.type}-${index}`} className="border border-border bg-surface-2 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {icon}
                          <span className={cn(
                            "font-mono text-[11px] uppercase",
                            event.type === "REPAIR" ? "text-warning" : event.type === "ORDER" ? "text-neon" : "text-text-dim",
                          )}>
                            {event.type}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-text-dim">{formatDate(event.date)}</span>
                      </div>

                      {event.type === "REPAIR" ? (
                        <div className="mt-2 font-mono text-xs text-text">
                          Ticket #{String(data.ticketNumber ?? "")} · {String(data.productModel ?? "")} · {String(data.status ?? "")}
                        </div>
                      ) : null}

                      {event.type === "ORDER" ? (
                        <div className="mt-2 font-mono text-xs text-text">
                          Commande #{String(data.orderNumber ?? "")} · {String(data.status ?? "")} · {formatCurrency(Number(data.totalTtc ?? 0))}
                        </div>
                      ) : null}

                      {event.type === "INTERACTION" ? (
                        <div className="mt-2 font-mono text-xs text-text">
                          {String(data.type ?? "")} · {String(data.channel ?? "")} · {String(data.subject ?? "Sans sujet")}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
