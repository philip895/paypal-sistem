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
  return DateTime.fromJSDate(date).setZone(timezone).setLocale("it").toFormat("EEE d LLL, HH:mm");
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
            {store.automationPaused ? "Riprendi automazione" : "Sospendi automazione"}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
        Modalità: <span className="font-medium text-slate-700">{store.automationMode}</span> &middot; Fuso orario:{" "}
        <span className="font-medium text-slate-700">{store.timezone}</span>
        {store.automationPaused && (
          <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
            AUTOMAZIONE SOSPESA
          </span>
        )}
      </div>

      {status.resolved.source === "MANUAL_OVERRIDE" && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900">
          <strong>Eccezione manuale attiva</strong> — l&rsquo;instradamento è fissato su{" "}
          {currentConfig?.internalName ?? "una configurazione sconosciuta"}
          {status.resolved.activeUntil
            ? ` fino alle ${fmt(status.resolved.activeUntil, store.timezone)}`
            : " fino alla disattivazione manuale"}
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
            {status.overdue ? "In ritardo: " : "Azione richiesta: "}
            passa {confirmedConfig ? `da ${confirmedConfig.internalName} ` : ""}a{" "}
            {currentConfig?.internalName ?? "la configurazione risolta"} nell&rsquo;Admin di Shopify
            (Impostazioni → Pagamenti → riconnetti PayPal), poi conferma qui sotto.
          </p>
          <p className="mt-1 text-xs opacity-80">
            Motivo: {status.resolved.reason}
            {status.resolved.activeSince
              ? ` · programmato dalle ${fmt(status.resolved.activeSince, store.timezone)}`
              : ""}
          </p>
          <form action={confirmSwitchAction} className="mt-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Conferma passaggio
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Configurazione di pagamento attuale
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {currentConfig?.internalName ?? "Nessuna risolta"}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Stato</dt>
            <dd className="font-medium text-slate-900">
              {status.pendingConfirmation ? "In attesa di conferma" : "Attiva e confermata"}
            </dd>
            <dt className="text-slate-500">Attiva dalle</dt>
            <dd className="text-slate-900">{fmt(status.resolved.activeSince, store.timezone)}</dd>
            <dt className="text-slate-500">Attiva fino alle</dt>
            <dd className="text-slate-900">
              {status.resolved.activeUntil ? fmt(status.resolved.activeUntil, store.timezone) : "Senza scadenza"}
            </dd>
            <dt className="text-slate-500">Motivo</dt>
            <dd className="text-slate-900">{status.resolved.reason}</dd>
          </dl>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Prossima configurazione</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {nextConfig?.internalName ?? "Nessun passaggio programmato"}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Prossimo passaggio</dt>
            <dd className="text-slate-900">{status.next ? fmt(status.next.at, store.timezone) : "—"}</dd>
            <dt className="text-slate-500">Tempo rimanente</dt>
            <dd className="text-slate-900">
              {status.next ? <Countdown targetIso={status.next.at.toISOString()} /> : "—"}
            </dd>
          </dl>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Azioni rapide</p>
        <form action={startEmergencyOverrideAction} className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500" htmlFor="configId">
              Attiva subito una configurazione
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
              Durata
            </label>
            <select
              id="duration"
              name="duration"
              className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="30m">30 minuti</option>
              <option value="1h">1 ora</option>
              <option value="2h">2 ore</option>
              <option value="until_next_schedule">Fino al prossimo passaggio programmato</option>
              <option value="until_disabled">Fino alla disattivazione manuale</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Avvia eccezione di emergenza
          </button>
        </form>
      </div>
    </div>
  );
}
