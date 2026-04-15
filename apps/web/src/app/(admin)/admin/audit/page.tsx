"use client";

import { useEffect, useMemo, useState } from "react";
import { auditApi, type AuditLogEntry } from "@/lib/api";
import { Loader2, ShieldCheck, User, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_STYLES: Record<string, string> = {
  POST: "text-neon border-neon/40 bg-neon-dim",
  PUT: "text-warning border-warning/40 bg-warning/10",
  PATCH: "text-warning border-warning/40 bg-warning/10",
  DELETE: "text-danger border-danger/40 bg-danger/10",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

function parseDetails(details: string | null): {
  method?: string;
  path?: string;
  statusCode?: number;
  body?: unknown;
} | null {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resourceFilter, setResourceFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await auditApi.list({
          limit: 100,
          resource: resourceFilter || undefined,
          action: actionFilter || undefined,
        });
        if (cancelled) return;
        setEntries(res.data || []);
        setTotal(res.pagination?.total ?? res.data.length);
      } catch {
        if (!cancelled) {
          setEntries([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [resourceFilter, actionFilter]);

  const resources = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.resource);
    return Array.from(set).sort();
  }, [entries]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-lg">JOURNAL D&apos;AUDIT</h1>
        <p className="font-mono text-sm text-text-muted mt-1">
          Qui a fait quoi dans l&apos;admin · {total} entrée{total !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="bg-surface border border-border p-3 flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-text-dim" />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="input-dark"
        >
          <option value="">Toutes les actions</option>
          <option value="POST">POST (créations)</option>
          <option value="PUT">PUT (éditions complètes)</option>
          <option value="PATCH">PATCH (éditions partielles)</option>
          <option value="DELETE">DELETE (suppressions)</option>
        </select>
        <input
          type="text"
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
          placeholder="Ressource (products, orders, stock…)"
          className="input-dark flex-1 min-w-[180px]"
          list="audit-resources"
        />
        <datalist id="audit-resources">
          {resources.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </div>

      <div className="bg-surface border border-border">
        {loading ? (
          <div className="p-6 flex items-center gap-2 font-mono text-xs text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-neon" />
            Chargement…
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center">
            <ShieldCheck className="h-10 w-10 text-text-dim mx-auto mb-3" />
            <p className="font-mono text-sm text-text-muted">
              Aucune entrée pour ces filtres.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((entry) => {
              const meta = parseDetails(entry.details);
              const isExpanded = expanded === entry.id;
              const actionClass =
                ACTION_STYLES[entry.action] ?? "text-text-dim border-border bg-surface-2";
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : entry.id)}
                    className="w-full text-left p-3 hover:bg-surface-2/40 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider shrink-0 w-[66px] justify-center",
                          actionClass,
                        )}
                      >
                        {entry.action}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-text truncate">
                          <span className="text-text-dim">{entry.resource}</span>
                          {entry.resourceId ? (
                            <>
                              {" · "}
                              <span className="text-neon">{entry.resourceId.slice(0, 8)}</span>
                            </>
                          ) : null}
                          {meta?.statusCode ? (
                            <>
                              {" · "}
                              <span
                                className={cn(
                                  "font-mono",
                                  meta.statusCode >= 200 && meta.statusCode < 300
                                    ? "text-neon"
                                    : "text-danger",
                                )}
                              >
                                {meta.statusCode}
                              </span>
                            </>
                          ) : null}
                        </p>
                        <p className="font-mono text-[11px] text-text-dim truncate flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {entry.userName ?? "anonyme"}
                          {entry.ipAddress ? ` · ${entry.ipAddress}` : ""}
                          {` · ${formatDate(entry.createdAt)}`}
                        </p>
                      </div>
                    </div>
                    {isExpanded && meta ? (
                      <div className="mt-3 pl-[82px] space-y-1">
                        {meta.path ? (
                          <p className="font-mono text-[11px] text-text-dim break-all">
                            {meta.method} {meta.path}
                          </p>
                        ) : null}
                        {meta.body !== undefined && meta.body !== null ? (
                          <pre className="font-mono text-[10px] text-text-muted bg-void/60 border border-border p-2 overflow-auto max-h-64">
                            {JSON.stringify(meta.body, null, 2)}
                          </pre>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
