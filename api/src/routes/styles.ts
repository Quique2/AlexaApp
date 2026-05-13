import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

// GET /api/styles — all style metadata (name + imageUri)
router.get("/", requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Return styles that have recipe lines OR explicit StyleMeta rows
    const [recipeStyles, metaRows] = await Promise.all([
      prisma.recipeLine.groupBy({ by: ["beerStyle"], orderBy: { beerStyle: "asc" } }),
      prisma.styleMeta.findMany(),
    ]);

    const metaMap = new Map(metaRows.map((m) => [m.name, m]));
    const allNames = new Set([
      ...recipeStyles.map((r) => r.beerStyle),
      ...metaRows.map((m) => m.name),
    ]);

    const styles = Array.from(allNames).sort().map((name) => ({
      name,
      imageUri: metaMap.get(name)?.imageUri ?? null,
    }));

    res.json(styles);
  } catch (e) {
    next(e);
  }
});

// POST /api/styles — create a new style entry
router.post(
  "/",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, imageUri } = req.body as { name: string; imageUri?: string };
      if (!name?.trim()) return res.status(400).json({ error: "El nombre no puede estar vacío" });

      const style = await prisma.styleMeta.upsert({
        where: { name: name.trim() },
        update: { imageUri: imageUri ?? null },
        create: { name: name.trim(), imageUri: imageUri ?? null },
      });
      res.status(201).json(style);
    } catch (e) {
      next(e);
    }
  }
);

// PUT /api/styles/:name — update imageUri and/or rename
router.put(
  "/:name",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const oldName = decodeURIComponent(req.params.name);
      const { name: newName, imageUri } = req.body as { name?: string; imageUri?: string };

      const trimmedNew = newName?.trim();

      // If renaming, cascade to RecipeLine and ProductionPlan in a transaction
      if (trimmedNew && trimmedNew !== oldName) {
        const existing = await prisma.styleMeta.findUnique({ where: { name: trimmedNew } });
        if (existing) {
          return res.status(409).json({ error: "Ya existe un producto con ese nombre" });
        }

        const [meta] = await prisma.$transaction([
          prisma.styleMeta.upsert({
            where: { name: trimmedNew },
            update: { imageUri: imageUri !== undefined ? imageUri : undefined },
            create: { name: trimmedNew, imageUri: imageUri ?? null },
          }),
          prisma.recipeLine.updateMany({
            where: { beerStyle: oldName },
            data: { beerStyle: trimmedNew },
          }),
          prisma.productionPlan.updateMany({
            where: { style: oldName },
            data: { style: trimmedNew },
          }),
          prisma.styleMeta.deleteMany({ where: { name: oldName } }),
        ]);

        return res.json(meta);
      }

      // Only updating imageUri (no rename)
      const meta = await prisma.styleMeta.upsert({
        where: { name: oldName },
        update: { imageUri: imageUri !== undefined ? imageUri : undefined },
        create: { name: oldName, imageUri: imageUri ?? null },
      });
      res.json(meta);
    } catch (e) {
      next(e);
    }
  }
);

// DELETE /api/styles/:name — delete all recipe lines + StyleMeta for this style
router.delete(
  "/:name",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const name = decodeURIComponent(req.params.name);
      await prisma.$transaction([
        prisma.recipeLine.deleteMany({ where: { beerStyle: name } }),
        prisma.styleMeta.deleteMany({ where: { name } }),
      ]);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
);

export default router;
