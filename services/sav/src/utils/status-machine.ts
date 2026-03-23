// Status transition state machine for SAV repair tickets

export const REPAIR_STATUSES = [
  "NOUVEAU",
  "DIAGNOSTIQUE",
  "DEVIS_ENVOYE",
  "DEVIS_ACCEPTE",
  "EN_REPARATION",
  "EN_ATTENTE_PIECE",
  "TERMINE",
  "LIVRE",
  "REFUS_CLIENT",
  "IRREPARABLE",
] as const;

export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export const TERMINAL_STATUSES: ReadonlySet<RepairStatus> = new Set([
  "REFUS_CLIENT",
  "IRREPARABLE",
  "LIVRE",
]);

/**
 * Valid status transitions map.
 * Each key maps to an array of statuses it can transition to.
 */
export const STATUS_TRANSITIONS: Record<RepairStatus, readonly RepairStatus[]> = {
  NOUVEAU: ["DIAGNOSTIQUE", "IRREPARABLE"],
  DIAGNOSTIQUE: ["DEVIS_ENVOYE", "EN_REPARATION", "IRREPARABLE"],
  DEVIS_ENVOYE: ["DEVIS_ACCEPTE", "REFUS_CLIENT"],
  DEVIS_ACCEPTE: ["EN_REPARATION"],
  EN_REPARATION: ["EN_ATTENTE_PIECE", "TERMINE"],
  EN_ATTENTE_PIECE: ["EN_REPARATION"],
  TERMINE: ["LIVRE"],
  LIVRE: [],
  REFUS_CLIENT: [],
  IRREPARABLE: [],
};

/**
 * Validate whether a status transition is allowed.
 */
export function validateTransition(from: string, to: string): boolean {
  const allowed = STATUS_TRANSITIONS[from as RepairStatus];
  if (!allowed) return false;
  return allowed.includes(to as RepairStatus);
}

/**
 * Get all valid next statuses from a given status.
 */
export function getNextStatuses(current: string): string[] {
  const allowed = STATUS_TRANSITIONS[current as RepairStatus];
  if (!allowed) return [];
  return [...allowed];
}
