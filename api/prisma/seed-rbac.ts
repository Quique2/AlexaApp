import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed all users as OPERATOR first
  const { count: userCount } = await prisma.user.updateMany({
    data: { role: "OPERATOR" },
  });
  console.log(`Set ${userCount} users to OPERATOR`);

  // Elevate the developer account
  const dev = await prisma.user.updateMany({
    where: { email: "kiki7o@outlook.es" },
    data: { role: "DEVELOPER" },
  });
  if (dev.count > 0) {
    console.log("Set kiki7o@outlook.es to DEVELOPER");
  } else {
    console.warn("Developer user kiki7o@outlook.es not found — skipped");
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
