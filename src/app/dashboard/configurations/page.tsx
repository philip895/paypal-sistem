import { DateTime } from "luxon";
import { getCurrentStore } from "@/lib/store";
import { prisma } from "@/lib/db";
import {
  createConfigurationAction,
  recordHealthCheckAction,
  updateConfigurationStatusAction,
} from "./actions";

function fmt(date: Date | null, tz: string) {
  return date ? DateTime.fromJSDate(date).setZone(tz).toFormat("d LLL, HH:mm") : "Never";
}

function maskMerchantId(id: string) {
  return id.length <= 4 ? "••••" : `••••${id.slice(-4)}`;
}

export default async function ConfigurationsPage() {
  const store = await getCurrentStore();
  const configs = await prisma.paymentConfiguration.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Payment Configurations</h1>
      <p className="text-sm text-slate-500">
        Credentials are never shown here — only masked identifiers and status. Real values live in the
        secrets manager, referenced by <code className="text-xs">credentialRef</code>.
      </p>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Merchant ID</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Connection</th>
              <th className="px-4 py-2">Eligibility</th>
              <th className="px-4 py-2">Last activated</th>
              <th className="px-4 py-2">Last health check</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {configs.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 font-medium text-slate-900">{c.internalName}</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{maskMerchantId(c.paypalMerchantId)}</td>
                <td className="px-4 py-2">
                  <form action={updateConfigurationStatusAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="connectionStatus" value={c.connectionStatus} />
                    <input type="hidden" name="eligibilityStatus" value={c.eligibilityStatus} />
                    <select
                      name="status"
                      defaultValue={c.status}
                      className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                    <button className="rounded border border-slate-300 px-1.5 py-0.5 text-xs hover:bg-slate-50">
                      Save
                    </button>
                  </form>
                </td>
                <td className="px-4 py-2 text-xs">{c.connectionStatus}</td>
                <td className="px-4 py-2 text-xs">{c.eligibilityStatus}</td>
                <td className="px-4 py-2 text-xs">{fmt(c.lastActivatedAt, store.timezone)}</td>
                <td className="px-4 py-2 text-xs">
                  {c.lastHealthCheckResult
                    ? `${c.lastHealthCheckResult} · ${fmt(c.lastHealthCheckAt, store.timezone)}`
                    : "Never"}
                </td>
                <td className="px-4 py-2">
                  <form action={recordHealthCheckAction} className="flex gap-1">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="result" value="PASSED" />
                    <button className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">
                      Record health check
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-900">Add configuration</p>
        <form action={createConfigurationAction} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            name="internalName"
            placeholder="Internal name"
            required
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <input
            name="paypalMerchantId"
            placeholder="PayPal merchant ID"
            required
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <input
            name="credentialRef"
            placeholder="secrets-manager://..."
            required
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
