import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { logAudit, extractIp } from "../lib/audit";

const router = Router();

// GET /api/recipes/styles
router.get("/styles", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.recipeLine.groupBy({ by: ["beerStyle"], orderBy: { beerStyle: "asc" } });
    res.json(rows.map((r) => r.beerStyle));
  } catch (e) { next(e); }
});

// GET /api/recipes
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
router.post("/", requireAuth, requireRole("DEVELOPER", "SUPERVISOR"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { beerStyle, materialId, qtyPerBatch, notes } = req.body;
    const existing = await prisma.recipeLine.findUnique({
      where: { beerStyle_materialId: { beerStyle, materialId } },
      include: { material: true },
    });
    const line = await prisma.recipeLine.upsert({
      where: { beerStyle_materialId: { beerStyle, materialId } },
      update: { qtyPerBatch, notes },
      create: { beerStyle, materialId, qtyPerBatch, notes },
      include: { material: true },
    });
    const action = existing ? "RECIPE_LINE_UPDATED" : "RECIPE_LINE_CREATED";
    const changes = existing && existing.qtyPerBatch !== qtyPerBatch
      ? [{ field: "qtyPerBatch", label: "Cantidad por lote", oldValue: existing.qtyPerBatch, newValue: qtyPerBatch, unit: line.material.unit }]
      : undefined;
    await logAudit({
      userId: (req as AuthRequest).userId,
      action,
      entityType: "RecipeLine",
      entityId: line.id,
      entityName: `${beerStyle} · ${line.material.name}`,
      description: `Receta ${existing ? "actualizada" : "creada"}: ${beerStyle} — ${line.material.name}`,
      ipAddress: extractIp(req),
      changes,
    });
    res.status(201).json(line);
  } catch (e) { next(e); }
});

// PUT /api/recipes/:id
router.put("/:id", requireAuth, requireRole("DEVELOPER", "SUPERVISOR"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qtyPerBatch, notes } = req.body;
    const existing = await prisma.recipeLine.findUnique({ where: { id: req.params.id }, include: { material: true } });
    const line = await prisma.recipeLine.update({
      where: { id: req.params.id },
      data: { qtyPerBatch, notes },
      include: { material: true },
    });
    await logAudit({
      userId: (req as AuthRequest).userId,
      action: "RECIPE_LINE_UPDATED",
      entityType: "RecipeLine",
      entityId: line.id,
      entityName: `${line.beerStyle} · ${line.material.name}`,
      description: `Receta actualizada: ${line.beerStyle} — ${line.material.name}`,
      ipAddress: extractIp(req),
      changes: existing && existing.qtyPerBatch !== qtyPerBatch
        ? [{ field: "qtyPerBatch", label: "Cantidad por lote", oldValue: existing.qtyPerBatch, newValue: qtyPerBatch, unit: line.material.unit }]
        : undefined,
    });
    res.json(line);
  } catch (e) { next(e); }
});

// DELETE /api/recipes/:id
router.delete("/:id", requireAuth, requireRole("DEVELOPER", "SUPERVISOR"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const line = await prisma.recipeLine.findUnique({ where: { id: req.params.id }, include: { material: true } });
    await prisma.recipeLine.delete({ where: { id: req.params.id } });
    await logAudit({
      userId: (req as AuthRequest).userId,
      action: "RECIPE_LINE_DELETED",
      entityType: "RecipeLine",
      entityId: req.params.id,
      entityName: line ? `${line.beerStyle} · ${line.material.name}` : req.params.id,
      description: line ? `Ingrediente eliminado de receta: ${line.beerStyle} — ${line.material.name}` : undefined,
      ipAddress: extractIp(req),
    });
    res.status(204).send();
  } catch (e) { next(e); }
});

export default router;
