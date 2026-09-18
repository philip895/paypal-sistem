import { DateTime } from "luxon";
import { getCurrentStore } from "@/lib/store";
import { prisma } from "@/lib/db";
import { ScheduleOverrideForm } from "./override-form";
import { deleteScheduleOverrideAction } from "./actions";
import { endManualOverrideAction } from "../actions";

function fmt(date: Date, tz: string) {
  return DateTime.fromJSDate(date).setZone(tz).setLocale("it").toFormat("EEE d LLL, HH:mm");
}

const EXPIRY_MODE_LABELS: Record<string, string> = {
  FIXED_DURATION: "durata fissa",
  UNTIL_NEXT_SCHEDULE: "fino al prossimo passaggio",
  UNTIL_DISABLED: "fino alla disattivazione",
};

const ENDED_REASON_LABELS: Record<string, string> = {
  SUPERSEDED_BY_NEW_OVERRIDE: "sostituita da una nuova eccezione",
  MANUALLY_DISABLED: "disattivata manualmente",
};

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
      <h1 className="text-2xl font-semibold text-slate-900">Eccezioni</h1>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-900">Eccezione una tantum</p>
        <p className="mt-1 text-xs text-slate-500">
          Attiva temporaneamente una configurazione per una finestra fissa; torna automaticamente alla
          programmazione normale al termine. Gli orari sono in {store.timezone}.
        </p>
        <ScheduleOverrideForm configs={configs} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-900">Eccezioni una tantum imminenti / attive</p>
        {overrides.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Nessuna programmata.</p>
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
                  <button className="text-xs text-red-600 hover:underline">Rimuovi</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-900">Cronologia eccezioni manuali</p>
        <p className="mt-1 text-xs text-slate-500">
          Avvia una nuova eccezione di emergenza dal pannello Azioni rapide della Dashboard principale.
        </p>
        <ul className="mt-2 divide-y divide-slate-100">
          {manualOverrides.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {fmt(m.startedAt, store.timezone)} — {m.config.internalName} ({EXPIRY_MODE_LABELS[m.expiryMode] ?? m.expiryMode})
                {m.createdBy && <span className="ml-2 text-xs text-slate-400">di {m.createdBy.email}</span>}
                {!m.active && (
                  <span className="ml-2 text-xs text-slate-400">
                    terminata {m.endedAt ? fmt(m.endedAt, store.timezone) : ""}
                    {m.endedReason ? ` (${ENDED_REASON_LABELS[m.endedReason] ?? m.endedReason})` : ""}
                  </span>
                )}
              </span>
              {m.active && (
                <form action={endManualOverrideAction.bind(null, m.id)}>
                  <button className="text-xs text-red-600 hover:underline">Termina ora</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
