import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import type { AuthRequest } from "./requireAuth";

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

export async function requireActive(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req as AuthRequest;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, email: true },
    });

    if (!user || !user.isActive) {
      return res.status(403).json({ error: "Cuenta desactivada" });
    }

    const emailBlocked = await prisma.blockedEntity.findUnique({
      where: { type_value: { type: "EMAIL", value: user.email } },
    });
    if (emailBlocked) return res.status(403).json({ error: "Acceso restringido" });

    const ip = getClientIp(req);
    if (ip !== "unknown") {
      const ipBlocked = await prisma.blockedEntity.findUnique({
        where: { type_value: { type: "IP", value: ip } },
      });
      if (ipBlocked) return res.status(403).json({ error: "Acceso restringido" });
    }

    next();
  } catch (e) {
    next(e);
  }
}
