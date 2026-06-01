import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { logAudit, extractIp } from "../lib/audit";

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
      await logAudit({
        userId: (req as AuthRequest).userId,
        action: "ENTITY_BLOCKED",
        entityType: "BlockedEntity",
        entityId: entity.id,
        entityName: `${parse.data.type}: ${parse.data.value}`,
        description: `Bloqueado ${parse.data.type === "EMAIL" ? "correo" : "IP"}: ${parse.data.value}`,
        ipAddress: extractIp(req),
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
      const entity = await prisma.blockedEntity.findUnique({ where: { id: req.params.id } });
      await prisma.blockedEntity.delete({ where: { id: req.params.id } });
      await logAudit({
        userId: (req as AuthRequest).userId,
        action: "ENTITY_UNBLOCKED",
        entityType: "BlockedEntity",
        entityId: req.params.id,
        entityName: entity ? `${entity.type}: ${entity.value}` : req.params.id,
        description: entity ? `Desbloqueado ${entity.type === "EMAIL" ? "correo" : "IP"}: ${entity.value}` : undefined,
        ipAddress: extractIp(req),
      });
      res.status(204).send();
    } catch (e) { next(e); }
  }
);

export default router;
