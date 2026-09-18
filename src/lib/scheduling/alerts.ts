import { prisma } from "@/lib/db";
import { dispatchAlert } from "@/lib/notify";
import { getDashboardStatus } from "./service";

/**
 * Called periodically by an external trigger (see the GitHub Actions
 * workflow) since there's no always-on background worker on the free
 * hosting tier. Notifies once when a switch becomes due, and once more
 * (urgently) if it's still unconfirmed once it goes overdue — then stays
 * quiet to avoid spamming until the switch is actually confirmed.
 */
export async function checkAndNotify(storeId: string, timezone: string) {
  const status = await getDashboardStatus(storeId, timezone);
  if (!status.pendingConfirmation) return { notified: false };

  const since = status.confirmedAt ?? new Date(0);
  const recent = await prisma.notification.findMany({
    where: {
      storeId,
      eventType: { in: ["SWITCH_PENDING", "SWITCH_OVERDUE"] },
      createdAt: { gt: since },
    },
  });
  const alreadyNotifiedPending = recent.some((n) => n.eventType === "SWITCH_PENDING");
  const alreadyNotifiedOverdue = recent.some((n) => n.eventType === "SWITCH_OVERDUE");

  const configs = await prisma.paymentConfiguration.findMany({ where: { storeId } });
  const configById = new Map(configs.map((c) => [c.id, c]));
  const targetName = status.resolved.configId
    ? configById.get(status.resolved.configId)?.internalName ?? "configurazione sconosciuta"
    : "configurazione sconosciuta";
  const fromName = status.confirmedConfigId
    ? configById.get(status.confirmedConfigId)?.internalName
    : null;

  if (!alreadyNotifiedPending) {
    await dispatchAlert({
      storeId,
      eventType: "SWITCH_PENDING",
      title: "Passaggio PayPal richiesto",
      message: `${fromName ? `Passa da ${fromName} a` : "Attiva"} ${targetName} in Shopify Admin (Impostazioni → Pagamenti → riconnetti PayPal), poi conferma nella console. Motivo: ${status.resolved.reason}.`,
      urgent: false,
    });
    return { notified: true, escalated: false };
  }

  if (status.overdue && !alreadyNotifiedOverdue) {
    await dispatchAlert({
      storeId,
      eventType: "SWITCH_OVERDUE",
      title: "IN RITARDO: passaggio PayPal non confermato",
      message: `Il passaggio a ${targetName} è ancora in attesa di conferma da oltre 15 minuti. Vai nella console e completa il passaggio in Shopify Admin.`,
      urgent: true,
    });
    return { notified: true, escalated: true };
  }

  return { notified: false };
}
