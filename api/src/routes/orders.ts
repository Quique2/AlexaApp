import { Router, Request, Response, NextFunction } from "express";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import prisma from "../lib/prisma";
import { z } from "zod";
import { syncInventoryState } from "../lib/jit";

const router = Router();

const OrderSchema = z.object({
  orderDate: z.string().transform((s) => new Date(s)),
  materialId: z.string(),
  supplierId: z.string().optional().nullable(),
  productionPlanId: z.string().optional().nullable(),
  orderedQuantity: z.number().positive(),
  totalPaid: z.number().optional().nullable(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional().nullable(),
  estimatedArrivalDate: z
    .string()
    .transform((s) => new Date(s))
    .optional()
    .nullable(),
  status: z.nativeEnum(OrderStatus).default("PENDING"),
  notes: z.string().optional().nullable(),
});

function generateFolio(orderDate: Date, id: string): string {
  const year = orderDate.getFullYear().toString().slice(-2);
  const month = String(orderDate.getMonth() + 1).padStart(2, "0");
  const shortId = id.slice(-4).toUpperCase();
  return `PED-${year}${month}-${shortId}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
}

// GET /api/orders
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, materialId, month, productionPlanId } = req.query;
    const orders = await prisma.order.findMany({
      where: {
        ...(status ? { status: status as OrderStatus } : {}),
        ...(materialId ? { materialId: String(materialId) } : {}),
        ...(month ? { month: String(month) } : {}),
        ...(productionPlanId ? { productionPlanId: String(productionPlanId) } : {}),
      },
      include: {
        material: true,
        supplier: true,
        receptions: true,
        productionPlan: { select: { id: true, style: true, productionDate: true } },
      },
      orderBy: { orderDate: "desc" },
    });
    res.json(orders);
  } catch (e) {
    next(e);
  }
});

// GET /api/orders/summary/monthly
router.get("/summary/monthly", async (_req: Request, res: Response, next: NextFunction) => {
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
        totalPaid: s._sum.totalPaid ?? 0,
        orderCount: s._count.id,
        avgPerOrder: s._count.id > 0 ? (s._sum.totalPaid ?? 0) / s._count.id : 0,
      }))
    );
  } catch (e) {
    next(e);
  }
});

// GET /api/orders/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        material: true,
        supplier: true,
        receptions: true,
        productionPlan: { select: { id: true, style: true, productionDate: true } },
        linkedRequirements: {
          include: {
            productionPlan: { select: { id: true, style: true, productionDate: true } },
          },
        },
      },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (e) {
    next(e);
  }
});

// POST /api/orders
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = OrderSchema.parse(req.body);
    const material = await prisma.material.findUnique({ where: { id: data.materialId } });
    if (!material) return res.status(400).json({ error: "Material not found" });

    const id = crypto.randomUUID();
    const folio = generateFolio(data.orderDate, id);
    const month = monthLabel(data.orderDate);
    const supplierId = data.supplierId ?? material.supplierId;

    const order = await prisma.order.create({
      data: {
        id,
        folio,
        month,
        materialId: data.materialId,
        supplierId,
        productionPlanId: data.productionPlanId,
        orderDate: data.orderDate,
        orderedQuantity: data.orderedQuantity,
        totalPaid: data.totalPaid,
        paymentMethod: data.paymentMethod,
        estimatedArrivalDate: data.estimatedArrivalDate,
        status: data.status,
        notes: data.notes,
      },
      include: { material: true, supplier: true },
    });
    res.status(201).json(order);
  } catch (e) {
    next(e);
  }
});

// PUT /api/orders/:id
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = OrderSchema.partial().parse(req.body);
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data,
      include: { material: true, supplier: true },
    });
    res.json(order);
  } catch (e) {
    next(e);
  }
});

// PATCH /api/orders/:id/confirm-received — register a receipt and sync inventory
router.patch("/:id/confirm-received", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { receivedQuantity, condition, batchLot, receivedBy, notes, isConforming } = z
      .object({
        receivedQuantity: z.number().positive(),
        condition: z
          .enum(["GOOD", "REGULAR", "DAMAGED", "INCOMPLETE", "EXPIRED"])
          .default("GOOD"),
        batchLot: z.string().optional().nullable(),
        receivedBy: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        isConforming: z.boolean().default(true),
      })
      .parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        receptions: { select: { receivedQuantity: true, isConforming: true } },
        material: { include: { inventory: true } },
      },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (["RECEIVED_COMPLETE", "CANCELLED"].includes(order.status)) {
      return res.status(409).json({ error: "La orden ya está cerrada o cancelada" });
    }

    // Create reception record
    const reception = await prisma.reception.create({
      data: {
        receptionDate: new Date(),
        orderId: order.id,
        receivedQuantity,
        condition: condition as any,
        isConforming,
        batchLot,
        receivedBy,
        notes,
      },
    });

    // Compute total received across all conforming receptions
    const previousConformingTotal = order.receptions
      .filter((r) => r.isConforming)
      .reduce((s, r) => s + r.receivedQuantity, 0);
    const totalReceived = previousConformingTotal + (isConforming ? receivedQuantity : 0);

    const newStatus: OrderStatus =
      totalReceived >= order.orderedQuantity ? "RECEIVED_COMPLETE" : "RECEIVED_PARTIAL";

    await prisma.order.update({
      where: { id: order.id },
      data: { status: newStatus },
    });

    // Update inventory stock for conforming receptions
    const inventory = order.material.inventory;
    if (isConforming && inventory) {
      await prisma.inventory.update({
        where: { id: inventory.id },
        data: { currentStock: { increment: receivedQuantity } },
      });
      await syncInventoryState(inventory.id);
    }

    res.json({ reception, orderStatus: newStatus, totalReceived });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/orders/:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.reception.deleteMany({ where: { orderId: req.params.id } });
    await prisma.order.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
