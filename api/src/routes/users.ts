import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { requireRole, RoleRequest } from "../middleware/requireRole";
import { canModifyUser, canAssignRole, canManageUsers } from "../lib/permissions";
import type { Role } from "../lib/permissions";
import { logAudit, extractIp } from "../lib/audit";

const router = Router();

// GET /api/users
router.get(
  "/",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true, email: true, name: true, role: true,
          isActive: true, createdAt: true, createdById: true,
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      });
      res.json(users);
    } catch (e) { next(e); }
  }
);

// GET /api/users/:id
router.get(
  "/:id",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      });
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
      res.json(user);
    } catch (e) { next(e); }
  }
);

// POST /api/users
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  role: z.enum(["DEVELOPER", "SUPERVISOR", "OPERATOR", "TRANSPORTER"]).default("OPERATOR"),
});

router.post(
  "/",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorRole = (req as RoleRequest).userRole;
      const actorId = (req as AuthRequest).userId;
      const parse = createUserSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ error: parse.error.flatten().fieldErrors });
      }
      const { email, password, name, role } = parse.data;

      if (!canAssignRole(actorRole, role as Role)) {
        return res.status(403).json({ error: "No puedes asignar ese rol" });
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ error: "Este email ya está registrado" });

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { email, passwordHash, name, role: role as any, createdById: actorId },
        select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      });
      await logAudit({
        userId: actorId,
        action: "USER_CREATED",
        entityType: "User",
        entityId: user.id,
        entityName: name ?? email,
        description: `Usuario creado: ${name ?? email} (${role})`,
        ipAddress: extractIp(req),
        changes: [{ field: "role", label: "Rol", oldValue: null, newValue: role }],
      });
      res.status(201).json(user);
    } catch (e) { next(e); }
  }
);

// PUT /api/users/:id
const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["DEVELOPER", "SUPERVISOR", "OPERATOR", "TRANSPORTER"]).optional(),
  isActive: z.boolean().optional(),
});

router.put(
  "/:id",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorRole = (req as RoleRequest).userRole;
      const parse = updateUserSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ error: parse.error.flatten().fieldErrors });
      }

      const target = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { role: true },
      });
      if (!target) return res.status(404).json({ error: "Usuario no encontrado" });

      if (!canModifyUser(actorRole, target.role as Role)) {
        return res.status(403).json({ error: "No puedes modificar a este usuario" });
      }

      if (parse.data.role && !canAssignRole(actorRole, parse.data.role as Role)) {
        return res.status(403).json({ error: "No puedes asignar ese rol" });
      }

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: parse.data as any,
        select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      });
      const actorId = (req as AuthRequest).userId;
      const changes = [];
      if (parse.data.role && parse.data.role !== target.role) {
        changes.push({ field: "role", label: "Rol", oldValue: target.role, newValue: parse.data.role });
      }
      if (parse.data.isActive !== undefined) {
        changes.push({ field: "isActive", label: "Estado", oldValue: !parse.data.isActive, newValue: parse.data.isActive });
      }
      const action = parse.data.isActive === false ? "USER_DEACTIVATED" : parse.data.isActive === true ? "USER_ACTIVATED" : "USER_ROLE_CHANGED";
      await logAudit({
        userId: actorId,
        action,
        entityType: "User",
        entityId: req.params.id,
        entityName: user.name ?? user.email,
        description: changes.length > 0 ? `Usuario actualizado: ${user.name ?? user.email}` : undefined,
        ipAddress: extractIp(req),
        changes: changes.length > 0 ? changes : undefined,
      });
      res.json(user);
    } catch (e) { next(e); }
  }
);

// POST /api/users/:id/reset-password
router.post(
  "/:id/reset-password",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorRole = (req as RoleRequest).userRole;
      const { password } = req.body;
      if (!password || String(password).length < 8) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
      }

      const target = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { role: true },
      });
      if (!target) return res.status(404).json({ error: "Usuario no encontrado" });

      if (!canModifyUser(actorRole, target.role as Role)) {
        return res.status(403).json({ error: "No puedes modificar a este usuario" });
      }

      const passwordHash = await bcrypt.hash(String(password), 12);
      await prisma.user.update({
        where: { id: req.params.id },
        data: { passwordHash },
      });
      // Invalidate all existing sessions for this user
      await prisma.userSession.deleteMany({ where: { userId: req.params.id } });
      await logAudit({
        userId: (req as AuthRequest).userId,
        action: "PASSWORD_RESET",
        entityType: "User",
        entityId: req.params.id,
        entityName: target ? undefined : req.params.id,
        description: "Contraseña reseteada por administrador",
        ipAddress: extractIp(req),
      });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

export default router;
