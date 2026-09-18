import { prisma } from "@/lib/db";
import { sendAlertEmail } from "./email";
import { sendAlertPush } from "./push";

/**
 * Sends an alert on every configured channel and records the outcome in
 * the Notification table (so the Notifications screen reflects real
 * delivery, not just "recorded"). A channel with no credentials configured
 * is skipped, not treated as a failure.
 */
export async function dispatchAlert(params: {
  storeId: string;
  eventType: string;
  title: string;
  message: string;
  urgent?: boolean;
}) {
  const { storeId, eventType, title, message, urgent = false } = params;

  const emailConfigured = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && process.env.ALERT_EMAIL_TO);
  if (emailConfigured) {
    const sent = await sendAlertEmail(title, message);
    await prisma.notification.create({
      data: {
        storeId,
        channel: "EMAIL",
        eventType,
        payload: JSON.stringify({ title, message }),
        sentAt: sent ? new Date() : null,
        deliveryStatus: sent ? "SENT" : "FAILED",
      },
    });
  }

  const pushConfigured = Boolean(process.env.NTFY_TOPIC);
  if (pushConfigured) {
    const sent = await sendAlertPush(title, message, urgent);
    await prisma.notification.create({
      data: {
        storeId,
        channel: "PUSH",
        eventType,
        payload: JSON.stringify({ title, message }),
        sentAt: sent ? new Date() : null,
        deliveryStatus: sent ? "SENT" : "FAILED",
      },
    });
  }

  if (!emailConfigured && !pushConfigured) {
    await prisma.notification.create({
      data: {
        storeId,
        channel: "WEBHOOK",
        eventType,
        payload: JSON.stringify({ title, message }),
        deliveryStatus: "PENDING",
      },
    });
  }
}
