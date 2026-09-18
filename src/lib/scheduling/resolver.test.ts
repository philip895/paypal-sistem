import { describe, it, expect } from "vitest";
import { resolveCurrentConfiguration, resolveNextTransition } from "./resolver";
import { findRecurringConflicts, findOverrideConflicts } from "./conflicts";
import type { ResolutionInput, RecurringRuleRecord } from "./types";

const TZ = "Europe/Rome";

function baseInput(overrides: Partial<ResolutionInput> = {}): ResolutionInput {
  return {
    now: new Date("2026-09-21T10:00:00Z"), // a Monday
    timezone: TZ,
    manualOverrides: [],
    scheduleOverrides: [],
    recurringRules: [],
    safeDefaultConfigId: "safe-config",
    ...overrides,
  };
}

describe("resolveCurrentConfiguration — priority order", () => {
  it("falls back to the safe default when nothing else resolves", () => {
    const result = resolveCurrentConfiguration(baseInput());
    expect(result.configId).toBe("safe-config");
    expect(result.source).toBe("SAFE_DEFAULT");
  });

  it("returns NONE when there is no safe default either", () => {
    const result = resolveCurrentConfiguration(baseInput({ safeDefaultConfigId: null }));
    expect(result.configId).toBeNull();
    expect(result.source).toBe("NONE");
  });

  it("picks the recurring schedule over the safe default", () => {
    // Monday 2026-09-21 in Europe/Rome, 10:00 local falls in an 08:00-16:00 window.
    const rule: RecurringRuleRecord = {
      id: "r1",
      configId: "config-a",
      dayOfWeek: 1, // Monday
      startTime: "08:00",
      endTime: "16:00",
      active: true,
    };
    const result = resolveCurrentConfiguration(baseInput({ recurringRules: [rule] }));
    expect(result.configId).toBe("config-a");
    expect(result.source).toBe("RECURRING");
  });

  it("handles a recurring window that crosses midnight", () => {
    // Sunday 20:00 -> Monday 00:00. now = Monday 2026-09-21T22:30 Rome time
    // should NOT match; but 2026-09-20 23:00 Rome (Sunday) should.
    const rule: RecurringRuleRecord = {
      id: "r2",
      configId: "config-night",
      dayOfWeek: 0, // Sunday
      startTime: "20:00",
      endTime: "00:00",
      active: true,
    };
    const sundayNight = new Date("2026-09-20T21:30:00Z"); // ~23:30 Rome (CEST, UTC+2)
    const result = resolveCurrentConfiguration(
      baseInput({ now: sundayNight, recurringRules: [rule] })
    );
    expect(result.configId).toBe("config-night");
    expect(result.source).toBe("RECURRING");
  });

  it("one-time override beats recurring schedule", () => {
    const rule: RecurringRuleRecord = {
      id: "r1",
      configId: "config-a",
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "16:00",
      active: true,
    };
    const result = resolveCurrentConfiguration(
      baseInput({
        recurringRules: [rule],
        scheduleOverrides: [
          {
            id: "o1",
            configId: "config-override",
            startAt: new Date("2026-09-21T09:00:00Z"),
            endAt: new Date("2026-09-21T11:00:00Z"),
          },
        ],
      })
    );
    expect(result.configId).toBe("config-override");
    expect(result.source).toBe("ONE_TIME_OVERRIDE");
  });

  it("manual override beats everything, including one-time overrides", () => {
    const result = resolveCurrentConfiguration(
      baseInput({
        scheduleOverrides: [
          {
            id: "o1",
            configId: "config-override",
            startAt: new Date("2026-09-21T09:00:00Z"),
            endAt: new Date("2026-09-21T11:00:00Z"),
          },
        ],
        manualOverrides: [
          {
            id: "m1",
            configId: "config-manual",
            startedAt: new Date("2026-09-21T09:30:00Z"),
            expiresAt: new Date("2026-09-21T10:30:00Z"),
            expiryMode: "FIXED_DURATION",
            active: true,
          },
        ],
      })
    );
    expect(result.configId).toBe("config-manual");
    expect(result.source).toBe("MANUAL_OVERRIDE");
    expect(result.activeUntil).toEqual(new Date("2026-09-21T10:30:00Z"));
  });

  it("falls through once a FIXED_DURATION manual override has expired", () => {
    const result = resolveCurrentConfiguration(
      baseInput({
        manualOverrides: [
          {
            id: "m1",
            configId: "config-manual",
            startedAt: new Date("2026-09-21T08:00:00Z"),
            expiresAt: new Date("2026-09-21T09:00:00Z"), // expired before `now` (10:00Z)
            expiryMode: "FIXED_DURATION",
            active: true,
          },
        ],
      })
    );
    expect(result.source).not.toBe("MANUAL_OVERRIDE");
  });

  it("UNTIL_DISABLED manual override never auto-expires", () => {
    const result = resolveCurrentConfiguration(
      baseInput({
        now: new Date("2026-12-01T00:00:00Z"),
        manualOverrides: [
          {
            id: "m1",
            configId: "config-manual",
            startedAt: new Date("2026-09-21T08:00:00Z"),
            expiresAt: null,
            expiryMode: "UNTIL_DISABLED",
            active: true,
          },
        ],
      })
    );
    expect(result.configId).toBe("config-manual");
    expect(result.activeUntil).toBeNull();
  });

  it("never returns ambiguous results: exactly one configId for any input", () => {
    const rule: RecurringRuleRecord = {
      id: "r1",
      configId: "config-a",
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "16:00",
      active: true,
    };
    const result = resolveCurrentConfiguration(baseInput({ recurringRules: [rule] }));
    expect(typeof result.configId === "string" || result.configId === null).toBe(true);
    expect(["MANUAL_OVERRIDE", "ONE_TIME_OVERRIDE", "RECURRING", "SAFE_DEFAULT", "NONE"]).toContain(
      result.source
    );
  });
});

describe("resolveNextTransition", () => {
  it("reports the next recurring configuration after the current window ends", () => {
    const rules: RecurringRuleRecord[] = [
      { id: "r1", configId: "config-a", dayOfWeek: 1, startTime: "08:00", endTime: "16:00", active: true },
      { id: "r2", configId: "config-b", dayOfWeek: 1, startTime: "16:00", endTime: "00:00", active: true },
    ];
    const next = resolveNextTransition(baseInput({ recurringRules: rules }));
    expect(next?.configId).toBe("config-b");
  });

  it("returns null when the active window is open-ended", () => {
    const next = resolveNextTransition(
      baseInput({
        manualOverrides: [
          {
            id: "m1",
            configId: "config-manual",
            startedAt: new Date("2026-09-21T08:00:00Z"),
            expiresAt: null,
            expiryMode: "UNTIL_DISABLED",
            active: true,
          },
        ],
      })
    );
    expect(next).toBeNull();
  });
});

describe("conflict detection", () => {
  it("flags overlapping recurring rules on the same day", () => {
    const existing: RecurringRuleRecord = {
      id: "r1",
      configId: "config-a",
      dayOfWeek: 1,
      startTime: "16:00",
      endTime: "20:00",
      active: true,
    };
    const candidate: RecurringRuleRecord = {
      id: "r2",
      configId: "config-b",
      dayOfWeek: 1,
      startTime: "19:00",
      endTime: "22:00",
      active: true,
    };
    const conflicts = findRecurringConflicts(candidate, [existing], TZ);
    expect(conflicts.map((r) => r.id)).toEqual(["r1"]);
  });

  it("does not flag adjacent (touching, non-overlapping) recurring rules", () => {
    const existing: RecurringRuleRecord = {
      id: "r1",
      configId: "config-a",
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "16:00",
      active: true,
    };
    const candidate: RecurringRuleRecord = {
      id: "r2",
      configId: "config-b",
      dayOfWeek: 1,
      startTime: "16:00",
      endTime: "20:00",
      active: true,
    };
    const conflicts = findRecurringConflicts(candidate, [existing], TZ);
    expect(conflicts).toHaveLength(0);
  });

  it("flags overlapping one-time overrides", () => {
    const existing = {
      id: "o1",
      configId: "config-a",
      startAt: new Date("2026-09-20T16:00:00Z"),
      endAt: new Date("2026-09-20T20:00:00Z"),
    };
    const candidate = {
      id: "o2",
      configId: "config-b",
      startAt: new Date("2026-09-20T19:00:00Z"),
      endAt: new Date("2026-09-20T22:00:00Z"),
    };
    expect(findOverrideConflicts(candidate, [existing])).toHaveLength(1);
  });
});
