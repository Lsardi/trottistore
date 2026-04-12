"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Shield,
  UserCog,
  KeyRound,
} from "lucide-react";

interface StaffMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  phone: string | null;
  lastLoginAt: string | null;
  loginCount: number;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Super Admin",
  ADMIN: "Administrateur",
  MANAGER: "Manager",
  TECHNICIAN: "Technicien",
  STAFF: "Employé",
};

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "text-red-400",
  ADMIN: "text-neon",
  MANAGER: "text-blue-400",
  TECHNICIAN: "text-yellow-400",
  STAFF: "text-text-muted",
};

export default function AdminEquipePage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "STAFF",
    phone: "",
  });

  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function loadStaff() {
    try {
      const res = await fetch("/api/v1/admin/users", { headers });
      const data = await res.json();
      if (data.success) setStaff(data.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStaff(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...form,
          phone: form.phone || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`Invitation envoyée à ${form.email}`);
        setShowCreate(false);
        setForm({ email: "", firstName: "", lastName: "", role: "STAFF", phone: "" });
        await loadStaff();
      } else {
        setError(data.error?.message || "Erreur");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (!confirm(`${newStatus === "SUSPENDED" ? "Désactiver" : "Réactiver"} ce compte ?`)) return;

    try {
      await fetch(`/api/v1/admin/users/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status: newStatus }),
      });
      await loadStaff();
    } catch {
      setError("Erreur lors de la mise à jour");
    }
  }

  async function handleResetPassword(id: string, email: string) {
    if (!confirm(`Envoyer un email de réinitialisation à ${email} ?`)) return;

    try {
      await fetch(`/api/v1/admin/users/${id}/reset-password`, {
        method: "POST",
        headers,
      });
      setSuccess(`Email de réinitialisation envoyé à ${email}`);
    } catch {
      setError("Erreur lors de l'envoi");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-neon" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-md">Équipe</h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            {staff.length} membre{staff.length > 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-neon flex items-center gap-2">
          <Plus className="w-4 h-4" />
          INVITER
        </button>
      </div>

      {error && <div role="alert" className="font-mono text-xs text-red-400 bg-red-400/10 p-3 rounded">{error}</div>}
      {success && <div className="font-mono text-xs text-neon bg-neon/10 p-3 rounded">{success}</div>}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-surface border border-border p-5 space-y-4">
          <p className="spec-label">Nouvel employé</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="staff-firstName" className="block font-mono text-xs text-text-muted mb-1">Prénom</label>
              <input id="staff-firstName" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input-dark w-full" />
            </div>
            <div>
              <label htmlFor="staff-lastName" className="block font-mono text-xs text-text-muted mb-1">Nom</label>
              <input id="staff-lastName" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input-dark w-full" />
            </div>
            <div>
              <label htmlFor="staff-email" className="block font-mono text-xs text-text-muted mb-1">Email</label>
              <input id="staff-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-dark w-full" />
            </div>
            <div>
              <label htmlFor="staff-role" className="block font-mono text-xs text-text-muted mb-1">Rôle</label>
              <select id="staff-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input-dark w-full">
                <option value="STAFF">Employé</option>
                <option value="TECHNICIAN">Technicien</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={creating} className="btn-neon disabled:opacity-50">
              {creating ? "ENVOI..." : "ENVOYER L'INVITATION"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-outline">ANNULER</button>
          </div>
          <p className="font-mono text-[11px] text-text-dim">
            Un email sera envoyé à l&apos;employé avec un lien pour définir son mot de passe.
          </p>
        </form>
      )}

      {/* Staff list */}
      <div className="space-y-3">
        {staff.map((member) => (
          <div key={member.id} className="bg-surface border border-border p-4 flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm font-bold text-text">
                  {member.firstName} {member.lastName}
                </p>
                <span className={`font-mono text-[10px] font-bold ${ROLE_COLORS[member.role] || "text-text-muted"}`}>
                  {ROLE_LABELS[member.role] || member.role}
                </span>
                {member.status !== "ACTIVE" && (
                  <span className="font-mono text-[10px] text-red-400 border border-red-400/30 px-1.5 py-0.5">
                    {member.status}
                  </span>
                )}
              </div>
              <p className="font-mono text-xs text-text-muted">{member.email}</p>
              <p className="font-mono text-[11px] text-text-dim">
                {member.lastLoginAt
                  ? `Dernier login : ${new Date(member.lastLoginAt).toLocaleDateString("fr-FR")} (${member.loginCount} connexions)`
                  : "Jamais connecté"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleResetPassword(member.id, member.email)}
                className="p-2 text-text-muted hover:text-neon"
                title="Reset mot de passe"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleToggleStatus(member.id, member.status)}
                className={`p-2 ${member.status === "ACTIVE" ? "text-text-muted hover:text-red-400" : "text-red-400 hover:text-neon"}`}
                title={member.status === "ACTIVE" ? "Désactiver" : "Réactiver"}
              >
                <Shield className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
