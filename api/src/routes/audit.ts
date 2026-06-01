import { Router, Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import prisma from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";

const router = Router();

async function getActorRole(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role ?? "OPERATOR";
}

function isPrivileged(role: string): boolean {
  return role === "DEVELOPER" || role === "SUPERVISOR";
}

function buildWhere(params: {
  forUserId?: string;
  search?: string;
  action?: string;
  entityType?: string;
  onlyChanges?: boolean;
}): Prisma.AuditLogWhereInput {
  const { forUserId, search, action, entityType, onlyChanges } = params;
  return {
    ...(forUserId ? { userId: forUserId } : {}),
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(onlyChanges ? { changes: { not: Prisma.DbNull } } : {}),
    ...(search
      ? {
          OR: [
            { entityName: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { action: { contains: search, mode: "insensitive" } },
            { entityType: { contains: search, mode: "insensitive" } },
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

const userSelect = { id: true, name: true, email: true, role: true };

// GET /api/audit/recent — top 10 global (SUPERVISOR+) or own (others)
router.get("/recent", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = (req as AuthRequest).userId;
    const role = await getActorRole(actorId);
    const forUserId = isPrivileged(role) ? undefined : actorId;

    const logs = await prisma.auditLog.findMany({
      where: forUserId ? { userId: forUserId } : {},
      include: { user: { select: userSelect } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    res.json(logs);
  } catch (e) {
    next(e);
  }
});

// GET /api/audit/grouped-by-user — activity summary per user (SUPERVISOR+)
router.get(
  "/grouped-by-user",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = (req as AuthRequest).userId;
      const role = await getActorRole(actorId);
      if (!isPrivileged(role)) {
        return res.status(403).json({ error: "Acceso no autorizado" });
      }

      const groups = await prisma.auditLog.groupBy({
        by: ["userId"],
        _count: { id: true },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: "desc" } },
      });

      const userIds = groups.map((g) => g.userId).filter(Boolean) as string[];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: userSelect,
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      const result = groups.map((g) => ({
        userId: g.userId,
        user: g.userId ? (userMap.get(g.userId) ?? null) : null,
        count: g._count.id,
        lastActivity: g._max.createdAt,
      }));

      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/audit/user/:userId — logs for a specific user
router.get(
  "/user/:userId",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = (req as AuthRequest).userId;
      const role = await getActorRole(actorId);
      const targetId = req.params.userId;

      if (!isPrivileged(role) && actorId !== targetId) {
        return res.status(403).json({ error: "Solo puedes ver tu propia actividad" });
      }

      const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 100);
      const offset = parseInt(String(req.query.offset ?? "0"));
      const search = req.query.search ? String(req.query.search) : undefined;
      const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
      const onlyChanges = req.query.onlyChanges === "true";

      const where = buildWhere({ forUserId: targetId, search, entityType, onlyChanges });
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: { user: { select: userSelect } },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.auditLog.count({ where }),
      ]);

      res.json({ logs, total, limit, offset });
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/audit — global listing with search + filters
router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = (req as AuthRequest).userId;
    const role = await getActorRole(actorId);
    const forUserId = isPrivileged(role)
      ? req.query.userId
        ? String(req.query.userId)
        : undefined
      : actorId;

    const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 100);
    const offset = parseInt(String(req.query.offset ?? "0"));
    const search = req.query.search ? String(req.query.search) : undefined;
    const action = req.query.action ? String(req.query.action) : undefined;
    const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
    const onlyChanges = req.query.onlyChanges === "true";

    const where = buildWhere({ forUserId, search, action, entityType, onlyChanges });
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: userSelect } },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, limit, offset });
  } catch (e) {
    next(e);
  }
});

// GET /api/audit/export — Excel download
router.get("/export", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = (req as AuthRequest).userId;
    const role = await getActorRole(actorId);
    const forUserId = isPrivileged(role)
      ? req.query.userId
        ? String(req.query.userId)
        : undefined
      : actorId;

    const search = req.query.search ? String(req.query.search) : undefined;
    const action = req.query.action ? String(req.query.action) : undefined;
    const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
    const onlyChanges = req.query.onlyChanges === "true";

    const where = buildWhere({ forUserId, search, action, entityType, onlyChanges });
    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: userSelect } },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const rows: any[][] = [
      ["Fecha", "Hora", "Usuario", "Correo", "Rol", "Acción", "Entidad", "Descripción", "Campo", "Antes", "Después", "IP"],
    ];

    for (const log of logs) {
      const date = new Date(log.createdAt);
      const dateStr = date.toLocaleDateString("es-MX");
      const timeStr = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      const userName = log.user?.name ?? log.user?.email ?? "Sistema";
      const userEmail = log.user?.email ?? "";
      const userRole = log.user?.role ?? "";
      const changes = Array.isArray(log.changes) ? log.changes as any[] : [];

      if (changes.length > 0) {
        for (const c of changes) {
          rows.push([
            dateStr, timeStr, userName, userEmail, userRole,
            log.action, log.entityName ?? log.entityType, log.description ?? "",
            c.label ?? c.field, `${c.oldValue ?? ""}${c.unit ? " " + c.unit : ""}`,
            `${c.newValue ?? ""}${c.unit ? " " + c.unit : ""}`,
            log.ipAddress ?? "",
          ]);
        }
      } else {
        rows.push([
          dateStr, timeStr, userName, userEmail, userRole,
          log.action, log.entityName ?? log.entityType, log.description ?? "",
          "", "", "", log.ipAddress ?? "",
        ]);
      }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 28 }, { wch: 12 },
      { wch: 28 }, { wch: 28 }, { wch: 40 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Auditoría");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", `attachment; filename=auditoria_${Date.now()}.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

export default router;
