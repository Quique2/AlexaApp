import { Request } from "express";
import prisma from "./prisma";

export interface AuditChange {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
  unit?: string;
}

export function extractIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ip.trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

export async function logAudit(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  description?: string;
  ipAddress?: string;
  changes?: AuditChange[];
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({ data: params });
  } catch {
    // Non-blocking: audit failures must never break the main flow
  }
}
