import type { ResolutionInput, ResolvedConfiguration, RecurringRuleRecord } from "./types";
import { windowsCoveringInstant, expandRecurringRules } from "./recurring";

/**
 * Priority engine. Resolves exactly one configuration for `now`, in strict
 * order: emergency manual override > one-time schedule override > recurring
 * schedule > safe default. Never returns an ambiguous result — if nothing
 * resolves, falls through to the safe default (which may itself be null,
 * meaning "no valid configuration").
 */
export function resolveCurrentConfiguration(input: ResolutionInput): ResolvedConfiguration {
  const { now, manualOverrides } = input;

  // 1. Emergency manual override
  const activeManual = manualOverrides.find((o) => o.active && o.startedAt <= now);
  if (activeManual) {
    let activeUntil: Date | null = null;

    if (activeManual.expiryMode === "FIXED_DURATION") {
      if (activeManual.expiresAt && activeManual.expiresAt > now) {
        activeUntil = activeManual.expiresAt;
      } else {
        // Expired fixed-duration override: fall through as if it weren't active.
        return resolveWithoutManualOverride(input);
      }
    } else if (activeManual.expiryMode === "UNTIL_NEXT_SCHEDULE") {
      const underlying = resolveWithoutManualOverride({
        ...input,
        now: activeManual.startedAt,
      });
      activeUntil = underlying.activeUntil;
      if (activeUntil && activeUntil <= now) {
        // The underlying schedule has already moved past its boundary.
        return resolveWithoutManualOverride(input);
      }
    } else {
      // UNTIL_DISABLED — open-ended until someone deactivates it.
      activeUntil = null;
    }

    return {
      configId: activeManual.configId,
      source: "MANUAL_OVERRIDE",
      reason: "Manual override",
      sourceId: activeManual.id,
      activeSince: activeManual.startedAt,
      activeUntil,
    };
  }

  return resolveWithoutManualOverride(input);
}

function resolveWithoutManualOverride(input: ResolutionInput): ResolvedConfiguration {
  const { now, timezone, scheduleOverrides, recurringRules, safeDefaultConfigId } = input;

  // 2. One-time schedule override
  const activeOverride = scheduleOverrides.find((o) => o.startAt <= now && now < o.endAt);
  if (activeOverride) {
    return {
      configId: activeOverride.configId,
      source: "ONE_TIME_OVERRIDE",
      reason: "One-time schedule override",
      sourceId: activeOverride.id,
      activeSince: activeOverride.startAt,
      activeUntil: activeOverride.endAt,
    };
  }

  // 3. Recurring schedule
  const covering = windowsCoveringInstant(recurringRules, now, timezone);
  if (covering.length > 0) {
    // Conflict detection at save time should make this list have at most
    // one entry; if data slipped through anyway, prefer the narrowest window.
    const chosen = covering.sort(
      (a, b) => a.endUtc.getTime() - a.startUtc.getTime() - (b.endUtc.getTime() - b.startUtc.getTime())
    )[0];
    return {
      configId: chosen.rule.configId,
      source: "RECURRING",
      reason: "Recurring schedule",
      sourceId: chosen.rule.id,
      activeSince: chosen.startUtc,
      activeUntil: chosen.endUtc,
    };
  }

  // 4. Safe default
  if (safeDefaultConfigId) {
    return {
      configId: safeDefaultConfigId,
      source: "SAFE_DEFAULT",
      reason: "Safe default configuration (no schedule covers this time)",
      sourceId: null,
      activeSince: null,
      activeUntil: nextRecurringBoundaryAfter(now, recurringRules, timezone),
    };
  }

  return {
    configId: null,
    source: "NONE",
    reason: "No valid configuration could be resolved",
    sourceId: null,
    activeSince: null,
    activeUntil: null,
  };
}

/** Scans forward day by day (bounded) to find when the next recurring window begins. */
function nextRecurringBoundaryAfter(
  now: Date,
  recurringRules: RecurringRuleRecord[],
  timezone: string,
  maxDaysAhead = 14
): Date | null {
  if (recurringRules.every((r) => !r.active)) return null;

  const rangeEnd = new Date(now.getTime() + maxDaysAhead * 24 * 60 * 60 * 1000);
  const windows = expandRecurringRules(recurringRules, now, rangeEnd, timezone);
  const next = windows.find((w) => w.startUtc > now);
  return next ? next.startUtc : null;
}

/**
 * Resolves what will be active at (or immediately after) a given boundary —
 * used to populate NEXT_CONFIGURATION / NEXT_SWITCH_TIME on the dashboard.
 * Manual overrides are intentionally excluded from this look-ahead: "next"
 * describes the underlying schedule, not a currently-running override.
 */
export function resolveNextTransition(
  input: ResolutionInput
): { configId: string; at: Date; reason: string } | null {
  const current = resolveCurrentConfiguration(input);
  if (!current.activeUntil) return null;

  const boundary = current.activeUntil;
  const after = resolveWithoutManualOverride({
    ...input,
    now: new Date(boundary.getTime() + 1000),
  });

  if (!after.configId) return null;
  return { configId: after.configId, at: boundary, reason: after.reason };
}
