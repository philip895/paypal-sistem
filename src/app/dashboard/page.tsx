import { DateTime } from "luxon";
import { getCurrentStore } from "@/lib/store";
import { getDashboardStatus } from "@/lib/scheduling/service";
import { prisma } from "@/lib/db";
import { Countdown } from "@/components/countdown";
import {
  confirmSwitchAction,
  startEmergencyOverrideAction,
  toggleAutomationPausedAction,
} from "./actions";

function fmt(date: Date | null, timezone: string): string {
  if (!date) return "—";
  return DateTime.fromJSDate(date).setZone(timezone).toFormat("EEE d LLL, HH:mm");
}

export default async function DashboardPage() {
  const store = await getCurrentStore();
  const status = await getDashboardStatus(store.id, store.timezone);
  const configs = await prisma.paymentConfiguration.findMany({ where: { storeId: store.id } });
  const configById = new Map(configs.map((c) => [c.id, c]));

  const currentConfig = status.resolved.configId ? configById.get(status.resolved.configId) : null;
  const nextConfig = status.next ? configById.get(status.next.configId) : null;
  const confirmedConfig = status.confirmedConfigId ? configById.get(status.confirmedConfigId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <form
          action={async () => {
            "use server";
            await toggleAutomationPausedAction(!store.automationPaused);
          }}
        >
          <button
            type="submit"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              store.automationPaused
                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {store.automationPaused ? "Resume automation" : "Pause automation"}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
        Mode: <span className="font-medium text-slate-700">{store.automationMode}</span> &middot; Timezone:{" "}
        <span className="font-medium text-slate-700">{store.timezone}</span>
        {store.automationPaused && (
          <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
            AUTOMATION PAUSED
          </span>
        )}
      </div>

      {status.resolved.source === "MANUAL_OVERRIDE" && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900">
          <strong>Manual override active</strong> — routing is pinned to{" "}
          {currentConfig?.internalName ?? "an unknown configuration"}
          {status.resolved.activeUntil
            ? ` until ${fmt(status.resolved.activeUntil, store.timezone)}`
            : " until manually disabled"}
          .
        </div>
      )}

      {status.pendingConfirmation && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            status.overdue
              ? "border-red-300 bg-red-50 text-red-900"
              : "border-blue-200 bg-blue-50 text-blue-900"
          }`}
        >
          <p className="font-medium">
            {status.overdue ? "Overdue: " : "Action needed: "}
            switch {confirmedConfig ? `from ${confirmedConfig.internalName} ` : ""}to{" "}
            {currentConfig?.internalName ?? "the resolved configuration"} in Shopify Admin
            (Settings → Payments → reconnect PayPal), then confirm below.
          </p>
          <p className="mt-1 text-xs opacity-80">
            Reason: {status.resolved.reason}
            {status.resolved.activeSince
              ? ` · scheduled since ${fmt(status.resolved.activeSince, store.timezone)}`
              : ""}
          </p>
          <form action={confirmSwitchAction} className="mt-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Confirm switched
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Current payment configuration
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {currentConfig?.internalName ?? "None resolved"}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Status</dt>
            <dd className="font-medium text-slate-900">
              {status.pendingConfirmation ? "Pending confirmation" : "Confirmed active"}
            </dd>
            <dt className="text-slate-500">Active since</dt>
            <dd className="text-slate-900">{fmt(status.resolved.activeSince, store.timezone)}</dd>
            <dt className="text-slate-500">Active until</dt>
            <dd className="text-slate-900">
              {status.resolved.activeUntil ? fmt(status.resolved.activeUntil, store.timezone) : "Open-ended"}
            </dd>
            <dt className="text-slate-500">Why</dt>
            <dd className="text-slate-900">{status.resolved.reason}</dd>
          </dl>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Next configuration</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {nextConfig?.internalName ?? "No scheduled switch"}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Next switch</dt>
            <dd className="text-slate-900">{status.next ? fmt(status.next.at, store.timezone) : "—"}</dd>
            <dt className="text-slate-500">Time remaining</dt>
            <dd className="text-slate-900">
              {status.next ? <Countdown targetIso={status.next.at.toISOString()} /> : "—"}
            </dd>
          </dl>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Quick actions</p>
        <form action={startEmergencyOverrideAction} className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500" htmlFor="configId">
              Activate configuration now
            </label>
            <select
              id="configId"
              name="configId"
              required
              className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.internalName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500" htmlFor="duration">
              Duration
            </label>
            <select
              id="duration"
              name="duration"
              className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="30m">30 minutes</option>
              <option value="1h">1 hour</option>
              <option value="2h">2 hours</option>
              <option value="until_next_schedule">Until next scheduled switch</option>
              <option value="until_disabled">Until manually disabled</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Start emergency override
          </button>
        </form>
      </div>
    </div>
  );
}
