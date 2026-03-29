// Status transition state machine for SAV repair tickets

export const REPAIR_STATUSES = [
  "RECU",
  "DIAGNOSTIC",
  "DEVIS_ENVOYE",
  "DEVIS_ACCEPTE",
  "EN_REPARATION",
  "EN_ATTENTE_PIECE",
  "PRET",
  "RECUPERE",
  "REFUS_CLIENT",
  "IRREPARABLE",
] as const;

export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export const TERMINAL_STATUSES: ReadonlySet<RepairStatus> = new Set([
  "REFUS_CLIENT",
  "IRREPARABLE",
  "RECUPERE",
]);

/**
 * Valid status transitions map.
 * Pipeline: RECU → DIAGNOSTIC → DEVIS_ENVOYE → DEVIS_ACCEPTE → EN_REPARATION → PRET → RECUPERE
 */
export const STATUS_TRANSITIONS: Record<RepairStatus, readonly RepairStatus[]> = {
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
