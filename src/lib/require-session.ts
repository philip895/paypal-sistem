import { getSession, hasAtLeastRole } from "./auth";
import type { Role } from "./scheduling/types";

export class UnauthorizedError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Insufficient permissions") {
    super(message);
  }
}

/** Every mutating server action calls this first — never trust the client's role display. */
export async function requireRole(minimum: Role) {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  if (!hasAtLeastRole(session.role, minimum)) throw new ForbiddenError();
  return session;
}
