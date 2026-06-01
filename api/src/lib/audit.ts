import { Request } from "express";
import prisma from "./prisma";
import { getSettingBool } from "./settings";

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
    const enableChangeTracking = await getSettingBool("audit", "enableChangeTracking", true);
    await prisma.auditLog.create({
      data: {
        ...params,
        userId: params.userId ?? undefined,
        changes: enableChangeTracking ? (params.changes as any) : undefined,
        metadata: params.metadata as any,
      },
    });
  } catch {
    // Non-blocking: audit failures must never break the main flow
  }
}
