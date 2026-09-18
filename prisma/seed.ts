import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const ownerEmail = process.env.SEED_OWNER_EMAIL || "pierlucafranzone@gmail.com";
  const ownerPassword = process.env.SEED_OWNER_PASSWORD || "changeme123";

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      email: ownerEmail,
      passwordHash: await bcrypt.hash(ownerPassword, 12),
      role: "OWNER",
    },
  });

  const store = await prisma.store.upsert({
    where: { shopifyDomain: "outfitdelcalcio.com" },
    update: {},
    create: {
      shopifyDomain: "outfitdelcalcio.com",
      timezone: "Europe/Rome",
      automationMode: "SIMULATION",
    },
  });

  const names = ["PayPal Account 1", "PayPal Account 2", "PayPal Account 3", "PayPal Account 4"];
  const configs = [];
  for (const [i, internalName] of names.entries()) {
    const config = await prisma.paymentConfiguration.upsert({
      where: { id: `seed-config-${i + 1}` },
      update: {},
      create: {
        id: `seed-config-${i + 1}`,
        storeId: store.id,
        internalName,
        paypalMerchantId: `MERCHANT_${i + 1}_PLACEHOLDER`,
        credentialRef: `secrets-manager://paypal/${store.id}/config-${i + 1}`,
        status: "ACTIVE",
        connectionStatus: "DISCONNECTED",
        eligibilityStatus: "ELIGIBLE",
      },
    });
    configs.push(config);
  }

  await prisma.store.update({
    where: { id: store.id },
    data: { safeDefaultConfigId: configs[0].id },
  });

  const weekdayRules = [
    { dayRange: [1, 2, 3, 4, 5], startTime: "00:00", endTime: "08:00", configIndex: 0 },
    { dayRange: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "16:00", configIndex: 1 },
    { dayRange: [1, 2, 3, 4, 5], startTime: "16:00", endTime: "00:00", configIndex: 2 },
  ];
  const weekendRules = [
    { dayRange: [0, 6], startTime: "00:00", endTime: "12:00", configIndex: 1 },
    { dayRange: [0, 6], startTime: "12:00", endTime: "00:00", configIndex: 3 },
  ];

  await prisma.recurringRule.deleteMany({ where: { storeId: store.id } });
  for (const rule of [...weekdayRules, ...weekendRules]) {
    for (const dayOfWeek of rule.dayRange) {
      await prisma.recurringRule.create({
        data: {
          storeId: store.id,
          dayOfWeek,
          startTime: rule.startTime,
          endTime: rule.endTime,
          configId: configs[rule.configIndex].id,
          active: true,
        },
      });
    }
  }

  console.log("Seeded:");
  console.log(`  Owner user: ${owner.email} (password: ${ownerPassword} — change this immediately)`);
  console.log(`  Store: ${store.shopifyDomain}`);
  console.log(`  Configurations: ${configs.map((c) => c.internalName).join(", ")}`);
  console.log("  Recurring schedule: Mon-Fri 00-08/08-16/16-00 across Accounts 1/2/3; Sat-Sun 00-12/12-00 across Accounts 2/4");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
