import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/dashboard/summary — main KPIs
router.get("/summary", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [alertCounts, criticalCount, totalMaterials, upcomingPlans, monthlySpend, inTransit] =
      await Promise.all([
        prisma.inventory.groupBy({
          by: ["alertStatus"],
          _count: { alertStatus: true },
        }),
        prisma.inventory.count({ where: { isCritical: true } }),
        prisma.material.count(),
        prisma.productionPlan.findMany({
          where: {
            productionDate: { gte: now, lte: in7 },
            productionStatus: { notIn: ["COMPLETED", "CANCELLED"] },
          },
          include: {
            requirements: {
              where: { isCritical: true },
              select: { id: true },
            },
          },
          orderBy: { productionDate: "asc" },
        }),
        prisma.order.aggregate({
          where: {
            orderDate: { gte: startOfMonth, lte: endOfMonth },
            totalPaid: { not: null },
          },
          _sum: { totalPaid: true },
          _count: { id: true },
        }),
        prisma.order.count({ where: { status: "IN_TRANSIT" } }),
      ]);

    const alertMap = Object.fromEntries(
      alertCounts.map((a) => [a.alertStatus, a._count.alertStatus])
    );

    const upcomingBatches = upcomingPlans.reduce((acc, p) => acc + p.plannedBatches, 0);
    const upcomingMaltKg = upcomingPlans.reduce((acc, p) => acc + p.totalMaltKg, 0);
    const upcomingHopKg = upcomingPlans.reduce((acc, p) => acc + p.totalHopKg, 0);

    res.json({
      alerts: {
        red: alertMap["RED"] ?? 0,
        yellow: alertMap["YELLOW"] ?? 0,
        green: alertMap["GREEN"] ?? 0,
        none: alertMap["NONE"] ?? 0,
        critical: criticalCount,
      },
      totalMaterials,
      upcoming: {
        plans: upcomingPlans.map((p) => ({
          ...p,
          hasCriticalRequirements: p.requirements.length > 0,
        })),
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

// GET /api/dashboard/jit-summary — JIT status across all active approved plans
router.get("/jit-summary", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();

    const [requirementCounts, criticalItems, urgentPlans] = await Promise.all([
      // Breakdown of requirement action statuses across all active plans
      prisma.productionRequirement.groupBy({
        by: ["actionStatus"],
        where: {
          productionPlan: {
            approvalStatus: "APPROVED",
            productionStatus: { notIn: ["COMPLETED", "CANCELLED"] },
          },
        },
        _count: { actionStatus: true },
      }),

      // Inventory items that are critical
      prisma.inventory.findMany({
        where: { isCritical: true },
        include: {
          material: { select: { id: true, name: true, unit: true } },
          requirements: {
            where: {
              isCritical: true,
              productionPlan: {
                approvalStatus: "APPROVED",
                productionStatus: { notIn: ["COMPLETED", "CANCELLED"] },
              },
            },
            include: {
              productionPlan: {
                select: { id: true, style: true, productionDate: true },
              },
            },
            orderBy: { productionPlan: { productionDate: "asc" } },
          },
        },
        orderBy: { material: { name: "asc" } },
      }),

      // Plans in the next 14 days with ORDER_NOW requirements
      prisma.productionPlan.findMany({
        where: {
          approvalStatus: "APPROVED",
          productionStatus: { notIn: ["COMPLETED", "CANCELLED"] },
          productionDate: { gte: now, lte: new Date(now.getTime() + 14 * 86_400_000) },
          requirements: { some: { actionStatus: "ORDER_NOW" } },
        },
        include: {
          requirements: {
            where: { actionStatus: "ORDER_NOW" },
            include: { material: { select: { name: true, unit: true } } },
          },
        },
        orderBy: { productionDate: "asc" },
      }),
    ]);

    const statusMap = Object.fromEntries(
      requirementCounts.map((r) => [r.actionStatus, r._count.actionStatus])
    );

    res.json({
      requirements: {
        orderNow: statusMap["ORDER_NOW"] ?? 0,
        orderSoon: statusMap["ORDER_SOON"] ?? 0,
        covered: statusMap["COVERED"] ?? 0,
        ok: statusMap["OK"] ?? 0,
      },
      criticalItems,
      urgentPlans,
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/dashboard/spend — monthly spend history
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
