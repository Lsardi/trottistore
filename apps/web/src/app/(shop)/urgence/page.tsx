"use client";

import { Suspense, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarClock, Loader2, Phone, Wrench } from "lucide-react";
import { appointmentsApi, repairsApi, type AppointmentSlot } from "@/lib/api";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { trackFunnelEvent } from "@/lib/funnel-tracking";

function formatSlot(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

const DEFAULT_DATE = new Date().toISOString().slice(0, 10);

export default function UrgencePageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-neon" /></div>}>
      <UrgencePage />
    </Suspense>
  );
}

function UrgencePage() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    productModel: "",
    issueDescription: searchParams.get("issue") || "",
    isExpress: true,
  });
  const [date, setDate] = useState(DEFAULT_DATE);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ trackingUrl?: string; ticketNumber: number } | null>(null);

  const availableSlots = useMemo(() => slots.filter((slot) => slot.available), [slots]);

  useEffect(() => {
    if (searchParams.get("issue")) {
      void trackFunnelEvent("diagnostic_ticket_cta_clicked", {
        source: "diagnostic_to_urgence",
      });
    }
  }, [searchParams]);

  async function loadSlots() {
    setLoadingSlots(true);
    setError("");
    try {
      const res = await appointmentsApi.slots({ date, durationMin: 60 });
      setSlots(res.data);
      void trackFunnelEvent("urgence_slots_loaded", {
        date,
        availableSlots: res.data.filter((slot) => slot.available).length,
      });
    } catch {
      setError("Impossible de charger les créneaux. Réessayez.");
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const ticketRes = await repairsApi.create({
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail || undefined,
        productModel: formData.productModel,
        type: "REPARATION",
        priority: formData.isExpress ? "URGENT" : "HIGH",
        issueDescription: formData.issueDescription,
      });

      if (selectedSlot) {
        await appointmentsApi.create({
          ticketId: ticketRes.data.id,
          customerName: formData.customerName,
          customerPhone: formData.customerPhone,
          customerEmail: formData.customerEmail || undefined,
          serviceType: "REPARATION",
          isExpress: formData.isExpress,
          startsAt: selectedSlot,
          durationMin: 60,
          notes: "Créé depuis la landing /urgence",
        });
      }

      setSuccess({
        trackingUrl: ticketRes.data.trackingUrl,
        ticketNumber: ticketRes.data.ticketNumber,
      });
      void trackFunnelEvent("urgence_ticket_created", {
        express: formData.isExpress,
        withAppointment: !!selectedSlot,
      });
    } catch {
      setError("Impossible d'envoyer votre demande. Appelez-nous directement.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-surface border border-border p-8 text-center">
          <h1 className="heading-md text-neon mb-3">Demande urgence enregistrée</h1>
          <p className="font-mono text-sm text-text-muted mb-4">
            Ticket SAV-{String(success.ticketNumber).padStart(4, "0")} créé.
          </p>
          {success.trackingUrl ? (
            <Link href={success.trackingUrl} className="btn-neon inline-flex">
              Voir le suivi en temps réel
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        <section className="bg-surface border border-danger/40 p-6">
          <p className="spec-label text-danger mb-3">SOS TROTTINETTE</p>
          <h1 className="heading-lg mb-3">PANNE URGENTE ?</h1>
          <p className="font-mono text-sm text-text-muted mb-6">
            Diagnostic rapide, devis et créneau atelier visibles immédiatement.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={`tel:${brand.phoneIntl}`} className="btn-neon">
              <Phone className="w-4 h-4" />
              APPELER MAINTENANT
            </a>
            <Link href="/diagnostic" className="btn-outline">
              <AlertTriangle className="w-4 h-4" />
              DIAGNOSTIC 2 MIN
            </Link>
          </div>
        </section>

        <section className="bg-surface border border-border p-6">
          <p className="spec-label mb-3">PRISE DE RDV</p>
          <label className="spec-label block mb-2">Date souhaitée</label>
          <div className="flex gap-2 mb-4">
            <input
              type="date"
              value={date}
              min={DEFAULT_DATE}
              onChange={(e) => setDate(e.target.value)}
              className="input-dark flex-1"
            />
            <button type="button" onClick={loadSlots} className="btn-outline">
              {loadingSlots ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
              VOIR
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 max-h-44 overflow-auto pr-1">
            {availableSlots.map((slot) => (
              <button
                key={slot.startsAt}
                type="button"
                onClick={() => setSelectedSlot(slot.startsAt)}
                className={cn(
                  "font-mono text-xs border px-2 py-2 transition-colors",
                  selectedSlot === slot.startsAt
                    ? "border-neon text-neon"
                    : "border-border text-text-muted hover:border-text-dim",
                )}
              >
                {formatSlot(slot.startsAt)}
              </button>
            ))}
          </div>
          <p className="font-mono text-xs text-text-dim mt-3">
            Créneau express = priorité atelier (+20%).
          </p>
        </section>
      </div>

      <form id="urgent-form" onSubmit={handleSubmit} className="bg-surface border border-border p-6 mt-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="spec-label block mb-2">Nom complet *</label>
            <input
              required
              className="input-dark w-full"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
            />
          </div>
          <div>
            <label className="spec-label block mb-2">Téléphone *</label>
            <input
              required
              className="input-dark w-full"
              value={formData.customerPhone}
              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="spec-label block mb-2">Email</label>
          <input
            type="email"
            className="input-dark w-full"
            value={formData.customerEmail}
            onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
          />
        </div>
        <div>
          <label className="spec-label block mb-2">Modèle trottinette *</label>
          <input
            required
            className="input-dark w-full"
            placeholder="Ex: Xiaomi Pro 2"
            value={formData.productModel}
            onChange={(e) => setFormData({ ...formData, productModel: e.target.value })}
          />
        </div>
        <div>
          <label className="spec-label block mb-2">Problème rencontré *</label>
          <textarea
            required
            rows={4}
            className="input-dark w-full resize-none"
            value={formData.issueDescription}
            onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 font-mono text-xs text-text-muted">
          <input
            type="checkbox"
            checked={formData.isExpress}
            onChange={(e) => setFormData({ ...formData, isExpress: e.target.checked })}
          />
          Demande express (prise en charge prioritaire, majoration +20%)
        </label>

        {error ? <p role="alert" className="font-mono text-sm text-danger">{error}</p> : null}

        <button type="submit" disabled={submitting} className="btn-neon w-full disabled:opacity-60">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
          VALIDER MA DEMANDE URGENTE
        </button>
      </form>
    </div>
  );
}
