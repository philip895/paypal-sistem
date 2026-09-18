import type { RecurringRuleRecord, ScheduleOverrideRecord } from "./types";
import { expandRecurringRules } from "./recurring";

export interface ConflictPair<T> {
  a: T;
  b: T;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Checks a candidate recurring rule against existing active rules for the
 * store, over a representative window, and reports any that would overlap.
 * One-time overrides always win by priority, so they are never a conflict
 * against recurring rules — only recurring-vs-recurring overlaps are
 * ambiguous and must be rejected.
 */
export function findRecurringConflicts(
  candidate: RecurringRuleRecord,
  existingRules: RecurringRuleRecord[],
  timezone: string,
  sampleWeeks = 2
): RecurringRuleRecord[] {
  const others = existingRules.filter((r) => r.id !== candidate.id && r.active);
  if (others.length === 0) return [];

  const rangeStart = new Date();
  const rangeEnd = new Date(rangeStart.getTime() + sampleWeeks * 7 * 24 * 60 * 60 * 1000);

  const candidateWindows = expandRecurringRules([candidate], rangeStart, rangeEnd, timezone);
  const otherWindows = expandRecurringRules(others, rangeStart, rangeEnd, timezone);

  const conflicting = new Set<string>();
  for (const cw of candidateWindows) {
    for (const ow of otherWindows) {
      if (overlaps(cw.startUtc, cw.endUtc, ow.startUtc, ow.endUtc)) {
        conflicting.add(ow.rule.id);
      }
    }
  }

  return others.filter((r) => conflicting.has(r.id));
}

/**
 * One-time overrides for the same store must not overlap each other either
 * (there is no priority rule between two simultaneous one-time overrides,
 * so this is always ambiguous and must be rejected at save time).
 */
export function findOverrideConflicts(
  candidate: ScheduleOverrideRecord,
  existingOverrides: ScheduleOverrideRecord[]
): ScheduleOverrideRecord[] {
  return existingOverrides.filter(
    (o) => o.id !== candidate.id && overlaps(candidate.startAt, candidate.endAt, o.startAt, o.endAt)
  );
}
