import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { requireRole, RoleRequest } from "../middleware/requireRole";
import { canApproveProduction } from "../lib/permissions";
import type { Role } from "../lib/permissions";

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

// GET /api/production
router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to, style } = req.query;
    const plans = await prisma.productionPlan.findMany({
      where: {
        ...(style ? { style: String(style) } : {}),
        productionDate: {
          ...(from ? { gte: new Date(String(from)) } : {}),
          ...(to ? { lte: new Date(String(to)) } : {}),
        },
      },
      orderBy: { productionDate: "asc" },
    });
    res.json(plans);
  } catch (e) { next(e); }
});

// GET /api/production/pending — plans awaiting approval (SUPERVISOR/DEVELOPER only)
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
    } catch (e) { next(e); }
  }
);

// GET /api/production/upcoming
router.get("/upcoming", requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);
    const plans = await prisma.productionPlan.findMany({
      where: { productionDate: { gte: now, lte: in7 } },
      orderBy: { productionDate: "asc" },
    });
    res.json(plans);
  } catch (e) { next(e); }
});

// GET /api/production/:id
router.get("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.productionPlan.findUnique({ where: { id: req.params.id } });
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json(plan);
  } catch (e) { next(e); }
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
    res.status(201).json(plan);
  } catch (e) { next(e); }
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
      res.json(updated);
    } catch (e) { next(e); }
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
    } catch (e) { next(e); }
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
    res.json(plan);
  } catch (e) { next(e); }
});

// DELETE /api/production/:id
router.delete("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.productionPlan.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) { next(e); }
});

// POST /api/production/:id/generate-orders
router.post("/:id/generate-orders", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const confirm = req.query.confirm === "true";
    const plan = await prisma.productionPlan.findUnique({ where: { id: req.params.id } });
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    if (plan.approvalStatus !== "APPROVED") {
      return res.status(422).json({ error: "Solo se pueden generar pedidos para planes aprobados" });
    }

    const recipeLines = await prisma.recipeLine.findMany({
      where: { beerStyle: plan.style },
      include: { material: { include: { supplier: true, inventory: true } } },
    });

    if (recipeLines.length === 0) {
      return res.status(422).json({ error: `No hay receta definida para "${plan.style}". Agrégala en Recetas.` });
    }

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const preview = recipeLines.map((line) => {
      const needed = line.qtyPerBatch * plan.plannedBatches;
      const currentStock = line.material.inventory?.currentStock ?? 0;
      const shortfall = Math.max(0, needed - currentStock);
      return {
        materialId: line.materialId,
        materialName: line.material.name,
        unit: line.material.unit,
        needed,
        currentStock,
        shortfall,
        supplierId: line.material.supplierId,
        supplierName: line.material.supplier?.name ?? null,
        estimatedCost: shortfall * (line.material.unitPrice ?? 0),
        willOrder: shortfall > 0,
      };
    });

    if (!confirm) {
      return res.json({ plan, preview, totalEstimatedCost: preview.reduce((a, p) => a + p.estimatedCost, 0) });
    }

    await prisma.productionPlan.update({ where: { id: plan.id }, data: { orderedAt: now } });

    const created = [];
    for (const p of preview.filter((p) => p.willOrder)) {
      const daysToOrder = (await prisma.supplier.findUnique({ where: { id: p.supplierId ?? "" } }))?.daysToOrder ?? 7;
      const arrival = new Date(now);
      arrival.setDate(arrival.getDate() + daysToOrder);
      const order = await prisma.order.create({
        data: {
          folio: `PED-${Date.now()}-${p.materialId}`,
          orderDate: now,
          materialId: p.materialId,
          supplierId: p.supplierId,
          orderedQuantity: p.shortfall,
          estimatedArrivalDate: arrival,
          status: "PENDING",
          month,
          notes: `Auto-generado para ${plan.style} · ${plan.plannedBatches} lote(s) · ${now.toLocaleDateString("es-MX")}`,
        },
      });
      created.push(order);
    }

    res.status(201).json({ created, skipped: preview.filter((p) => !p.willOrder).length });
  } catch (e) { next(e); }
});

export default router;
