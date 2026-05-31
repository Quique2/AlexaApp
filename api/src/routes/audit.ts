import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

// GET /api/audit?limit=50&offset=0&userId=xxx
router.get(
  "/",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 100);
      const offset = parseInt(String(req.query.offset ?? "0"));
      const userId = req.query.userId ? String(req.query.userId) : undefined;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: userId ? { userId } : {},
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.auditLog.count({ where: userId ? { userId } : {} }),
      ]);

      res.json({ logs, total, limit, offset });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
