"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentStore } from "@/lib/store";
import { requireRole } from "@/lib/require-session";
import { writeAuditLog } from "@/lib/audit";
import { findRecurringConflicts } from "@/lib/scheduling/conflicts";
import type { RecurringRuleRecord } from "@/lib/scheduling/types";

export async function createRecurringRuleAction(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const session = await requireRole("ADMIN");
  const store = await getCurrentStore();

  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  const configId = String(formData.get("configId") || "");

  if (!configId || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return { error: "A configuration, start time, and end time are required." };
  }
  if (startTime === endTime) {
    return { error: "Start and end time can't be identical (that's either a 24-hour or zero-length window)." };
  }

  const existing = await prisma.recurringRule.findMany({ where: { storeId: store.id, active: true } });
  const existingRecords: RecurringRuleRecord[] = existing.map((r) => ({
    id: r.id,
    configId: r.configId,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    active: r.active,
  }));

  const candidate: RecurringRuleRecord = {
    id: "candidate",
    configId,
    dayOfWeek,
    startTime,
    endTime,
    active: true,
  };

  const conflicts = findRecurringConflicts(candidate, existingRecords, store.timezone);
  if (conflicts.length > 0) {
    return {
      error: `SCHEDULE CONFLICT: overlaps with ${conflicts.length} existing rule(s) on this day. Adjust the times first.`,
    };
  }

  const rule = await prisma.recurringRule.create({
    data: { storeId: store.id, dayOfWeek, startTime, endTime, configId, active: true },
  });

  await writeAuditLog({
    storeId: store.id,
    actorId: session.userId,
    action: "CREATE_RECURRING_RULE",
    targetType: "RecurringRule",
    targetId: rule.id,
    after: { dayOfWeek, startTime, endTime, configId },
  });

  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/calendar");
  return {};
}

export async function deleteRecurringRuleAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const store = await getCurrentStore();
  const id = String(formData.get("id") || "");

  const rule = await prisma.recurringRule.delete({ where: { id } });
  await writeAuditLog({
    storeId: store.id,
    actorId: session.userId,
    action: "DELETE_RECURRING_RULE",
    targetType: "RecurringRule",
    targetId: id,
    before: { dayOfWeek: rule.dayOfWeek, startTime: rule.startTime, endTime: rule.endTime },
  });

  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/calendar");
}
