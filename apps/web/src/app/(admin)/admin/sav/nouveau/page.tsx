"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Loader2, Save } from "lucide-react";
import { repairsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type RepairType = "REPARATION" | "GARANTIE" | "RETOUR" | "RECLAMATION";
type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export default function AdminNewRepairTicketPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [productModel, setProductModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [type, setType] = useState<RepairType>("REPARATION");
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const [issueDescription, setIssueDescription] = useState("");

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return fallback;
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      showToast("Le nom client est requis", "error");
      return;
    }
    if (!customerEmail.trim()) {
      showToast("L'email client est requis", "error");
      return;
    }
    if (!customerPhone.trim()) {
      showToast("Le telephone client est requis", "error");
      return;
    }
    if (!productModel.trim()) {
      showToast("Le modele produit est requis", "error");
      return;
    }
    if (!issueDescription.trim()) {
      showToast("La description de la panne est requise", "error");
      return;
    }

    setSaving(true);
    try {
      await repairsApi.create({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        productModel: productModel.trim(),
        serialNumber: serialNumber.trim() || undefined,
        type,
        priority,
        issueDescription: issueDescription.trim(),
      });
      showToast("Ticket cree", "success");
      setTimeout(() => {
        router.push("/admin/sav");
      }, 500);
    } catch (error) {
      console.error("Repair ticket creation failed:", error);
      showToast(`Erreur: ${getErrorMessage(error, "inconnue")}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto relative">
      {toast ? (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium",
            toast.type === "success" ? "bg-neon text-surface" : "bg-danger text-surface",
          )}
        >
          {toast.type === "success" ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {toast.message}
        </div>
      ) : null}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/sav" className="p-2 rounded-lg hover:bg-surface-2 transition text-text-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-text">Nouveau ticket SAV</h1>
            <p className="text-sm text-text-muted">Creation rapide d&apos;un ticket depuis le back-office</p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-neon text-surface px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-neon/90 transition-colors shadow-sm disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Creer le ticket
        </button>
      </div>

      <section className="bg-surface rounded-xl border border-border shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Nom client *</label>
            <input
              type="text"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
              placeholder="Jean Dupont"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Email client *</label>
            <input
              type="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
              placeholder="client@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Telephone client *</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
              placeholder="06 00 00 00 00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Modele produit *</label>
            <input
              type="text"
              value={productModel}
              onChange={(event) => setProductModel(event.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
              placeholder="Dualtron Mini"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Numero de serie</label>
            <input
              type="text"
              value={serialNumber}
              onChange={(event) => setSerialNumber(event.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
              placeholder="SN-123456"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Type *</label>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as RepairType)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
            >
              <option value="REPARATION">Reparation</option>
              <option value="GARANTIE">Garantie</option>
              <option value="RETOUR">Retour</option>
              <option value="RECLAMATION">Reclamation</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Priorite</label>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">Description de la panne *</label>
          <textarea
            value={issueDescription}
            onChange={(event) => setIssueDescription(event.target.value)}
            rows={6}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition resize-y"
            placeholder="Decris la panne, les symptomes et le contexte client..."
          />
        </div>
      </section>
    </div>
  );
}
