import { prisma } from "./db";

export async function writeAuditLog(params: {
  storeId: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      storeId: params.storeId,
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      beforeState: params.before !== undefined ? JSON.stringify(params.before) : null,
      afterState: params.after !== undefined ? JSON.stringify(params.after) : null,
    },
  });
}

export async function writeNotification(params: {
  storeId: string;
  channel: "EMAIL" | "SLACK" | "WEBHOOK";
  eventType: string;
  payload: unknown;
}) {
  // Delivery is stubbed for now (see README): this records the notification
  // for the dashboard's Notifications screen. Wiring a real channel means
  // sending here and updating deliveryStatus/sentAt with the result.
  await prisma.notification.create({
    data: {
      storeId: params.storeId,
      channel: params.channel,
      eventType: params.eventType,
      payload: JSON.stringify(params.payload),
      deliveryStatus: "PENDING",
    },
  });
}
