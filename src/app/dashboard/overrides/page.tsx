import { DateTime } from "luxon";
import { getCurrentStore } from "@/lib/store";
import { prisma } from "@/lib/db";
import { ScheduleOverrideForm } from "./override-form";
import { deleteScheduleOverrideAction } from "./actions";
import { endManualOverrideAction } from "../actions";

function fmt(date: Date, tz: string) {
  return DateTime.fromJSDate(date).setZone(tz).toFormat("EEE d LLL, HH:mm");
}

export default async function OverridesPage() {
  const store = await getCurrentStore();
  const [overrides, manualOverrides, configs] = await Promise.all([
    prisma.scheduleOverride.findMany({
      where: { storeId: store.id, endAt: { gt: new Date() } },
      include: { config: true },
      orderBy: { startAt: "asc" },
    }),
    prisma.manualOverride.findMany({
      where: { storeId: store.id },
      include: { config: true, createdBy: true },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    prisma.paymentConfiguration.findMany({ where: { storeId: store.id } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Overrides</h1>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-900">One-time schedule override</p>
        <p className="mt-1 text-xs text-slate-500">
          Temporarily activates a configuration for a fixed window; automatically returns to the normal
          schedule afterwards. Times are in {store.timezone}.
        </p>
        <ScheduleOverrideForm configs={configs} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-900">Upcoming / active one-time overrides</p>
        {overrides.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">None scheduled.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {overrides.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {fmt(o.startAt, store.timezone)} → {fmt(o.endAt, store.timezone)} — {o.config.internalName}
                  {o.reason && <span className="ml-2 text-xs text-slate-400">({o.reason})</span>}
                </span>
                <form action={deleteScheduleOverrideAction}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="text-xs text-red-600 hover:underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-900">Manual override history</p>
        <p className="mt-1 text-xs text-slate-500">
          Start a new emergency override from the main Dashboard&rsquo;s Quick Actions panel.
        </p>
        <ul className="mt-2 divide-y divide-slate-100">
          {manualOverrides.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {fmt(m.startedAt, store.timezone)} — {m.config.internalName} ({m.expiryMode})
                {m.createdBy && <span className="ml-2 text-xs text-slate-400">by {m.createdBy.email}</span>}
                {!m.active && (
                  <span className="ml-2 text-xs text-slate-400">
                    ended {m.endedAt ? fmt(m.endedAt, store.timezone) : ""} ({m.endedReason})
                  </span>
                )}
              </span>
              {m.active && (
                <form action={endManualOverrideAction.bind(null, m.id)}>
                  <button className="text-xs text-red-600 hover:underline">End now</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
