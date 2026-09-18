"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentStore } from "@/lib/store";
import { requireRole } from "@/lib/require-session";
import { writeAuditLog } from "@/lib/audit";
import { findOverrideConflicts } from "@/lib/scheduling/conflicts";

export async function createScheduleOverrideAction(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const session = await requireRole("ADMIN");
  const store = await getCurrentStore();

  const configId = String(formData.get("configId") || "");
  const startAtLocal = String(formData.get("startAt") || "");
  const endAtLocal = String(formData.get("endAt") || "");
  const reason = String(formData.get("reason") || "").trim() || null;

  if (!configId || !startAtLocal || !endAtLocal) {
    return { error: "Configuration, start, and end are required." };
  }

  // datetime-local inputs are naive wall-clock strings in the store's timezone.
  const { DateTime } = await import("luxon");
  const startAt = DateTime.fromISO(startAtLocal, { zone: store.timezone }).toUTC().toJSDate();
  const endAt = DateTime.fromISO(endAtLocal, { zone: store.timezone }).toUTC().toJSDate();

  if (endAt <= startAt) {
    return { error: "End must be after start." };
  }

  const existing = await prisma.scheduleOverride.findMany({
    where: { storeId: store.id, endAt: { gt: new Date() } },
  });

  const conflicts = findOverrideConflicts(
    { id: "candidate", configId, startAt, endAt },
    existing.map((o) => ({ id: o.id, configId: o.configId, startAt: o.startAt, endAt: o.endAt }))
  );
  if (conflicts.length > 0) {
    return { error: `SCHEDULE CONFLICT: overlaps with ${conflicts.length} existing override(s).` };
  }

  const override = await prisma.scheduleOverride.create({
    data: { storeId: store.id, configId, startAt, endAt, reason, createdById: session.userId },
  });

  await writeAuditLog({
    storeId: store.id,
    actorId: session.userId,
    action: "CREATE_SCHEDULE_OVERRIDE",
    targetType: "ScheduleOverride",
    targetId: override.id,
    after: { configId, startAt, endAt, reason },
  });

  revalidatePath("/dashboard/overrides");
  revalidatePath("/dashboard/calendar");
  return {};
}

export async function deleteScheduleOverrideAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const store = await getCurrentStore();
  const id = String(formData.get("id") || "");

  const override = await prisma.scheduleOverride.delete({ where: { id } });
  await writeAuditLog({
    storeId: store.id,
    actorId: session.userId,
    action: "DELETE_SCHEDULE_OVERRIDE",
    targetType: "ScheduleOverride",
    targetId: id,
    before: { configId: override.configId, startAt: override.startAt, endAt: override.endAt },
  });

  revalidatePath("/dashboard/overrides");
  revalidatePath("/dashboard/calendar");
}
