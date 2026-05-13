import { Router, Request, Response, NextFunction } from "express";
import { ReceptionCondition } from "@prisma/client";
import prisma from "../lib/prisma";
import { z } from "zod";
import { syncInventoryState, checkAndAutoSignOffPlan } from "../lib/jit";

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
      include: {
        material: { include: { inventory: true } },
        // Load existing receptions to correctly compute total received
        receptions: { select: { receivedQuantity: true, isConforming: true } },
      },
    });
    if (!order) return res.status(400).json({ error: "Order not found" });

    const reception = await prisma.reception.create({
      data,
      include: { order: { include: { material: true } } },
    });

    if (data.isConforming) {
      // Sum all conforming receptions (including this new one)
      const previousTotal = order.receptions
        .filter((r) => r.isConforming)
        .reduce((s, r) => s + r.receivedQuantity, 0);
      const totalReceived = previousTotal + data.receivedQuantity;

      await prisma.order.update({
        where: { id: data.orderId },
        data: {
          status:
            totalReceived >= order.orderedQuantity ? "RECEIVED_COMPLETE" : "RECEIVED_PARTIAL",
        },
      });

      const inventory = order.material.inventory;
      if (inventory) {
        await prisma.inventory.update({
          where: { id: inventory.id },
          data: { currentStock: { increment: data.receivedQuantity } },
        });
        await syncInventoryState(inventory.id);
      }

      // Auto sign-off the plan if all its orders are now fully received
      if (order.productionPlanId) {
        await checkAndAutoSignOffPlan(order.productionPlanId);
      }
    }

    res.status(201).json(reception);
  } catch (e) {
    next(e);
  }
});

export default router;
