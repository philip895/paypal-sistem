import { prisma } from "@/lib/db";
import {
  resolveCurrentConfiguration,
  resolveNextTransition,
} from "./resolver";
import type {
  ExpiryMode,
  ManualOverrideRecord,
  RecurringRuleRecord,
  ResolutionInput,
  ScheduleOverrideRecord,
} from "./types";

/** How long a resolved-but-unconfirmed switch can sit before we flag it overdue. */
export const CONFIRMATION_GRACE_MS = 15 * 60 * 1000; // 15 minutes

export async function loadResolutionInput(
  storeId: string,
  timezone: string,
  now: Date = new Date()
): Promise<ResolutionInput> {
  const rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [manualOverrides, scheduleOverrides, recurringRules, store] = await Promise.all([
    prisma.manualOverride.findMany({ where: { storeId, active: true } }),
    prisma.scheduleOverride.findMany({
      where: { storeId, endAt: { gt: rangeStart }, startAt: { lt: rangeEnd } },
    }),
    prisma.recurringRule.findMany({ where: { storeId, active: true } }),
    prisma.store.findUniqueOrThrow({ where: { id: storeId } }),
  ]);

  return {
    now,
    timezone,
    manualOverrides: manualOverrides.map(
      (o): ManualOverrideRecord => ({
        id: o.id,
        configId: o.configId,
        startedAt: o.startedAt,
        expiresAt: o.expiresAt,
        expiryMode: o.expiryMode as ExpiryMode,
        active: o.active,
      })
    ),
    scheduleOverrides: scheduleOverrides.map(
      (o): ScheduleOverrideRecord => ({
        id: o.id,
        configId: o.configId,
        startAt: o.startAt,
        endAt: o.endAt,
      })
    ),
    recurringRules: recurringRules.map(
      (r): RecurringRuleRecord => ({
        id: r.id,
        configId: r.configId,
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        active: r.active,
      })
    ),
    safeDefaultConfigId: store.safeDefaultConfigId,
  };
}

export interface DashboardStatus {
  resolved: ReturnType<typeof resolveCurrentConfiguration>;
  next: ReturnType<typeof resolveNextTransition>;
  /** The configuration actually recorded as active (last human-confirmed switch). */
  confirmedConfigId: string | null;
  confirmedAt: Date | null;
  /** True when the resolver wants a different config than what's confirmed. */
  pendingConfirmation: boolean;
  /** True when a pending confirmation has sat unconfirmed past the grace period. */
  overdue: boolean;
}

export async function getDashboardStatus(storeId: string, timezone: string): Promise<DashboardStatus> {
  const now = new Date();
  const input = await loadResolutionInput(storeId, timezone, now);
  const resolved = resolveCurrentConfiguration(input);
  const next = resolveNextTransition(input);

  const lastActivation = await prisma.activationHistory.findFirst({
    where: { storeId, deactivatedAt: null, result: "SUCCESS" },
    orderBy: { activatedAt: "desc" },
  });

  const confirmedConfigId = lastActivation?.configId ?? null;
  const confirmedAt = lastActivation?.activatedAt ?? null;
  const pendingConfirmation = resolved.configId !== null && resolved.configId !== confirmedConfigId;
  const overdue =
    pendingConfirmation &&
    resolved.activeSince !== null &&
    now.getTime() - resolved.activeSince.getTime() > CONFIRMATION_GRACE_MS;

  return { resolved, next, confirmedConfigId, confirmedAt, pendingConfirmation, overdue };
}
