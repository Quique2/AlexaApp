import { Router, Request, Response, NextFunction } from "express";
import { AlertStatus } from "@prisma/client";
import prisma from "../lib/prisma";
import { z } from "zod";

const router = Router();

function computeAlertStatus(
  currentStock: number,
  dailyConsumption: number,
  reorderPointDays: number,
  daysToOrder: number
): AlertStatus {
  if (dailyConsumption === 0) return "NONE";
  const coverageDays = currentStock / dailyConsumption;
  if (currentStock === 0 || coverageDays <= daysToOrder) return "RED";
  if (coverageDays <= reorderPointDays) return "YELLOW";
  return "GREEN";
}

const UpdateSchema = z.object({
  currentStock: z.number().min(0).optional(),
  dailyConsumption: z.number().min(0).optional(),
  reorderPointDays: z.number().int().min(1).optional(),
  notes: z.string().optional().nullable(),
});

// GET /api/inventory
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alert, type, search } = req.query;
    const rows = await prisma.inventory.findMany({
      where: {
        ...(alert ? { alertStatus: alert as AlertStatus } : {}),
        material: {
          ...(type ? { type: type as any } : {}),
          ...(search
            ? { name: { contains: String(search), mode: "insensitive" } }
            : {}),
        },
      },
      include: {
        material: { include: { supplier: true } },
      },
      orderBy: [
        { alertStatus: "asc" }, // RED first
        { material: { name: "asc" } },
      ],
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// GET /api/inventory/alerts â€” only RED and YELLOW
router.get("/alerts", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.inventory.findMany({
      where: { alertStatus: { in: ["RED", "YELLOW"] } },
      include: { material: { include: { supplier: true } } },
      orderBy: [{ alertStatus: "asc" }, { material: { name: "asc" } }],
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// GET /api/inventory/:materialId
router.get("/:materialId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await prisma.inventory.findUnique({
      where: { materialId: req.params.materialId },
      include: { material: { include: { supplier: true } } },
    });
    if (!row) return res.status(404).json({ error: "Inventory row not found" });
    res.json(row);
  } catch (e) {
    next(e);
  }
});

// PUT /api/inventory/:materialId
router.put("/:materialId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = UpdateSchema.parse(req.body);

    const current = await prisma.inventory.findUnique({
      where: { materialId: req.params.materialId },
      include: { material: { include: { supplier: true } } },
    });
    if (!current) return res.status(404).json({ error: "Not found" });

    const newStock = updates.currentStock ?? current.currentStock;
    const newConsumption = updates.dailyConsumption ?? current.dailyConsumption;
    const newReorderDays = updates.reorderPointDays ?? current.reorderPointDays;
    const daysToOrder = current.material.supplier?.daysToOrder ?? 7;

    const alertStatus = computeAlertStatus(
      newStock,
      newConsumption,
      newReorderDays,
      daysToOrder
    );

    const quantityToOrder =
      newConsumption > 0
        ? Math.max(0, newConsumption * newReorderDays - newStock)
        : 0;

    const estimatedOrderCost = quantityToOrder * current.material.unitPrice;

    const updated = await prisma.inventory.update({
      where: { materialId: req.params.materialId },
      data: {
        ...updates,
        alertStatus,
        quantityToOrder,
        estimatedOrderCost,
      },
      include: { material: { include: { supplier: true } } },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

export default router;

