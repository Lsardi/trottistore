"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Box,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Receipt,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { repairsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/brand";
import ConsentCheckbox from "@/components/ConsentCheckbox";

const TICKET_TYPES = [
  { value: "REPARATION", label: "Reparation", desc: "Panne ou dysfonctionnement", icon: Wrench },
  { value: "GARANTIE", label: "Sous garantie", desc: "Produit encore garanti", icon: ShieldCheck },
  { value: "RETOUR", label: "Retour produit", desc: "Retour ou echange", icon: RotateCcw },
  { value: "RECLAMATION", label: "Reclamation", desc: "Probleme de commande", icon: FileText },
] as const;

const WORKFLOW_STEPS = [
  { icon: FileText, title: "Demande", desc: "Deposez votre demande" },
  { icon: Search, title: "Diagnostic", desc: "Examen en atelier" },
  { icon: Receipt, title: "Devis", desc: "Estimation gratuite" },
  { icon: Wrench, title: "Reparation", desc: "Intervention technique" },
  { icon: CheckCircle2, title: "Retrait", desc: "Recuperez votre trottinette" },
];

const TRUST_POINTS = [
  { icon: Search, title: "Diagnostic gratuit", desc: "Examen complet de votre trottinette sans engagement avant acceptation du devis." },
  { icon: ShieldCheck, title: "Toutes marques", desc: "Dualtron, Xiaomi, Ninebot, Kaabo, Vsett... Notre atelier repare toutes les marques." },
  { icon: Box, title: "Pieces en stock", desc: "Large stock de pieces detachees pour une reparation rapide, souvent sous 48h." },
];

const SEO_ISSUE_LINKS = [
  { label: "Trottinette ne demarre plus", slug: "trottinette-ne-demarre-plus" },
  { label: "Pneu creve trottinette", slug: "pneu-creve-trottinette" },
  { label: "Frein trottinette ne freine plus", slug: "frein-trottinette-ne-freine-plus" },
  { label: "Batterie ne charge plus", slug: "batterie-trottinette-ne-charge-plus" },
  { label: "Guidon qui bouge", slug: "guidon-trottinette-qui-bouge" },
] as const;

export default function ReparationPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-neon" /></div>}>
      <ReparationPage />
    </Suspense>
  );
}

function ReparationPage() {
  const searchParams = useSearchParams();

  // Diagnostic data passed from /diagnostic
  const diagInfo = {
    issue: searchParams.get("issue") || "",
    diagnosis: searchParams.get("diag") || "",
    cost: searchParams.get("cost") || "",
    duration: searchParams.get("duration") || "",
    category: searchParams.get("category") || "",
  };
  const hasDiag = !!diagInfo.diagnosis;

  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    productModel: "",
    serialNumber: "",
    type: "REPARATION",
    issueDescription: diagInfo.issue
      ? `${diagInfo.issue}${diagInfo.diagnosis ? ` — Diagnostic en ligne : ${diagInfo.diagnosis}` : ""}`
      : "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ ticketNumber: number; trackingUrl?: string } | null>(null);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [wantsAppointment, setWantsAppointment] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState<Array<{ startsAt: string; available: boolean }>>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError("Veuillez accepter la politique de confidentialite.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await repairsApi.create(formData);
      setSuccess({ ticketNumber: res.data.ticketNumber, trackingUrl: res.data.trackingUrl });
      setFormData({
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        productModel: "",
        serialNumber: "",
        type: "REPARATION",
        issueDescription: "",
      });
    } catch {
      setError("Erreur lors de la soumission. Veuillez reessayer ou nous contacter directement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="text-center mb-10">
        <h1 className="heading-lg mb-3">REPARATION SAV</h1>
        <p className="font-mono text-sm text-text-muted max-w-lg mx-auto">
          Deposez votre demande de reparation en ligne. Notre atelier a {brand.address.city}{" "}
          repare toutes les marques.
        </p>
      </div>

      {/* SAV workflow stepper */}
      <div className="bg-surface border border-border p-5 sm:p-6 mb-8 overflow-x-auto">
        <p className="spec-label mb-4 text-center">WORKFLOW SAV</p>
        <div className="flex items-start justify-between min-w-[500px] sm:min-w-0 gap-1">
          {WORKFLOW_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isFirst = idx === 0;
            return (
              <div key={step.title} className="flex items-start flex-1">
                <div className="flex flex-col items-center text-center flex-1">
                  <div
                    className={cn(
                      "w-10 h-10 flex items-center justify-center border transition-all duration-200 mb-2",
                      isFirst
                        ? "border-neon bg-neon/10 shadow-[0_0_15px_rgba(0,255,209,0.15)]"
                        : "border-border bg-surface-2"
                    )}
                  >
                    <Icon className={cn("w-4.5 h-4.5", isFirst ? "text-neon" : "text-text-dim")} />
                  </div>
                  <p className={cn("font-mono text-[11px] font-bold", isFirst ? "text-neon" : "text-text-muted")}>
                    {step.title}
                  </p>
                  <p className="font-mono text-[9px] text-text-dim mt-0.5 hidden sm:block">{step.desc}</p>
                </div>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div className="flex items-center pt-5 px-1">
                    <ArrowRight className={cn("w-3 h-3", isFirst ? "text-neon/50" : "text-border")} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <section className="bg-surface border border-border p-5 mb-8">
        <p className="spec-label mb-3">PANNES COURANTES</p>
        <div className="flex flex-wrap gap-2">
          {SEO_ISSUE_LINKS.map((item) => (
            <Link
              key={item.slug}
              href={`/reparation/${item.slug}`}
              className="font-mono text-xs px-3 py-1.5 border border-border hover:border-neon text-text-muted hover:text-neon transition-colors duration-200 cursor-pointer"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Diagnostic summary banner */}
      {hasDiag && !success && (
        <div className="mb-8 border border-neon/30 bg-neon-dim/50 overflow-hidden">
          <div className="px-5 py-3 bg-neon/10 border-b border-neon/20 flex items-center gap-2">
            <Search className="w-4 h-4 text-neon" />
            <span className="font-display font-bold text-neon text-sm uppercase">Diagnostic en ligne</span>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="spec-label mb-1">Symptome</p>
              <p className="font-mono text-sm text-text">{diagInfo.issue}</p>
            </div>
            <div>
              <p className="spec-label mb-1">Diagnostic</p>
              <p className="font-mono text-sm text-text">{diagInfo.diagnosis}</p>
            </div>
            <div>
              <p className="spec-label mb-1">Cout estime</p>
              <p className="font-mono text-sm font-bold text-neon">{diagInfo.cost}</p>
            </div>
            <div>
              <p className="spec-label mb-1">Duree estimee</p>
              <p className="font-mono text-sm text-text">{diagInfo.duration}</p>
            </div>
          </div>
          <div className="px-5 pb-3">
            <p className="font-mono text-xs text-text-dim">
              Prix indicatif. Le devis final sera etabli apres examen en atelier.
            </p>
          </div>
        </div>
      )}

      {success ? (
        <div className="bg-surface border border-border overflow-hidden">
          {/* Success header */}
          <div className="border-b border-neon/20 bg-neon/5 p-6 sm:p-10 text-center">
            {/* Animated checkmark */}
            <div className="relative w-20 h-20 mx-auto mb-5">
              <div className="absolute inset-0 border-2 border-neon animate-[sav-ring_0.6s_ease-out_forwards] opacity-0" style={{ borderRadius: "50%" }} />
              <div className="absolute inset-2 bg-neon/10 flex items-center justify-center animate-[sav-fill_0.4s_0.3s_ease-out_forwards] opacity-0" style={{ borderRadius: "50%" }}>
                <CheckCircle2 className="w-8 h-8 text-neon animate-[sav-check_0.3s_0.5s_ease-out_forwards] opacity-0" />
              </div>
            </div>
            <h2 className="heading-md text-neon mb-2">
              Ticket cree avec succes
            </h2>
            <div className="inline-block bg-surface border border-neon/30 px-6 py-3 mt-3">
              <p className="font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1">Numero de ticket</p>
              <p className="font-mono text-xl font-bold text-neon tracking-wider">
                SAV-{String(success.ticketNumber).padStart(4, "0")}
              </p>
            </div>
          </div>

          {/* Success details */}
          <div className="p-6 sm:p-8 space-y-6">
            {success.trackingUrl && (
              <Link
                href={success.trackingUrl}
                className="flex items-center justify-between gap-3 border border-neon/20 bg-neon/5 p-4 hover:bg-neon/10 transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-neon" />
                  <div>
                    <p className="font-mono text-xs text-text font-bold">Suivre ma reparation</p>
                    <p className="font-mono text-[10px] text-text-dim">Suivi en temps reel de votre ticket</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-neon group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
            )}

            {/* Expected timeline */}
            <div>
              <p className="spec-label mb-3">PROCHAINES ETAPES</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-neon/10 border border-neon/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="font-mono text-[10px] text-neon font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-text">Contact sous 24-48h</p>
                    <p className="font-mono text-[10px] text-text-dim">Notre equipe vous contactera pour confirmer la reception.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-surface-2 border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="font-mono text-[10px] text-text-dim font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-text">Diagnostic gratuit</p>
                    <p className="font-mono text-[10px] text-text-dim">Examen complet et devis detaille sans engagement.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-surface-2 border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="font-mono text-[10px] text-text-dim font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-text">Reparation sur validation</p>
                    <p className="font-mono text-[10px] text-text-dim">Intervention uniquement apres votre accord sur le devis.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="divider" />

            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => setSuccess(null)}
                className="btn-outline cursor-pointer"
              >
                DEPOSER UNE AUTRE DEMANDE
              </button>
              <Link href="/produits" className="btn-neon cursor-pointer">
                PARCOURIR LA BOUTIQUE
              </Link>
            </div>
          </div>

          <style>{`
            @keyframes sav-ring {
              0% { transform: scale(0.5); opacity: 0; }
              50% { transform: scale(1.1); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes sav-fill {
              0% { transform: scale(0); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes sav-check {
              0% { transform: scale(0) rotate(-45deg); opacity: 0; }
              100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
          `}</style>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="repair-name" className="spec-label block mb-2">
                Nom complet <span className="text-danger">*</span>
              </label>
              <input
                id="repair-name"
                type="text"
                required
                placeholder="Nom Prenom"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="input-dark w-full"
              />
            </div>
            <div>
              <label htmlFor="repair-phone" className="spec-label block mb-2">
                Telephone <span className="text-danger">*</span>
              </label>
              <input
                id="repair-phone"
                type="tel"
                required
                placeholder="06 XX XX XX XX"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className="input-dark w-full"
              />
            </div>
          </div>

          <div>
            <label htmlFor="repair-email" className="spec-label block mb-2">
              Email <span className="text-text-dim font-normal">(optionnel)</span>
            </label>
            <input
              id="repair-email"
              type="email"
              placeholder="votre@email.fr"
              value={formData.customerEmail}
              onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
              className="input-dark w-full"
            />
          </div>

          {/* Product model */}
          <div>
            <label htmlFor="repair-model" className="spec-label block mb-2">
              Modele de trottinette <span className="text-danger">*</span>
            </label>
            <input
              id="repair-model"
              type="text"
              required
              placeholder="Ex: Dualtron Thunder 2, Xiaomi Pro 2, Ninebot Max G30..."
              value={formData.productModel}
              onChange={(e) => setFormData({ ...formData, productModel: e.target.value })}
              className="input-dark w-full"
            />
          </div>

          {/* Serial number */}
          <div>
            <label htmlFor="repair-serial" className="spec-label block mb-2">
              Numero de serie <span className="text-text-dim font-normal">(optionnel)</span>
            </label>
            <input
              id="repair-serial"
              type="text"
              placeholder="Visible sous le deck ou sur la colonne de direction"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              className="input-dark w-full"
            />
          </div>

          {/* Type — card-style with icons */}
          <div>
            <p id="repair-request-type-label" className="spec-label block mb-3">
              Type de demande <span className="text-danger">*</span>
            </p>
            <div role="group" aria-labelledby="repair-request-type-label" className="grid grid-cols-2 gap-3">
              {TICKET_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = formData.type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: t.value })}
                    className={cn(
                      "flex items-start gap-3 px-4 py-4 border text-left transition-all duration-200 cursor-pointer",
                      isSelected
                        ? "border-neon bg-neon/5 shadow-[0_0_15px_rgba(0,255,209,0.08)]"
                        : "border-border hover:border-text-dim bg-surface-2"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 flex items-center justify-center border flex-shrink-0 transition-all duration-200",
                      isSelected ? "border-neon/30 bg-neon/10" : "border-border bg-surface"
                    )}>
                      <Icon className={cn("w-4 h-4 transition-colors duration-200", isSelected ? "text-neon" : "text-text-dim")} />
                    </div>
                    <div>
                      <p
                        className={cn(
                          "font-mono text-sm font-bold transition-colors duration-200",
                          isSelected ? "text-neon" : "text-text"
                        )}
                      >
                        {t.label}
                      </p>
                      <p className="font-mono text-xs text-text-dim mt-0.5">{t.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="repair-description" className="spec-label block mb-2">
              Description du probleme <span className="text-danger">*</span>
            </label>
            <textarea
              id="repair-description"
              required
              rows={5}
              placeholder="Decrivez le probleme en detail : quand est-ce apparu ? Quels symptomes ? La trottinette demarre-t-elle encore ?"
              value={formData.issueDescription}
              onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
              className="input-dark w-full resize-none"
            />
          </div>

          {/* Optional appointment booking */}
          <div className="border border-border p-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={wantsAppointment}
                onChange={(e) => {
                  setWantsAppointment(e.target.checked);
                  if (!e.target.checked) {
                    setAppointmentDate("");
                    setAvailableSlots([]);
                    setSelectedSlot("");
                  }
                }}
                className="cursor-pointer"
              />
              <span className="font-mono text-sm text-text">
                Je souhaite reserver un creneau a l&apos;atelier
              </span>
            </label>

            {wantsAppointment && (
              <div className="space-y-3 pt-2">
                <div>
                  <label htmlFor="appt-date" className="spec-label block mb-2">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    Date souhaitee
                  </label>
                  <input
                    id="appt-date"
                    type="date"
                    min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                    value={appointmentDate}
                    onChange={async (e) => {
                      const date = e.target.value;
                      setAppointmentDate(date);
                      setSelectedSlot("");
                      if (!date) { setAvailableSlots([]); return; }
                      setLoadingSlots(true);
                      try {
                        const res = await fetch(`/api/v1/appointments/slots?date=${date}`);
                        if (res.ok) {
                          const data = await res.json();
                          setAvailableSlots(data.data || []);
                        }
                      } catch { /* ignore */ }
                      setLoadingSlots(false);
                    }}
                    className="input-dark w-full cursor-pointer"
                  />
                </div>

                {loadingSlots && (
                  <p className="font-mono text-xs text-text-dim flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Chargement des creneaux...
                  </p>
                )}

                {availableSlots.length > 0 && (
                  <div>
                    <p className="spec-label mb-2">Creneaux disponibles</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {availableSlots.filter((s) => s.available).map((slot) => {
                        const time = new Date(slot.startsAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                        const isSelected = selectedSlot === slot.startsAt;
                        return (
                          <button
                            key={slot.startsAt}
                            type="button"
                            onClick={() => setSelectedSlot(slot.startsAt)}
                            className={cn(
                              "py-2.5 px-3 border font-mono text-xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5",
                              isSelected
                                ? "border-neon bg-neon-dim text-neon shadow-[0_0_10px_rgba(0,255,209,0.1)]"
                                : "border-border text-text-muted hover:border-text-dim"
                            )}
                          >
                            <Clock className="w-3 h-3" />
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {appointmentDate && !loadingSlots && availableSlots.filter((s) => s.available).length === 0 && (
                  <p className="font-mono text-xs text-text-dim">Aucun creneau disponible ce jour. Essayez une autre date.</p>
                )}
              </div>
            )}
          </div>

          {error && (
            <div role="alert" className="border border-danger/30 bg-danger/10 text-danger px-4 py-3 font-mono text-sm">
              {error}
            </div>
          )}

          <ConsentCheckbox checked={consent} onChange={setConsent} id="repair-consent" />

          <button
            type="submit"
            disabled={submitting || !consent}
            className="btn-neon w-full py-4 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                ENVOI EN COURS...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                ENVOYER MA DEMANDE
              </>
            )}
          </button>

          <p className="font-mono text-xs text-text-dim text-center">
            Diagnostic gratuit. Aucun engagement avant acceptation du devis.
          </p>
        </form>
      )}

      {/* "Pourquoi TrottiStore ?" trust section */}
      {!success && (
        <section className="mt-12 mb-4">
          <p className="spec-label text-center mb-6">POURQUOI TROTTISTORE ?</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {TRUST_POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <div
                  key={point.title}
                  className="bg-surface border border-border p-5 text-center hover:border-neon/30 transition-all duration-200"
                >
                  <div className="w-12 h-12 mx-auto mb-3 bg-neon/10 border border-neon/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-neon" />
                  </div>
                  <p className="font-mono text-xs font-bold text-text mb-1">{point.title}</p>
                  <p className="font-mono text-[11px] text-text-dim leading-relaxed">{point.desc}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
