import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { z } from "zod";

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

// GET /api/production
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
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
  } catch (e) {
    next(e);
  }
});

// GET /api/production/upcoming â€” next 7 days
router.get("/upcoming", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);
    const plans = await prisma.productionPlan.findMany({
      where: { productionDate: { gte: now, lte: in7 } },
      orderBy: { productionDate: "asc" },
    });
    res.json(plans);
  } catch (e) {
    next(e);
  }
});

// GET /api/production/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.productionPlan.findUnique({
      where: { id: req.params.id },
    });
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json(plan);
  } catch (e) {
    next(e);
  }
});

// POST /api/production
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = PlanSchema.parse(req.body);
    const plan = await prisma.productionPlan.create({
      data: {
        ...data,
        totalMaltKg: data.maltKgPerBatch * data.plannedBatches,
        totalHopKg: data.hopKgPerBatch * data.plannedBatches,
        totalYeastG: data.yeastGPerBatch * data.plannedBatches,
      },
    });
    res.status(201).json(plan);
  } catch (e) {
    next(e);
  }
});

// PUT /api/production/:id
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = PlanSchema.partial().parse(req.body);
    const existing = await prisma.productionPlan.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ error: "Plan not found" });

    const batches = data.plannedBatches ?? existing.plannedBatches;
    const maltPer = data.maltKgPerBatch ?? existing.maltKgPerBatch;
    const hopPer = data.hopKgPerBatch ?? existing.hopKgPerBatch;
    const yeastPer = data.yeastGPerBatch ?? existing.yeastGPerBatch;

    const plan = await prisma.productionPlan.update({
      where: { id: req.params.id },
      data: {
        ...data,
        totalMaltKg: maltPer * batches,
        totalHopKg: hopPer * batches,
        totalYeastG: yeastPer * batches,
      },
    });
    res.json(plan);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/production/:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.productionPlan.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

// POST /api/production/:id/generate-orders
// Previews or creates orders based on the production plan's recipe.
// Pass ?confirm=true to actually create the orders.
router.post("/:id/generate-orders", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const confirm = req.query.confirm === "true";

    const plan = await prisma.productionPlan.findUnique({ where: { id: req.params.id } });
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    const recipeLines = await prisma.recipeLine.findMany({
      where: { beerStyle: plan.style },
      include: { material: { include: { supplier: true, inventory: true } } },
    });

    if (recipeLines.length === 0) {
      return res.status(422).json({ error: `No hay receta definida para "${plan.style}". AgrÃ©gala en Recetas.` });
    }

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const preview: {
      materialId: string;
      materialName: string;
      unit: string;
      needed: number;
      currentStock: number;
      shortfall: number;
      supplierId: string | null;
      supplierName: string | null;
      estimatedCost: number;
      willOrder: boolean;
    }[] = [];

    for (const line of recipeLines) {
      const needed = line.qtyPerBatch * plan.plannedBatches;
      const currentStock = line.material.inventory?.currentStock ?? 0;
      const shortfall = Math.max(0, needed - currentStock);
      const estimatedCost = shortfall * (line.material.unitPrice ?? 0);

      preview.push({
        materialId: line.materialId,
        materialName: line.material.name,
        unit: line.material.unit,
        needed,
        currentStock,
        shortfall,
        supplierId: line.material.supplierId,
        supplierName: line.material.supplier?.name ?? null,
        estimatedCost,
        willOrder: shortfall > 0,
      });
    }

    if (!confirm) {
      return res.json({ plan, preview, totalEstimatedCost: preview.reduce((a, p) => a + p.estimatedCost, 0) });
    }

    // Mark the production plan as ordered
    await prisma.productionPlan.update({
      where: { id: plan.id },
      data: { orderedAt: now },
    });

    // Create actual orders for materials with shortfall
    const created = [];
    for (const p of preview.filter((p) => p.willOrder)) {
      const daysToOrder = (await prisma.supplier.findUnique({ where: { id: p.supplierId ?? "" } }))?.daysToOrder ?? 7;
      const arrival = new Date(now);
      arrival.setDate(arrival.getDate() + daysToOrder);

      const folio = `PED-${Date.now()}-${p.materialId}`;
      const order = await prisma.order.create({
        data: {
          folio,
          orderDate: now,
          materialId: p.materialId,
          supplierId: p.supplierId,
          orderedQuantity: p.shortfall,
          estimatedArrivalDate: arrival,
          status: "PENDING",
          month,
          notes: `Auto-generado para ${plan.style} Â· ${plan.plannedBatches} lote(s) Â· ${now.toLocaleDateString("es-MX")}`,
        },
      });
      created.push(order);
    }

    res.status(201).json({ created, skipped: preview.filter((p) => !p.willOrder).length });
  } catch (e) {
    next(e);
  }
});

export default router;

