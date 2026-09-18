"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { requireRole } from "@/lib/require-session";
import { prisma } from "@/lib/db";
import { getCurrentStore } from "@/lib/store";
import { getDashboardStatus } from "@/lib/scheduling/service";
import { writeAuditLog, writeNotification } from "@/lib/audit";

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

/**
 * The human confirms they've completed the manual Shopify-side step
 * (reconnecting PayPal in Admin to the resolved configuration). This is the
 * "manual click" stand-in for the live Payments App switch this account's
 * Basic plan can't perform automatically — see the architecture doc's
 * Decision Gate. Recording it here is what closes out the pending
 * transition and starts the new ACTIVATION_HISTORY row.
 */
export async function confirmSwitchAction() {
  const session = await requireRole("ADMIN");
  const store = await getCurrentStore();
  const status = await getDashboardStatus(store.id, store.timezone);

  if (!status.pendingConfirmation || !status.resolved.configId) {
    return;
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.activationHistory.updateMany({
      where: { storeId: store.id, deactivatedAt: null },
      data: { deactivatedAt: now },
    });
    await tx.activationHistory.create({
      data: {
        storeId: store.id,
        configId: status.resolved.configId!,
        activatedAt: now,
        reason: status.resolved.source === "NONE" ? "SAFE_DEFAULT" : status.resolved.source,
        triggeredById: session.userId,
        result: "SUCCESS",
      },
    });
  });

  await writeAuditLog({
    storeId: store.id,
    actorId: session.userId,
    action: "CONFIRM_SWITCH",
    targetType: "PaymentConfiguration",
    targetId: status.resolved.configId,
    after: { reason: status.resolved.reason },
  });

  revalidatePath("/dashboard");
}

export async function toggleAutomationPausedAction(paused: boolean) {
  const session = await requireRole("ADMIN");
  const store = await getCurrentStore();

  await prisma.store.update({ where: { id: store.id }, data: { automationPaused: paused } });
  await writeAuditLog({
    storeId: store.id,
    actorId: session.userId,
    action: paused ? "PAUSE_AUTOMATION" : "RESUME_AUTOMATION",
    targetType: "Store",
    targetId: store.id,
  });

  revalidatePath("/dashboard");
}

export async function startEmergencyOverrideAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const store = await getCurrentStore();

  const configId = String(formData.get("configId") || "");
  const durationChoice = String(formData.get("duration") || "1h");
  if (!configId) throw new Error("È necessario selezionare una configurazione.");

  const now = new Date();
  let expiresAt: Date | null = null;
  let expiryMode: "FIXED_DURATION" | "UNTIL_NEXT_SCHEDULE" | "UNTIL_DISABLED" = "FIXED_DURATION";

  const durationMap: Record<string, number> = {
    "30m": 30 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "2h": 2 * 60 * 60 * 1000,
  };

  if (durationChoice in durationMap) {
    expiresAt = new Date(now.getTime() + durationMap[durationChoice]);
  } else if (durationChoice === "until_next_schedule") {
    expiryMode = "UNTIL_NEXT_SCHEDULE";
  } else if (durationChoice === "until_disabled") {
    expiryMode = "UNTIL_DISABLED";
  }

  await prisma.$transaction(async (tx) => {
    // Enforces the single-active-configuration rule: only one active manual
    // override per store at a time.
    await tx.manualOverride.updateMany({
      where: { storeId: store.id, active: true },
      data: { active: false, endedAt: now, endedReason: "SUPERSEDED_BY_NEW_OVERRIDE" },
    });
    await tx.manualOverride.create({
      data: {
        storeId: store.id,
        configId,
        startedAt: now,
        expiresAt,
        expiryMode,
        createdById: session.userId,
        active: true,
      },
    });
  });

  await writeAuditLog({
    storeId: store.id,
    actorId: session.userId,
    action: "START_MANUAL_OVERRIDE",
    targetType: "PaymentConfiguration",
    targetId: configId,
    after: { expiryMode, expiresAt },
  });
  await writeNotification({
    storeId: store.id,
    channel: "WEBHOOK",
    eventType: "MANUAL_OVERRIDE_STARTED",
    payload: { configId, expiryMode, expiresAt, by: session.email },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/overrides");
}

export async function endManualOverrideAction(overrideId: string) {
  const session = await requireRole("ADMIN");
  const store = await getCurrentStore();

  await prisma.manualOverride.updateMany({
    where: { id: overrideId, storeId: store.id, active: true },
    data: { active: false, endedAt: new Date(), endedReason: "MANUALLY_DISABLED" },
  });

  await writeAuditLog({
    storeId: store.id,
    actorId: session.userId,
    action: "END_MANUAL_OVERRIDE",
    targetType: "ManualOverride",
    targetId: overrideId,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/overrides");
}

export async function requireSessionOrRedirect() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
