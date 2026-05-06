import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

// GET /api/admin/blocked
router.get(
  "/blocked",
  requireAuth,
  requireRole("DEVELOPER"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const entities = await prisma.blockedEntity.findMany({
        orderBy: { createdAt: "desc" },
      });
      res.json(entities);
    } catch (e) { next(e); }
  }
);

// POST /api/admin/blocked
const blockSchema = z.object({
  type: z.enum(["EMAIL", "IP"]),
  value: z.string().min(1),
  reason: z.string().optional(),
});

router.post(
  "/blocked",
  requireAuth,
  requireRole("DEVELOPER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parse = blockSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ error: parse.error.flatten().fieldErrors });
      }
      const entity = await prisma.blockedEntity.upsert({
        where: { type_value: { type: parse.data.type, value: parse.data.value } },
        create: parse.data as any,
        update: { reason: parse.data.reason },
      });
      res.status(201).json(entity);
    } catch (e) { next(e); }
  }
);

// DELETE /api/admin/blocked/:id
router.delete(
  "/blocked/:id",
  requireAuth,
  requireRole("DEVELOPER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.blockedEntity.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (e) { next(e); }
  }
);

export default router;
