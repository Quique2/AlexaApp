import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/recipes?style=LÃ¶ndon
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const style = req.query.style as string | undefined;
    const lines = await prisma.recipeLine.findMany({
      where: style ? { beerStyle: style } : undefined,
      include: { material: { include: { supplier: true } } },
      orderBy: [{ beerStyle: "asc" }, { qtyPerBatch: "desc" }],
    });
    res.json(lines);
  } catch (e) { next(e); }
});

// POST /api/recipes
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { beerStyle, materialId, qtyPerBatch, notes } = req.body;
    const line = await prisma.recipeLine.upsert({
      where: { beerStyle_materialId: { beerStyle, materialId } },
      update: { qtyPerBatch, notes },
      create: { beerStyle, materialId, qtyPerBatch, notes },
      include: { material: true },
    });
    res.status(201).json(line);
  } catch (e) { next(e); }
});

// PUT /api/recipes/:id
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qtyPerBatch, notes } = req.body;
    const line = await prisma.recipeLine.update({
      where: { id: req.params.id },
      data: { qtyPerBatch, notes },
      include: { material: true },
    });
    res.json(line);
  } catch (e) { next(e); }
});

// DELETE /api/recipes/:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.recipeLine.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) { next(e); }
});

export default router;

