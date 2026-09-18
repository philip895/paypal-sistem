import { DateTime } from "luxon";
import Link from "next/link";
import { getCurrentStore } from "@/lib/store";
import { prisma } from "@/lib/db";
import { expandRecurringRules } from "@/lib/scheduling/recurring";
import type { RecurringRuleRecord } from "@/lib/scheduling/types";

type ViewMode = "day" | "week" | "month";

function rangeFor(view: ViewMode, anchor: DateTime): { start: DateTime; end: DateTime } {
  if (view === "day") return { start: anchor.startOf("day"), end: anchor.endOf("day") };
  if (view === "month") return { start: anchor.startOf("month"), end: anchor.endOf("month") };
  return { start: anchor.startOf("week"), end: anchor.endOf("week") };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const params = await searchParams;
  const store = await getCurrentStore();
  const view: ViewMode = params.view === "day" || params.view === "month" ? params.view : "week";
  const anchor = params.date
    ? DateTime.fromISO(params.date, { zone: store.timezone })
    : DateTime.now().setZone(store.timezone);
  const { start, end } = rangeFor(view, anchor);

  const [rules, overrides, configs] = await Promise.all([
    prisma.recurringRule.findMany({ where: { storeId: store.id, active: true } }),
    prisma.scheduleOverride.findMany({
      where: { storeId: store.id, endAt: { gt: start.toUTC().toJSDate() }, startAt: { lt: end.toUTC().toJSDate() } },
      include: { config: true },
    }),
    prisma.paymentConfiguration.findMany({ where: { storeId: store.id } }),
  ]);
  const configById = new Map(configs.map((c) => [c.id, c]));

  const recurringRecords: RecurringRuleRecord[] = rules.map((r) => ({
    id: r.id,
    configId: r.configId,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    active: r.active,
  }));

  const windows = expandRecurringRules(recurringRecords, start.toUTC().toJSDate(), end.toUTC().toJSDate(), store.timezone);

  type Entry = { start: Date; end: Date; label: string; kind: "recurring" | "override" };
  const entries: Entry[] = [
    ...windows.map((w) => ({
      start: w.startUtc,
      end: w.endUtc,
      label: configById.get(w.rule.configId)?.internalName ?? "Unknown",
      kind: "recurring" as const,
    })),
    ...overrides.map((o) => ({ start: o.startAt, end: o.endAt, label: o.config.internalName, kind: "override" as const })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  // Flag overlaps for visual conflict warnings (should be rare given save-time checks).
  const conflicts = new Set<number>();
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[i].start < entries[j].end && entries[j].start < entries[i].end) {
        conflicts.add(i);
        conflicts.add(j);
      }
    }
  }

  const byDay = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = DateTime.fromJSDate(entry.start).setZone(store.timezone).toFormat("yyyy-LL-dd");
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(entry);
  }

  const prevAnchor = start.minus(view === "day" ? { days: 1 } : view === "month" ? { months: 1 } : { weeks: 1 });
  const nextAnchor = start.plus(view === "day" ? { days: 1 } : view === "month" ? { months: 1 } : { weeks: 1 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Calendar</h1>
        <div className="flex gap-2 text-sm">
          {(["day", "week", "month"] as ViewMode[]).map((v) => (
            <Link
              key={v}
              href={`/dashboard/calendar?view=${v}&date=${anchor.toFormat("yyyy-LL-dd")}`}
              className={`rounded-md px-2 py-1 ${v === view ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <Link href={`/dashboard/calendar?view=${view}&date=${prevAnchor.toFormat("yyyy-LL-dd")}`} className="text-slate-500 hover:underline">
          ← Previous
        </Link>
        <span className="font-medium text-slate-900">
          {start.toFormat("d LLL yyyy")} – {end.toFormat("d LLL yyyy")}
        </span>
        <Link href={`/dashboard/calendar?view=${view}&date=${nextAnchor.toFormat("yyyy-LL-dd")}`} className="text-slate-500 hover:underline">
          Next →
        </Link>
      </div>

      {conflicts.size > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-900">
          SCHEDULE CONFLICT detected in this range — an override and recurring window overlap. Priority
          rules resolve routing (override wins), but review this for correctness.
        </div>
      )}

      <div className="space-y-4">
        {[...byDay.entries()].map(([day, dayEntries]) => (
          <div key={day} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">
              {DateTime.fromFormat(day, "yyyy-LL-dd").toFormat("EEEE d LLLL")}
            </p>
            <ul className="mt-2 space-y-1">
              {dayEntries.map((e, i) => {
                const globalIndex = entries.indexOf(e);
                return (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        e.kind === "override" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {e.kind === "override" ? "Override" : "Recurring"}
                    </span>
                    <span>
                      {DateTime.fromJSDate(e.start).setZone(store.timezone).toFormat("HH:mm")}–
                      {DateTime.fromJSDate(e.end).setZone(store.timezone).toFormat("HH:mm")} {e.label}
                    </span>
                    {conflicts.has(globalIndex) && (
                      <span className="text-xs font-medium text-red-600">CONFLICT</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {byDay.size === 0 && <p className="text-sm text-slate-400">Nothing scheduled in this range.</p>}
      </div>
    </div>
  );
}
