import prisma from "./prisma";

export async function logAudit(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({ data: params });
  } catch {
    // Non-blocking: audit failures must never break the main flow
  }
}
