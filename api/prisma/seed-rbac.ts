import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed all users as OPERATOR first
  const { count: userCount } = await prisma.user.updateMany({
    data: { role: "OPERATOR" },
  });
  console.log(`Set ${userCount} users to OPERATOR`);

  // Elevate the developer account (set DEVELOPER_EMAIL in the environment)
  const developerEmail = process.env.DEVELOPER_EMAIL;
  if (!developerEmail) {
    console.warn("DEVELOPER_EMAIL not set — no account was elevated to DEVELOPER");
  } else {
    const dev = await prisma.user.updateMany({
      where: { email: developerEmail },
      data: { role: "DEVELOPER" },
    });
    if (dev.count > 0) {
      console.log(`Set ${developerEmail} to DEVELOPER`);
    } else {
      console.warn(`Developer user ${developerEmail} not found — skipped`);
    }
  }

  // Mark all existing production plans as APPROVED (they were created before approval flow)
  const { count: planCount } = await prisma.productionPlan.updateMany({
    data: { approvalStatus: "APPROVED" },
  });
  console.log(`Set ${planCount} existing production plans to APPROVED`);

  console.log("RBAC seed completed successfully");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
