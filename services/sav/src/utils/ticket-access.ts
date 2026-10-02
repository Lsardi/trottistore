import { ForbiddenError, UnauthorizedError } from "@trottistore/shared";

export function assertTicketAccess(
  user: { userId: string; role: string } | undefined,
  ticket: { customerId: string | null; assignedTo: string | null },
): void {
  if (!user) throw new UnauthorizedError("Authentification requise");
  if ((user.role === "CLIENT" && ticket.customerId !== user.userId)
    || (user.role === "TECHNICIAN" && ticket.assignedTo !== user.userId)
    || !["CLIENT", "TECHNICIAN", "STAFF", "MANAGER", "ADMIN", "SUPERADMIN"].includes(user.role)) {
    throw new ForbiddenError("Accès interdit à ce ticket");
  }
}
