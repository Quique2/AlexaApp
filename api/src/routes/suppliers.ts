import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { z } from "zod";

const router = Router();

const SupplierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: z.string().optional().nullable(),
  materialType: z.string().optional().nullable(),
  daysToOrder: z.number().int().min(1).default(7),
  estimatedDeliveryDays: z.number().int().min(1).default(7),
  minOrderQuantity: z.number().optional().nullable(),
  minOrderUnit: z.string().optional().nullable(),
  hasCredit: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

// GET /api/suppliers
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: { _count: { select: { materials: true, orders: true } } },
      orderBy: { id: "asc" },
    });
    res.json(suppliers);
  } catch (e) {
    next(e);
  }
});

// GET /api/suppliers/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      include: { materials: true, orders: { take: 20, orderBy: { createdAt: "desc" } } },
    });
    if (!supplier) return res.status(404).json({ error: "Supplier not found" });
    res.json(supplier);
  } catch (e) {
    next(e);
  }
});

// PUT /api/suppliers/:id
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = SupplierSchema.partial().omit({ id: true }).parse(req.body);
    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data,
    });
    res.json(supplier);
  } catch (e) {
    next(e);
  }
});

export default router;

