"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Loader2, PackageSearch, Wrench, X } from "lucide-react";
import { repairsApi, type RepairStatus, type RepairTicket } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<RepairStatus, string> = {
  RECU: "Recu",
  DIAGNOSTIC: "Diagnostic",
  DEVIS_ENVOYE: "Devis envoye",
  DEVIS_ACCEPTE: "Devis accepte",
  EN_REPARATION: "En reparation",
  EN_ATTENTE_PIECE: "Attente piece",
  PRET: "Pret",
  RECUPERE: "Recupere",
  REFUS_CLIENT: "Refuse",
  IRREPARABLE: "Irreparable",
};

const STATUS_TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  RECU: ["DIAGNOSTIC", "IRREPARABLE"],
  DIAGNOSTIC: ["DEVIS_ENVOYE", "EN_REPARATION", "IRREPARABLE"],
  DEVIS_ENVOYE: ["DEVIS_ACCEPTE", "REFUS_CLIENT"],
  DEVIS_ACCEPTE: ["EN_REPARATION"],
  EN_REPARATION: ["EN_ATTENTE_PIECE", "PRET"],
  EN_ATTENTE_PIECE: ["EN_REPARATION"],
  PRET: ["RECUPERE"],
  RECUPERE: [],
  REFUS_CLIENT: [],
  IRREPARABLE: [],
};

const KANBAN_COLUMNS: Array<{ key: RepairStatus; title: string }> = [
  { key: "RECU", title: "Recus" },
  { key: "DIAGNOSTIC", title: "Diagnostic" },
  { key: "DEVIS_ENVOYE", title: "Devis" },
  { key: "DEVIS_ACCEPTE", title: "Valides" },
  { key: "EN_REPARATION", title: "Atelier" },
  { key: "EN_ATTENTE_PIECE", title: "Pieces" },
  { key: "PRET", title: "Prets" },
  { key: "RECUPERE", title: "Recuperes" },
];

const PRIORITY_CLASS: Record<string, string> = {
  LOW: "text-text-dim",
  NORMAL: "text-text-muted",
  HIGH: "text-warning",
  URGENT: "text-danger",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

export default function AdminSavPage() {
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [saving, setSaving] = useState(false);
  const [targetStatus, setTargetStatus] = useState<RepairStatus | "">("");
  const [note, setNote] = useState("");

  async function loadTickets() {
    setLoading(true);
    setError("");
    try {
      const res = await repairsApi.list({ page: 1, limit: 100, sort: "priority" });
      setTickets(res.data || []);
    } catch {
      setError("Impossible de charger les tickets SAV.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
  }, []);

  useEffect(() => {
    if (!selectedTicketId) {
      setSelectedTicket(null);
      setTargetStatus("");
      setNote("");
      return;
    }
    const ticketId = selectedTicketId;

    async function loadTicket() {
      setLoadingTicket(true);
      try {
        const res = await repairsApi.getById(ticketId);
        setSelectedTicket(res.data);
        const allowed = STATUS_TRANSITIONS[res.data.status as RepairStatus] ?? [];
        setTargetStatus(allowed[0] ?? "");
      } catch {
        setError("Impossible de charger le detail ticket.");
      } finally {
        setLoadingTicket(false);
      }
    }

    void loadTicket();
  }, [selectedTicketId]);

  const stats = useMemo(() => {
    const openCount = tickets.filter((t) => !["RECUPERE", "REFUS_CLIENT", "IRREPARABLE"].includes(t.status)).length;
    const repairCount = tickets.filter((t) => t.status === "EN_REPARATION").length;
    const waitingParts = tickets.filter((t) => t.status === "EN_ATTENTE_PIECE").length;
    const closedCount = tickets.filter((t) => ["RECUPERE", "REFUS_CLIENT", "IRREPARABLE"].includes(t.status)).length;
    return { openCount, repairCount, waitingParts, closedCount };
  }, [tickets]);

  async function handleSaveStatus() {
    if (!selectedTicket || !targetStatus) return;
    setSaving(true);
    setError("");
    try {
      await repairsApi.updateStatus(selectedTicket.id, {
        status: targetStatus,
        note: note.trim() || undefined,
      });
      await loadTickets();
      const res = await repairsApi.getById(selectedTicket.id);
      setSelectedTicket(res.data);
      const allowed = STATUS_TRANSITIONS[res.data.status as RepairStatus] ?? [];
      setTargetStatus(allowed[0] ?? "");
      setNote("");
    } catch {
      setError("Transition impossible pour ce ticket.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="heading-lg">KANBAN SAV</h1>
          <p className="font-mono text-sm text-text-muted mt-1">
            Pilotage des tickets avec transitions, journal et photos.
          </p>
        </div>
        <button onClick={() => void loadTickets()} className="btn-outline">
          Rafraichir
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Clock3} label="Ouverts" value={stats.openCount} />
        <StatCard icon={Wrench} label="Atelier" value={stats.repairCount} />
        <StatCard icon={PackageSearch} label="Attente piece" value={stats.waitingParts} />
        <StatCard icon={CheckCircle2} label="Clotures" value={stats.closedCount} />
      </div>

      {error ? (
        <div className="border border-danger/40 bg-danger/10 p-3 font-mono text-xs text-danger">{error}</div>
      ) : null}

      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-neon" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          {KANBAN_COLUMNS.map((column) => {
            const columnTickets = tickets.filter((ticket) => ticket.status === column.key);
            return (
              <section key={column.key} className="bg-surface border border-border min-h-56 flex flex-col">
                <header className="px-3 py-2 border-b border-border bg-surface-2">
                  <p className="spec-label">{column.title}</p>
                  <p className="font-mono text-[11px] text-text-dim mt-1">{columnTickets.length} ticket(s)</p>
                </header>
                <div className="p-2 space-y-2 overflow-auto">
                  {columnTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={cn(
                        "w-full text-left border p-2 transition-colors",
                        selectedTicketId === ticket.id
                          ? "border-neon bg-neon-dim/30"
                          : "border-border hover:border-neon/40",
                      )}
                    >
                      <p className="font-mono text-[11px] text-neon font-bold">
                        SAV-{String(ticket.ticketNumber).padStart(4, "0")}
                      </p>
                      <p className="font-mono text-xs text-text mt-1 line-clamp-2">{ticket.productModel}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className={cn("font-mono text-[10px] uppercase", PRIORITY_CLASS[ticket.priority] || "text-text-dim")}>
                          {ticket.priority}
                        </span>
                        <span className="font-mono text-[10px] text-text-dim">
                          {new Date(ticket.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    </button>
                  ))}
                  {columnTickets.length === 0 ? (
                    <p className="font-mono text-[11px] text-text-dim px-1 py-2">Aucun ticket</p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {selectedTicketId ? (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 md:p-8 overflow-auto">
          <div className="mx-auto w-full max-w-4xl border border-border bg-surface">
            <div className="flex items-start justify-between gap-4 border-b border-border p-4">
              <div>
                <p className="spec-label mb-1">DETAIL TICKET</p>
                <h2 className="heading-sm">SAV-{String(selectedTicket?.ticketNumber ?? 0).padStart(4, "0")}</h2>
                <p className="font-mono text-xs text-text-muted mt-1">{selectedTicket?.productModel ?? "Chargement..."}</p>
              </div>
              <button
                onClick={() => setSelectedTicketId(null)}
                className="h-9 w-9 flex items-center justify-center border border-border hover:border-neon"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loadingTicket || !selectedTicket ? (
              <div className="h-44 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-neon" />
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-6 p-4">
                <section className="space-y-4">
                  <div className="border border-border p-3">
                    <p className="spec-label mb-2">Transition statut</p>
                    <div className="grid gap-3">
                      <div>
                        <label className="font-mono text-xs text-text-muted block mb-1">Statut actuel</label>
                        <p className="font-mono text-sm text-neon">
                          {STATUS_LABELS[selectedTicket.status as RepairStatus] || selectedTicket.status}
                        </p>
                      </div>
                      <div>
                        <label className="font-mono text-xs text-text-muted block mb-1">Nouveau statut</label>
                        <select
                          value={targetStatus}
                          onChange={(event) => setTargetStatus(event.target.value as RepairStatus)}
                          className="input-dark w-full"
                          disabled={(STATUS_TRANSITIONS[selectedTicket.status as RepairStatus] ?? []).length === 0}
                        >
                          {(STATUS_TRANSITIONS[selectedTicket.status as RepairStatus] ?? []).map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="font-mono text-xs text-text-muted block mb-1">Note journal (optionnel)</label>
                        <textarea
                          rows={3}
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          className="input-dark w-full resize-none"
                          placeholder="Ex: client informe, piece commandee..."
                        />
                      </div>
                      <button
                        onClick={() => void handleSaveStatus()}
                        disabled={!targetStatus || saving}
                        className="btn-neon disabled:opacity-50"
                      >
                        {saving ? "Mise a jour..." : "Valider transition"}
                      </button>
                    </div>
                  </div>

                  <div className="border border-border p-3">
                    <p className="spec-label mb-2">Infos client</p>
                    <div className="space-y-1 font-mono text-xs text-text-muted">
                      <p>Nom: <span className="text-text">{selectedTicket.customerName || "—"}</span></p>
                      <p>Email: <span className="text-text">{selectedTicket.customerEmail || "—"}</span></p>
                      <p>Telephone: <span className="text-text">{selectedTicket.customerPhone || "—"}</span></p>
                      <p>Type: <span className="text-text">{selectedTicket.type}</span></p>
                    </div>
                  </div>

                  <div className="border border-border p-3">
                    <p className="spec-label mb-2">Description panne</p>
                    <p className="font-mono text-xs text-text-muted whitespace-pre-wrap">{selectedTicket.issueDescription}</p>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="border border-border p-3">
                    <p className="spec-label mb-2">Photos</p>
                    {(selectedTicket.photosUrls?.length ?? 0) === 0 ? (
                      <p className="font-mono text-xs text-text-dim">Aucune photo jointe.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {selectedTicket.photosUrls?.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer" className="block border border-border hover:border-neon">
                            <img src={url} alt="Photo ticket SAV" className="w-full h-28 object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border border-border p-3">
                    <p className="spec-label mb-2">Journal d'intervention</p>
                    <div className="space-y-2 max-h-80 overflow-auto pr-1">
                      {(selectedTicket.statusLog ?? []).length === 0 ? (
                        <p className="font-mono text-xs text-text-dim">Aucun evenement.</p>
                      ) : (
                        [...(selectedTicket.statusLog ?? [])].reverse().map((entry, index) => (
                          <div key={`${entry.createdAt}-${index}`} className="border border-border p-2">
                            <p className="font-mono text-[11px] text-neon">
                              {entry.fromStatus || "INIT"} -&gt; {entry.toStatus}
                            </p>
                            <p className="font-mono text-[11px] text-text-dim mt-1">{formatDate(entry.createdAt)}</p>
                            {entry.note ? <p className="font-mono text-xs text-text mt-2">{entry.note}</p> : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-surface border border-border p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center bg-neon-dim">
          <Icon className="h-5 w-5 text-neon" />
        </div>
        <div>
          <p className="spec-label">{label}</p>
          <p className="font-mono text-2xl font-bold text-neon">{value}</p>
        </div>
      </div>
    </div>
  );
}
