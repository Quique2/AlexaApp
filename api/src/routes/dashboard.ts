import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/dashboard/summary — main KPIs
// Optional query params: from (ISO date), to (ISO date), materialType (MALTA|LUPULO|YEAST|ADJUNTO|OTRO)
router.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const from = req.query.from ? new Date(String(req.query.from)) : startOfToday;
    const to = req.query.to
      ? new Date(new Date(String(req.query.to)).setUTCHours(23, 59, 59, 999))
      : new Date(startOfToday.getTime() + 7 * 86_400_000);
    const materialType = req.query.materialType ? String(req.query.materialType) : null;

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [alertCounts, reservedCount, totalMaterials, upcomingPlans, monthlySpend, inTransit] =
      await Promise.all([
        prisma.inventory.groupBy({
          by: ["alertStatus"],
          _count: { alertStatus: true },
        }),
        prisma.inventory.count({ where: { reservedStock: { gt: 0 } } }),
        prisma.material.count(),
        prisma.productionPlan.findMany({
          where: {
            productionDate: { gte: from, lte: to },
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

    const planIds = upcomingPlans.map((p) => p.id);
    const upcomingBatches = upcomingPlans.reduce((acc, p) => acc + p.plannedBatches, 0);
    const upcomingMaltKg = upcomingPlans.reduce((acc, p) => acc + p.totalMaltKg, 0);
    const upcomingHopKg = upcomingPlans.reduce((acc, p) => acc + p.totalHopKg, 0);

    // Material KPI: sum required quantity for the selected type across all plans in range
    let materialKg = 0;
    if (materialType && planIds.length > 0) {
      const reqs = await prisma.productionRequirement.aggregate({
        where: {
          productionPlanId: { in: planIds },
          material: { type: materialType as any },
        },
        _sum: { requiredQuantity: true },
      });
      materialKg = reqs._sum.requiredQuantity ?? 0;
    } else if (!materialType && planIds.length > 0) {
      materialKg = upcomingMaltKg;
    }

    res.json({
      alerts: {
        critical: alertMap["CRITICAL"] ?? 0,
        red: alertMap["RED"] ?? 0,
        yellow: alertMap["YELLOW"] ?? 0,
        green: alertMap["GREEN"] ?? 0,
        none: alertMap["NONE"] ?? 0,
        ok: reservedCount,
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
        materialKg,
        materialType: materialType ?? "MALTA",
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

// GET /api/dashboard/production-calendar?month=YYYY-MM
router.get("/production-calendar", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const monthParam = req.query.month ? String(req.query.month) : null;
    const year  = monthParam ? parseInt(monthParam.split("-")[0]) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam.split("-")[1]) - 1 : now.getMonth();

    const from = new Date(Date.UTC(year, month, 1));
    const to   = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

    const plans = await prisma.productionPlan.findMany({
      where: {
        productionDate: { gte: from, lte: to },
        productionStatus: { not: "CANCELLED" },
      },
      select: {
        id: true,
        style: true,
        plannedBatches: true,
        productionDate: true,
        approvalStatus: true,
        productionStatus: true,
        requirements: {
          select: { actionStatus: true, isCritical: true },
        },
      },
      orderBy: { productionDate: "asc" },
    });

    const STATUS_PRIORITY: Record<string, number> = { CRITICAL: 4, RED: 3, YELLOW: 2, GREEN: 1, NONE: 0 };

    function derivePlanStatus(reqs: { actionStatus: string; isCritical: boolean }[]) {
      if (!reqs.length) return { status: "NONE", hasCritical: false };
      const hasCritical = reqs.some((r) => r.isCritical && r.actionStatus === "ORDER_NOW");
      if (hasCritical)                               return { status: "CRITICAL", hasCritical: true };
      if (reqs.some((r) => r.actionStatus === "ORDER_NOW"))  return { status: "RED",      hasCritical: false };
      if (reqs.some((r) => r.actionStatus === "ORDER_SOON")) return { status: "YELLOW",   hasCritical: false };
      return { status: "GREEN", hasCritical: false };
    }

    // Group by day (YYYY-MM-DD)
    const dayMap = new Map<string, typeof plans>();
    for (const plan of plans) {
      const key = plan.productionDate.toISOString().split("T")[0];
      if (!dayMap.has(key)) dayMap.set(key, []);
      dayMap.get(key)!.push(plan);
    }

    const days = [];
    for (const [date, dayPlans] of dayMap) {
      const processed = dayPlans.map((p) => {
        const { status, hasCritical } = derivePlanStatus(p.requirements);
        return { id: p.id, style: p.style, batches: p.plannedBatches, jitStatus: status, hasCritical, approvalStatus: p.approvalStatus, productionStatus: p.productionStatus };
      });

      let highestStatus = "NONE";
      let dayHasCritical = false;
      for (const p of processed) {
        if ((STATUS_PRIORITY[p.jitStatus] ?? 0) > (STATUS_PRIORITY[highestStatus] ?? 0)) highestStatus = p.jitStatus;
        if (p.hasCritical) dayHasCritical = true;
      }

      days.push({ date, highestStatus, hasCritical: dayHasCritical, plansCount: processed.length, plans: processed });
    }

    days.sort((a, b) => a.date.localeCompare(b.date));
    res.json({ month: `${year}-${String(month + 1).padStart(2, "0")}`, days });
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
