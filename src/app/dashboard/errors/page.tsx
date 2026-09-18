import { DateTime } from "luxon";
import { getCurrentStore } from "@/lib/store";
import { prisma } from "@/lib/db";

const RESULT_LABELS: Record<string, string> = {
  SUCCESS: "Riuscito",
  FAILED: "Non riuscito",
  ROLLED_BACK: "Annullato (rollback)",
};

export default async function ErrorsPage() {
  const store = await getCurrentStore();
  const errors = await prisma.errorLog.findMany({
    where: { storeId: store.id },
    include: { config: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Errori</h1>
      {errors.length === 0 ? (
        <p className="text-sm text-slate-400">Nessun errore registrato — è un buon segno.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Orario</th>
                <th className="px-4 py-2">Configurazione</th>
                <th className="px-4 py-2">Operazione</th>
                <th className="px-4 py-2">Errore</th>
                <th className="px-4 py-2">Tentativi</th>
                <th className="px-4 py-2">Esito</th>
                <th className="px-4 py-2">Rollback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {errors.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {DateTime.fromJSDate(e.createdAt).setZone(store.timezone).toFormat("yyyy-LL-dd HH:mm:ss")}
                  </td>
                  <td className="px-4 py-2">{e.config?.internalName ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{e.operation}</td>
                  <td className="px-4 py-2 text-xs">
                    {e.errorCode}: {e.errorMessage}
                  </td>
                  <td className="px-4 py-2 text-xs">{e.retryCount}</td>
                  <td className="px-4 py-2 text-xs font-medium text-red-700">{RESULT_LABELS[e.finalResult] ?? e.finalResult}</td>
                  <td className="px-4 py-2 text-xs">{e.rollbackResult ? (RESULT_LABELS[e.rollbackResult] ?? e.rollbackResult) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
