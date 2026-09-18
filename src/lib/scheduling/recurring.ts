import { DateTime } from "luxon";
import type { RecurringRuleRecord } from "./types";

export interface ConcreteWindow {
  rule: RecurringRuleRecord;
  /** The wall-clock calendar date (in the store timezone) the window starts on. */
  anchorDate: DateTime;
  startUtc: Date;
  endUtc: Date;
}

function parseTime(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(":").map(Number);
  return { hour, minute };
}

/**
 * Builds the concrete UTC interval for a recurring rule anchored on a given
 * wall-clock calendar date in the store's timezone. An end time that is
 * less-than-or-equal to the start time is treated as crossing midnight
 * (e.g. 16:00 -> 00:00, or 22:00 -> 02:00), landing the end on the next
 * calendar day. Using the IANA zone via luxon means DST transitions are
 * resolved correctly for that specific date, not computed with a flat
 * 24-hour offset.
 */
export function concreteWindowFor(
  rule: RecurringRuleRecord,
  anchorDate: DateTime,
  timezone: string
): ConcreteWindow {
  const start = parseTime(rule.startTime);
  const end = parseTime(rule.endTime);

  const startDt = anchorDate.setZone(timezone).set({
    hour: start.hour,
    minute: start.minute,
    second: 0,
    millisecond: 0,
  });

  const crossesMidnight =
    end.hour < start.hour || (end.hour === start.hour && end.minute <= start.minute);

  let endDt = anchorDate.setZone(timezone).set({
    hour: end.hour,
    minute: end.minute,
    second: 0,
    millisecond: 0,
  });
  if (crossesMidnight) {
    endDt = endDt.plus({ days: 1 });
  }

  return {
    rule,
    anchorDate,
    startUtc: startDt.toUTC().toJSDate(),
    endUtc: endDt.toUTC().toJSDate(),
  };
}

/**
 * Returns every concrete window that could possibly cover `now`: each
 * active rule anchored on "today" and "yesterday" (store timezone), since a
 * rule anchored yesterday can still be running past midnight.
 */
export function windowsCoveringInstant(
  rules: RecurringRuleRecord[],
  now: Date,
  timezone: string
): ConcreteWindow[] {
  const nowZoned = DateTime.fromJSDate(now, { zone: "utc" }).setZone(timezone);
  const today = nowZoned.startOf("day");
  const yesterday = today.minus({ days: 1 });

  const candidates: ConcreteWindow[] = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    for (const anchor of [yesterday, today]) {
      if (anchor.weekday % 7 !== rule.dayOfWeek) {
        // luxon weekday: 1=Monday..7=Sunday; convert to 0=Sunday..6=Saturday
        continue;
      }
      candidates.push(concreteWindowFor(rule, anchor, timezone));
    }
  }

  return candidates.filter((w) => w.startUtc <= now && now < w.endUtc);
}

/**
 * Expands all active rules into concrete windows over [rangeStart, rangeEnd)
 * for calendar display and conflict detection.
 */
export function expandRecurringRules(
  rules: RecurringRuleRecord[],
  rangeStart: Date,
  rangeEnd: Date,
  timezone: string
): ConcreteWindow[] {
  const windows: ConcreteWindow[] = [];
  let cursor = DateTime.fromJSDate(rangeStart, { zone: "utc" })
    .setZone(timezone)
    .minus({ days: 1 })
    .startOf("day");
  const end = DateTime.fromJSDate(rangeEnd, { zone: "utc" }).setZone(timezone);

  while (cursor <= end) {
    for (const rule of rules) {
      if (!rule.active) continue;
      if (cursor.weekday % 7 !== rule.dayOfWeek) continue;
      const w = concreteWindowFor(rule, cursor, timezone);
      if (w.endUtc > rangeStart && w.startUtc < rangeEnd) {
        windows.push(w);
      }
    }
    cursor = cursor.plus({ days: 1 });
  }

  return windows.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
}
