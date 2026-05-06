import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import type { Role } from "../lib/permissions";
import type { AuthRequest } from "./requireAuth";

export interface RoleRequest extends AuthRequest {
  userRole: Role;
}

export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req as AuthRequest;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        return res.status(403).json({ error: "Cuenta desactivada" });
      }

      if (!roles.includes(user.role as Role)) {
        return res.status(403).json({ error: "No tienes permiso para esta acción" });
      }

      (req as RoleRequest).userRole = user.role as Role;
      next();
    } catch (e) {
      next(e);
    }
  };
}
