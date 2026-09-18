import { DateTime } from "luxon";
import { getCurrentStore } from "@/lib/store";
import { prisma } from "@/lib/db";

const RESULT_LABELS: Record<string, string> = {
  SUCCESS: "Riuscito",
  FAILED: "Non riuscito",
  ROLLED_BACK: "Annullato (rollback)",
};

export default async function ActivityPage() {
  const store = await getCurrentStore();
  const [audits, activations] = await Promise.all([
    prisma.auditLog.findMany({
      where: { storeId: store.id },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.activationHistory.findMany({
      where: { storeId: store.id },
      include: { config: true, triggeredBy: true },
      orderBy: { activatedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Attività</h1>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-900">Cronologia attivazioni</p>
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {activations.map((a) => (
            <li key={a.id} className="py-2">
              <span className="text-slate-500">
                {DateTime.fromJSDate(a.activatedAt).setZone(store.timezone).toFormat("yyyy-LL-dd HH:mm:ss")}
              </span>{" "}
              — <span className="font-medium">{a.config.internalName}</span> attivata. Motivo:{" "}
              {a.reason} {a.triggeredBy && `· di ${a.triggeredBy.email}`} · Esito:{" "}
              <span className={a.result === "SUCCESS" ? "text-emerald-700" : "text-red-700"}>{RESULT_LABELS[a.result] ?? a.result}</span>
            </li>
          ))}
          {activations.length === 0 && <p className="text-slate-400">Nessuna attivazione registrata finora.</p>}
        </ul>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-900">Registro di controllo</p>
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {audits.map((a) => (
            <li key={a.id} className="py-2">
              <span className="text-slate-500">
                {DateTime.fromJSDate(a.createdAt).setZone(store.timezone).toFormat("yyyy-LL-dd HH:mm:ss")}
              </span>{" "}
              — <span className="font-medium">{a.action}</span> su {a.targetType}
              {a.actor && ` · di ${a.actor.email}`}
            </li>
          ))}
          {audits.length === 0 && <p className="text-slate-400">Nessuna voce nel registro finora.</p>}
        </ul>
      </div>
    </div>
  );
}
