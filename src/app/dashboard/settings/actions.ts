"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentStore } from "@/lib/store";
import { requireRole } from "@/lib/require-session";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import type { Role } from "@/lib/scheduling/types";

export async function updateSafeDefaultAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const store = await getCurrentStore();
  const safeDefaultConfigId = String(formData.get("safeDefaultConfigId") || "") || null;

  await prisma.store.update({ where: { id: store.id }, data: { safeDefaultConfigId } });
  await writeAuditLog({
    storeId: store.id,
    actorId: session.userId,
    action: "UPDATE_SAFE_DEFAULT",
    targetType: "Store",
    targetId: store.id,
    after: { safeDefaultConfigId },
  });

  revalidatePath("/dashboard/settings");
}

/** Requires OWNER: this is the confirmed switch from SIMULATION to LIVE routing. */
export async function updateAutomationModeAction(formData: FormData) {
  const session = await requireRole("OWNER");
  const store = await getCurrentStore();
  const automationMode = String(formData.get("automationMode") || "SIMULATION");

  await prisma.store.update({ where: { id: store.id }, data: { automationMode } });
  await writeAuditLog({
    storeId: store.id,
    actorId: session.userId,
    action: "UPDATE_AUTOMATION_MODE",
    targetType: "Store",
    targetId: store.id,
    after: { automationMode },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

export async function createUserAction(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const session = await requireRole("OWNER");
  const store = await getCurrentStore();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "VIEWER") as Role;

  if (!email || password.length < 8) {
    return { error: "Email and an 8+ character password are required." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with that email already exists." };

  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), role },
  });

  await writeAuditLog({
    storeId: store.id,
    actorId: session.userId,
    action: "CREATE_USER",
    targetType: "User",
    targetId: user.id,
    after: { email, role },
  });

  revalidatePath("/dashboard/settings");
  return {};
}
