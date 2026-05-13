import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { canApproveProduction } from "../lib/permissions";
import type { Role } from "../lib/permissions";
import {
  calculateProductionRequirements,
  reserveStockForPlan,
  releaseReservedStock,
  consumeStockForPlan,
  analyzeProductionRequirements,
  recalculateReservedStock,
  recalculateInventoryAlertStatus,
} from "../lib/jit";

const router = Router();

const PlanSchema = z.object({
  productionDate: z.string().transform((s) => new Date(s)),
  style: z.string().min(1),
  plannedBatches: z.number().int().positive().default(1),
  maltKgPerBatch: z.number().min(0).default(0),
  hopKgPerBatch: z.number().min(0).default(0),
  yeastGPerBatch: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
});

async function computePlanCost(style: string, batches: number) {
  const recipeLines = await prisma.recipeLine.findMany({
    where: { beerStyle: style },
    include: { material: true },
  });
  let estimatedCost = 0;
  let hasMissingPrices = false;
  for (const line of recipeLines) {
    if (!line.material.unitPrice || line.material.unitPrice === 0) {
      hasMissingPrices = true;
    } else {
      estimatedCost += line.qtyPerBatch * batches * line.material.unitPrice;
    }
  }
  return { estimatedCost, hasMissingPrices };
}

// ─── Auto-consume helper ─────────────────────────────────────────────────────

async function autoCompletePastPlans(): Promise<void> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const overdue = await prisma.productionPlan.findMany({
    where: {
      approvalStatus: "APPROVED",
      productionStatus: "PENDING",
      productionDate: { lt: startOfToday },
    },
    select: { id: true },
  });

  for (const { id } of overdue) {
    await consumeStockForPlan(id);
    await prisma.productionPlan.update({
      where: { id },
      data: { productionStatus: "COMPLETED" },
    });
  }
}

// GET /api/production
router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await autoCompletePastPlans();
    const { from, to, style, productionStatus } = req.query;
    const plans = await prisma.productionPlan.findMany({
      where: {
        ...(style ? { style: String(style) } : {}),
        ...(productionStatus ? { productionStatus: productionStatus as any } : {}),
        productionDate: {
          ...(from ? { gte: new Date(String(from)) } : {}),
          ...(to ? { lte: new Date(String(to)) } : {}),
        },
      },
      include: {
        requirements: {
          include: { material: true },
        },
      },
      orderBy: { productionDate: "asc" },
    });
    res.json(plans);
  } catch (e) {
    next(e);
  }
});

// GET /api/production/pending — plans awaiting approval
router.get(
  "/pending",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await prisma.productionPlan.findMany({
        where: { approvalStatus: "PENDING" },
        orderBy: { createdAt: "asc" },
      });
      res.json(plans);
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/production/upcoming
router.get("/upcoming", requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const in7 = new Date(startOfToday.getTime() + 7 * 86_400_000);
    const plans = await prisma.productionPlan.findMany({
      where: {
        productionDate: { gte: startOfToday, lte: in7 },
        productionStatus: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      include: {
        requirements: {
          include: { material: true },
        },
      },
      orderBy: { productionDate: "asc" },
    });
    res.json(plans);
  } catch (e) {
    next(e);
  }
});

// GET /api/production/:id
router.get("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.productionPlan.findUnique({
      where: { id: req.params.id },
      include: {
        requirements: {
          include: { material: true, linkedOrder: true },
        },
      },
    });
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json(plan);
  } catch (e) {
    next(e);
  }
});

// POST /api/production
router.post("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = PlanSchema.parse(req.body);
    const actorId = (req as AuthRequest).userId;

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { role: true },
    });
    const actorRole = (actor?.role ?? "OPERATOR") as Role;

    const approvalStatus = canApproveProduction(actorRole) ? "APPROVED" : "PENDING";
    const { estimatedCost, hasMissingPrices } = await computePlanCost(data.style, data.plannedBatches);

    const plan = await prisma.productionPlan.create({
      data: {
        ...data,
        totalMaltKg: data.maltKgPerBatch * data.plannedBatches,
        totalHopKg: data.hopKgPerBatch * data.plannedBatches,
        totalYeastG: data.yeastGPerBatch * data.plannedBatches,
        approvalStatus: approvalStatus as any,
        estimatedCost,
        hasMissingPrices,
        createdById: actorId,
        ...(approvalStatus === "APPROVED"
          ? { approvedById: actorId, approvedAt: new Date() }
          : {}),
      },
    });

    // If auto-approved, compute JIT requirements and reserve stock immediately
    if (approvalStatus === "APPROVED") {
      await calculateProductionRequirements(plan.id);
      await reserveStockForPlan(plan.id);
    }

    res.status(201).json(plan);
  } catch (e) {
    next(e);
  }
});

// POST /api/production/:id/approve
router.post(
  "/:id/approve",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = (req as AuthRequest).userId;
      const plan = await prisma.productionPlan.findUnique({ where: { id: req.params.id } });
      if (!plan) return res.status(404).json({ error: "Plan not found" });
      if (plan.approvalStatus !== "PENDING") {
        return res.status(409).json({ error: "Solo se pueden aprobar planes pendientes" });
      }

      const { estimatedCost, hasMissingPrices } = await computePlanCost(plan.style, plan.plannedBatches);

      const updated = await prisma.productionPlan.update({
        where: { id: req.params.id },
        data: {
          approvalStatus: "APPROVED",
          approvedById: actorId,
          approvedAt: new Date(),
          estimatedCost,
          hasMissingPrices,
        },
      });

      // Compute JIT requirements and reserve stock
      await calculateProductionRequirements(plan.id);
      await reserveStockForPlan(plan.id);

      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/production/:id/reject
router.post(
  "/:id/reject",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = (req as AuthRequest).userId;
      const { reason } = req.body;
      const plan = await prisma.productionPlan.findUnique({ where: { id: req.params.id } });
      if (!plan) return res.status(404).json({ error: "Plan not found" });
      if (plan.approvalStatus !== "PENDING") {
        return res.status(409).json({ error: "Solo se pueden rechazar planes pendientes" });
      }

      const updated = await prisma.productionPlan.update({
        where: { id: req.params.id },
        data: {
          approvalStatus: "REJECTED",
          rejectedById: actorId,
          rejectedAt: new Date(),
          rejectionReason: reason ?? null,
        },
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

// PATCH /api/production/:id/status — update execution status (COMPLETED / CANCELLED)
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productionStatus } = z
        .object({ productionStatus: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]) })
        .parse(req.body);

      const plan = await prisma.productionPlan.findUnique({ where: { id: req.params.id } });
      if (!plan) return res.status(404).json({ error: "Plan not found" });

      const updated = await prisma.productionPlan.update({
        where: { id: req.params.id },
        data: { productionStatus: productionStatus as any },
      });

      if (productionStatus === "COMPLETED") {
        await consumeStockForPlan(plan.id);
      } else if (productionStatus === "CANCELLED") {
        await releaseReservedStock(plan.id);
      }

      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

// PUT /api/production/:id
router.put("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = PlanSchema.partial().parse(req.body);
    const existing = await prisma.productionPlan.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Plan not found" });

    const batches = data.plannedBatches ?? existing.plannedBatches;
    const maltPer = data.maltKgPerBatch ?? existing.maltKgPerBatch;
    const hopPer = data.hopKgPerBatch ?? existing.hopKgPerBatch;
    const yeastPer = data.yeastGPerBatch ?? existing.yeastGPerBatch;
    const style = data.style ?? existing.style;
    const { estimatedCost, hasMissingPrices } = await computePlanCost(style, batches);

    const plan = await prisma.productionPlan.update({
      where: { id: req.params.id },
      data: {
        ...data,
        totalMaltKg: maltPer * batches,
        totalHopKg: hopPer * batches,
        totalYeastG: yeastPer * batches,
        estimatedCost,
        hasMissingPrices,
      },
    });

    // Recalculate JIT requirements if the plan is approved
    if (existing.approvalStatus === "APPROVED") {
      await calculateProductionRequirements(plan.id);
      await reserveStockForPlan(plan.id);
    }

    res.json(plan);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/production/:id
router.delete("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.productionPlan.findUnique({ where: { id: req.params.id } });
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    // Collect affected inventory IDs before deletion so we can recalculate after
    const requirements = await prisma.productionRequirement.findMany({
      where: { productionPlanId: req.params.id },
      select: { inventoryId: true },
    });
    const inventoryIds = [...new Set(requirements.map((r) => r.inventoryId))];

    // Null out orders to avoid FK violation
    await prisma.order.updateMany({
      where: { productionPlanId: req.params.id },
      data: { productionPlanId: null },
    });

    // Delete plan — ProductionRequirement rows cascade-delete here
    await prisma.productionPlan.delete({ where: { id: req.params.id } });

    // Recalculate AFTER deletion: requirements are gone, so isCritical/reservedStock
    // will correctly reflect the absence of this plan
    for (const inventoryId of inventoryIds) {
      await recalculateReservedStock(inventoryId);
      await recalculateInventoryAlertStatus(inventoryId);
    }

    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

// GET /api/production/:id/jit-analysis — read-only JIT analysis (no DB writes)
router.get(
  "/:id/jit-analysis",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await prisma.productionPlan.findUnique({ where: { id: req.params.id } });
      if (!plan) return res.status(404).json({ error: "Plan not found" });

      const analysis = await analyzeProductionRequirements(req.params.id);
      res.json({ plan, analysis });
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/production/:id/recalculate-jit — refresh requirements + reservations
router.post(
  "/:id/recalculate-jit",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await prisma.productionPlan.findUnique({ where: { id: req.params.id } });
      if (!plan) return res.status(404).json({ error: "Plan not found" });
      if (plan.approvalStatus !== "APPROVED") {
        return res.status(422).json({ error: "Solo se puede recalcular planes aprobados" });
      }

      await calculateProductionRequirements(plan.id);
      await reserveStockForPlan(plan.id);

      const updated = await prisma.productionPlan.findUnique({
        where: { id: plan.id },
        include: { requirements: { include: { material: true } } },
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/production/:id/generate-orders
router.post(
  "/:id/generate-orders",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const confirm = req.query.confirm === "true";
      const plan = await prisma.productionPlan.findUnique({ where: { id: req.params.id } });
      if (!plan) return res.status(404).json({ error: "Plan not found" });

      if (plan.approvalStatus !== "APPROVED") {
        return res
          .status(422)
          .json({ error: "Solo se pueden generar pedidos para planes aprobados" });
      }

      const recipeLines = await prisma.recipeLine.findMany({
        where: { beerStyle: plan.style },
        include: { material: { include: { supplier: true, inventory: true } } },
      });

      if (recipeLines.length === 0) {
        return res.status(422).json({
          error: `No hay receta definida para "${plan.style}". Agrégala en Recetas.`,
        });
      }

      // Refresh JIT requirements so preview uses up-to-date numbers
      await calculateProductionRequirements(plan.id);

      const requirements = await prisma.productionRequirement.findMany({
        where: { productionPlanId: plan.id },
        include: {
          material: { include: { supplier: true } },
          inventory: true,
        },
      });

      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const preview = requirements.map((req) => ({
        materialId: req.materialId,
        materialName: req.material.name,
        unit: req.material.unit,
        requiredQuantity: req.requiredQuantity,
        currentStock: req.inventory.currentStock,
        reservedByOthers:
          (req.inventory.reservedStock ?? 0) - req.reservedQuantity,
        incomingQuantity: 0, // populated client-side from analysis if needed
        missingQuantity: req.missingQuantity,
        isCritical: req.isCritical,
        actionStatus: req.actionStatus,
        supplierId: req.material.supplierId,
        supplierName: req.material.supplier?.name ?? null,
        estimatedCost: req.missingQuantity * (req.material.unitPrice ?? 0),
        willOrder: req.missingQuantity > 0,
      }));

      const totalEstimatedCost = preview.reduce((a, p) => a + p.estimatedCost, 0);

      if (!confirm) {
        return res.json({ plan, preview, totalEstimatedCost });
      }

      // Create orders for materials with missing quantity
      await prisma.productionPlan.update({
        where: { id: plan.id },
        data: { orderedAt: now },
      });

      const created = [];
      for (const p of preview.filter((p) => p.willOrder)) {
        const supplier = p.supplierId
          ? await prisma.supplier.findUnique({ where: { id: p.supplierId } })
          : null;
        const daysToOrder = supplier?.daysToOrder ?? 7;
        const arrival = new Date(now);
        arrival.setDate(arrival.getDate() + daysToOrder);

        const order = await prisma.order.create({
          data: {
            folio: `PED-${Date.now()}-${p.materialId.slice(-4).toUpperCase()}`,
            orderDate: now,
            materialId: p.materialId,
            supplierId: p.supplierId,
            productionPlanId: plan.id,
            orderedQuantity: p.missingQuantity,
            estimatedArrivalDate: arrival,
            status: "PENDING",
            month,
            notes: `Auto-generado para ${plan.style} · ${plan.plannedBatches} lote(s) · ${now.toLocaleDateString("es-MX")}`,
          },
        });

        // Link order to the requirement
        await prisma.productionRequirement.updateMany({
          where: { productionPlanId: plan.id, materialId: p.materialId },
          data: { linkedOrderId: order.id },
        });

        created.push(order);
      }

      // Refresh requirements after orders are created
      await calculateProductionRequirements(plan.id);

      res.status(201).json({ created, skipped: preview.filter((p) => !p.willOrder).length });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
