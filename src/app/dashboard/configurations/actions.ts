"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentStore } from "@/lib/store";
import { requireRole } from "@/lib/require-session";
import { writeAuditLog } from "@/lib/audit";

export async function createConfigurationAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const store = await getCurrentStore();

  const internalName = String(formData.get("internalName") || "").trim();
  const paypalMerchantId = String(formData.get("paypalMerchantId") || "").trim();
  const credentialRef = String(formData.get("credentialRef") || "").trim();

  if (!internalName || !paypalMerchantId || !credentialRef) {
    throw new Error("Nome interno, ID commerciante e riferimento credenziale sono obbligatori.");
  }

  const config = await prisma.paymentConfiguration.create({
    data: {
      storeId: store.id,
      internalName,
      paypalMerchantId,
      credentialRef,
      status: "ACTIVE",
      connectionStatus: "DISCONNECTED",
      eligibilityStatus: "INELIGIBLE",
    },
  });

  await writeAuditLog({
    storeId: store.id,
    actorId: session.userId,
    action: "CREATE_CONFIGURATION",
    targetType: "PaymentConfiguration",
    targetId: config.id,
    after: { internalName, paypalMerchantId },
  });

  revalidatePath("/dashboard/configurations");
}

export async function updateConfigurationStatusAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const store = await getCurrentStore();

  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  const eligibilityStatus = String(formData.get("eligibilityStatus") || "");
  const connectionStatus = String(formData.get("connectionStatus") || "");

  const before = await prisma.paymentConfiguration.findUniqueOrThrow({ where: { id } });
  const config = await prisma.paymentConfiguration.update({
    where: { id },
    data: { status, eligibilityStatus, connectionStatus },
  });

  await writeAuditLog({
    storeId: store.id,
    actorId: session.userId,
    action: "UPDATE_CONFIGURATION_STATUS",
    targetType: "PaymentConfiguration",
    targetId: id,
    before: { status: before.status, eligibilityStatus: before.eligibilityStatus, connectionStatus: before.connectionStatus },
    after: { status: config.status, eligibilityStatus: config.eligibilityStatus, connectionStatus: config.connectionStatus },
  });

  revalidatePath("/dashboard/configurations");
}

/**
 * Stand-in for the "pre-switch health check" from the architecture doc.
 * Until this account has a live Payments App connection, there's no real
 * PayPal API call to make here — this records a manual attestation instead
 * so the Configurations screen still shows a meaningful "last health check".
 */
export async function recordHealthCheckAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const store = await getCurrentStore();
  const id = String(formData.get("id") || "");
  const result = String(formData.get("result") || "PASSED");

  await prisma.paymentConfiguration.update({
    where: { id },
    data: { lastHealthCheckAt: new Date(), lastHealthCheckResult: result },
  });

  await writeAuditLog({
    storeId: store.id,
    actorId: session.userId,
    action: "RECORD_HEALTH_CHECK",
    targetType: "PaymentConfiguration",
    targetId: id,
    after: { result },
  });

  revalidatePath("/dashboard/configurations");
}
