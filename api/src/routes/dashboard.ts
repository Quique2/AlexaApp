import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/dashboard/summary â€” main KPIs
router.get("/summary", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [alertCounts, totalMaterials, upcomingPlans, monthlySpend, inTransit] =
      await Promise.all([
        // Alert breakdown
        prisma.inventory.groupBy({
          by: ["alertStatus"],
          _count: { alertStatus: true },
        }),
        // Total materials
        prisma.material.count(),
        // Upcoming production (next 7 days)
        prisma.productionPlan.findMany({
          where: { productionDate: { gte: now, lte: in7 } },
          orderBy: { productionDate: "asc" },
        }),
        // Monthly spend
        prisma.order.aggregate({
          where: {
            orderDate: { gte: startOfMonth, lte: endOfMonth },
            totalPaid: { not: null },
          },
          _sum: { totalPaid: true },
          _count: { id: true },
        }),
        // Orders in transit
        prisma.order.count({ where: { status: "IN_TRANSIT" } }),
      ]);

    const alertMap = Object.fromEntries(
      alertCounts.map((a) => [a.alertStatus, a._count.alertStatus])
    );

    const upcomingBatches = upcomingPlans.reduce(
      (acc, p) => acc + p.plannedBatches,
      0
    );
    const upcomingMaltKg = upcomingPlans.reduce(
      (acc, p) => acc + p.totalMaltKg,
      0
    );
    const upcomingHopKg = upcomingPlans.reduce(
      (acc, p) => acc + p.totalHopKg,
      0
    );

    res.json({
      alerts: {
        red: alertMap["RED"] ?? 0,
        yellow: alertMap["YELLOW"] ?? 0,
        green: alertMap["GREEN"] ?? 0,
        none: alertMap["NONE"] ?? 0,
      },
      totalMaterials,
      upcoming: {
        plans: upcomingPlans,
        batches: upcomingBatches,
        maltKg: upcomingMaltKg,
        hopKg: upcomingHopKg,
      },
      monthlySpend: {
        total: monthlySpend._sum.totalPaid ?? 0,
        orderCount: monthlySpend._count.id,
      },
      inTransitOrders: inTransit,
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/dashboard/spend â€” monthly spend history (last 12 months)
router.get("/spend", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await prisma.order.groupBy({
      by: ["month"],
      _sum: { totalPaid: true },
      _count: { id: true },
      orderBy: { month: "asc" },
    });
    res.json(
      summary.map((s) => ({
        month: s.month,
        total: s._sum.totalPaid ?? 0,
        orders: s._count.id,
      }))
    );
  } catch (e) {
    next(e);
  }
});

export default router;

