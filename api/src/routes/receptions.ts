import { Router, Request, Response, NextFunction } from "express";
import { ReceptionCondition, AlertStatus } from "@prisma/client";
import prisma from "../lib/prisma";
import { z } from "zod";

function computeAlertStatus(
  currentStock: number, dailyConsumption: number,
  reorderPointDays: number, daysToOrder: number
): AlertStatus {
  if (dailyConsumption === 0) return "NONE";
  const coverage = currentStock / dailyConsumption;
  if (currentStock === 0 || coverage <= daysToOrder) return "RED";
  if (coverage <= reorderPointDays) return "YELLOW";
  return "GREEN";
}

const router = Router();

const ReceptionSchema = z.object({
  receptionDate: z.string().transform((s) => new Date(s)),
  orderId: z.string(),
  receivedQuantity: z.number().positive(),
  condition: z.nativeEnum(ReceptionCondition).default("GOOD"),
  isConforming: z.boolean().default(true),
  batchLot: z.string().optional().nullable(),
  receivedBy: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/receptions
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.query;
    const receptions = await prisma.reception.findMany({
      where: orderId ? { orderId: String(orderId) } : {},
      include: { order: { include: { material: true } } },
      orderBy: { receptionDate: "desc" },
    });
    res.json(receptions);
  } catch (e) {
    next(e);
  }
});

// GET /api/receptions/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reception = await prisma.reception.findUnique({
      where: { id: req.params.id },
      include: { order: { include: { material: true, supplier: true } } },
    });
    if (!reception) return res.status(404).json({ error: "Reception not found" });
    res.json(reception);
  } catch (e) {
    next(e);
  }
});

// POST /api/receptions
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = ReceptionSchema.parse(req.body);
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { material: true },
    });
    if (!order) return res.status(400).json({ error: "Order not found" });

    const reception = await prisma.reception.create({
      data,
      include: { order: { include: { material: true } } },
    });

    // Auto-update order status and inventory stock
    if (data.isConforming) {
      await prisma.order.update({
        where: { id: data.orderId },
        data: {
          status:
            data.receivedQuantity >= order.orderedQuantity
              ? "RECEIVED_COMPLETE"
              : "RECEIVED_PARTIAL",
        },
      });

      const inv = await prisma.inventory.findUnique({
        where: { materialId: order.materialId },
        include: { material: { include: { supplier: true } } },
      });

      if (inv) {
        const newStock = inv.currentStock + data.receivedQuantity;
        const daysToOrder = inv.material.supplier?.daysToOrder ?? 7;
        const newAlert = computeAlertStatus(
          newStock, inv.dailyConsumption, inv.reorderPointDays, daysToOrder
        );
        const newQtyToOrder =
          inv.dailyConsumption > 0
            ? Math.max(0, inv.dailyConsumption * inv.reorderPointDays - newStock)
            : 0;

        await prisma.inventory.update({
          where: { materialId: order.materialId },
          data: {
            currentStock: newStock,
            alertStatus: newAlert,
            quantityToOrder: newQtyToOrder,
            estimatedOrderCost: newQtyToOrder * (inv.material.unitPrice ?? 0),
          },
        });
      }
    }

    res.status(201).json(reception);
  } catch (e) {
    next(e);
  }
});

export default router;

