import { Router, Request, Response, NextFunction } from "express";
import { MaterialType } from "@prisma/client";
import prisma from "../lib/prisma";
import { z } from "zod";

const router = Router();

const MaterialSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.nativeEnum(MaterialType),
  brand: z.string().optional().nullable(),
  unit: z.string().min(1),
  unitPrice: z.number().min(0).default(0),
  supplierId: z.string().optional().nullable(),
});

// GET /api/materials
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, search, supplierId } = req.query;
    const materials = await prisma.material.findMany({
      where: {
        ...(type ? { type: type as MaterialType } : {}),
        ...(supplierId ? { supplierId: String(supplierId) } : {}),
        ...(search
          ? { name: { contains: String(search), mode: "insensitive" } }
          : {}),
      },
      include: { supplier: true, inventory: true },
      orderBy: { id: "asc" },
    });
    res.json(materials);
  } catch (e) {
    next(e);
  }
});

// GET /api/materials/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const material = await prisma.material.findUnique({
      where: { id: req.params.id },
      include: { supplier: true, inventory: true, orders: { take: 10, orderBy: { createdAt: "desc" } } },
    });
    if (!material) return res.status(404).json({ error: "Material not found" });
    res.json(material);
  } catch (e) {
    next(e);
  }
});

// POST /api/materials
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = MaterialSchema.parse(req.body);
    const material = await prisma.material.create({
      data,
      include: { supplier: true },
    });
    // Auto-create inventory row
    await prisma.inventory.create({
      data: { materialId: material.id, reorderPointDays: 7 },
    });
    res.status(201).json(material);
  } catch (e) {
    next(e);
  }
});

// PUT /api/materials/:id
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = MaterialSchema.partial().parse(req.body);
    const material = await prisma.material.update({
      where: { id: req.params.id },
      data,
      include: { supplier: true },
    });
    res.json(material);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/materials/:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.inventory.deleteMany({ where: { materialId: req.params.id } });
    await prisma.material.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;

