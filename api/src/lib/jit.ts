import prisma from "./prisma";
import type { AlertStatus, ActionStatus } from "@prisma/client";

// ─── Alert status computation (also used by inventory.ts and receptions.ts) ───

export function computeAlertStatus(
  currentStock: number,
  dailyConsumption: number,
  reorderPointDays: number,
  daysToOrder: number
): AlertStatus {
  if (dailyConsumption === 0) return "NONE";
  const coverage = currentStock / dailyConsumption;
  if (currentStock === 0 || coverage <= daysToOrder) return "RED";
  if (coverage <= reorderPointDays) return "YELLOW";
  return "GREEN";
}

// ─── Config ───────────────────────────────────────────────────────────────────

async function getJITConfig() {
  const config = await prisma.jITConfig.findUnique({ where: { id: 1 } });
  return (
    config ?? {
      workingDaysPerWeek: 5,
      maxDaysRawMaterial: 7,
      hopCoverageDays: 90,
      yeastCoverageDays: 15,
      safetyBufferDays: 1,
      avgDailyProduction: 1,
    }
  );
}

// ─── Incoming quantity ────────────────────────────────────────────────────────

/**
 * Sum of remaining (not-yet-received) quantity across all active orders for a
 * material. Includes PENDING, IN_TRANSIT, and RECEIVED_PARTIAL orders.
 */
export async function calculateIncomingQuantity(materialId: string): Promise<number> {
  const activeOrders = await prisma.order.findMany({
    where: {
      materialId,
      status: { in: ["PENDING", "IN_TRANSIT", "RECEIVED_PARTIAL"] },
    },
    include: { receptions: { select: { receivedQuantity: true, isConforming: true } } },
  });

  return activeOrders.reduce((sum, order) => {
    const totalReceived = order.receptions
      .filter((r) => r.isConforming)
      .reduce((s, r) => s + r.receivedQuantity, 0);
    return sum + Math.max(0, order.orderedQuantity - totalReceived);
  }, 0);
}

// ─── Reserved stock (cache recalculation) ─────────────────────────────────────

/**
 * Recomputes Inventory.reservedStock from the sum of reservedQuantity across
 * all active requirements (APPROVED plan, not COMPLETED/CANCELLED production).
 */
export async function recalculateReservedStock(inventoryId: string): Promise<void> {
  const result = await prisma.productionRequirement.aggregate({
    where: {
      inventoryId,
      productionPlan: {
        approvalStatus: "APPROVED",
        productionStatus: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    },
    _sum: { reservedQuantity: true },
  });

  await prisma.inventory.update({
    where: { id: inventoryId },
    data: { reservedStock: result._sum.reservedQuantity ?? 0 },
  });
}

// ─── Requirement action status (pure function) ────────────────────────────────

/**
 * Determines what JIT action is needed for a single production requirement.
 *
 * ORDER_NOW  — gap exists and cannot be covered in time (or isn't covered at all)
 * ORDER_SOON — gap exists but production is far enough away that there's time
 * COVERED    — gap exists but a timely order covers it fully
 * OK         — stock is sufficient for this plan's need
 */
export function calculateRequirementStatus(
  missingQuantity: number,
  incomingQuantity: number,
  productionDate: Date,
  bestExpectedDelivery: Date | null,
  daysToOrder: number,
  safetyBufferDays: number
): ActionStatus {
  if (missingQuantity <= 0) return "OK";

  // Deadline: material must arrive this many ms before production
  const deadlineMs = productionDate.getTime() - safetyBufferDays * 86_400_000;

  // Incoming fully covers the gap with a timely order
  if (incomingQuantity >= missingQuantity && bestExpectedDelivery) {
    if (bestExpectedDelivery.getTime() <= deadlineMs) return "COVERED";
  }

  // Gap not fully covered (or order arrives too late)
  const daysUntilProduction = Math.ceil(
    (productionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilProduction <= daysToOrder + safetyBufferDays) return "ORDER_NOW";
  return "ORDER_SOON";
}

// ─── Recalculate inventory alert status + isCritical ─────────────────────────

export async function recalculateInventoryAlertStatus(inventoryId: string): Promise<void> {
  const inv = await prisma.inventory.findUnique({
    where: { id: inventoryId },
    include: { material: { include: { supplier: true } } },
  });
  if (!inv) return;

  const daysToOrder = inv.material.supplier?.daysToOrder ?? 7;
  const alertStatus = computeAlertStatus(
    inv.currentStock,
    inv.dailyConsumption,
    inv.reorderPointDays,
    daysToOrder
  );

  const criticalCount = await prisma.productionRequirement.count({
    where: {
      inventoryId,
      isCritical: true,
      productionPlan: {
        approvalStatus: "APPROVED",
        productionStatus: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    },
  });

  await prisma.inventory.update({
    where: { id: inventoryId },
    data: { alertStatus, isCritical: criticalCount > 0 },
  });
}

// ─── Calculate / refresh requirements for a plan ─────────────────────────────

/**
 * Creates or updates ProductionRequirement rows for every recipe material of a
 * plan. Does NOT reserve stock — call reserveStockForPlan separately after
 * the plan is approved.
 */
export async function calculateProductionRequirements(planId: string): Promise<void> {
  const plan = await prisma.productionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");

  const config = await getJITConfig();

  const recipeLines = await prisma.recipeLine.findMany({
    where: { beerStyle: plan.style },
    include: {
      material: { include: { inventory: true, supplier: true } },
    },
  });

  const affectedInventoryIds: string[] = [];

  for (const line of recipeLines) {
    const { material } = line;
    const inventory = material.inventory;
    if (!inventory) continue;

    affectedInventoryIds.push(inventory.id);

    const requiredQuantity = line.qtyPerBatch * plan.plannedBatches;
    const incomingQty = await calculateIncomingQuantity(material.id);

    // Reservations from other active plans (exclude this plan's own reservation)
    const otherRes = await prisma.productionRequirement.aggregate({
      where: {
        inventoryId: inventory.id,
        productionPlanId: { not: planId },
        productionPlan: {
          approvalStatus: "APPROVED",
          productionStatus: { notIn: ["COMPLETED", "CANCELLED"] },
        },
      },
      _sum: { reservedQuantity: true },
    });
    const otherReserved = otherRes._sum.reservedQuantity ?? 0;

    // Effective stock available to this plan
    const effectiveAvailable = Math.max(0, inventory.currentStock - otherReserved + incomingQty);
    const missingQuantity = Math.max(0, requiredQuantity - effectiveAvailable);

    // Critical: there's a gap AND incoming orders don't fully cover it
    const isCritical = missingQuantity > 0 && incomingQty < missingQuantity;

    // Best expected delivery from active orders for this material
    const bestOrder = await prisma.order.findFirst({
      where: {
        materialId: material.id,
        status: { in: ["PENDING", "IN_TRANSIT"] },
        estimatedArrivalDate: { not: null },
      },
      orderBy: { estimatedArrivalDate: "asc" },
    });

    const daysToOrder = material.supplier?.daysToOrder ?? 7;
    const actionStatus = calculateRequirementStatus(
      missingQuantity,
      incomingQty,
      plan.productionDate,
      bestOrder?.estimatedArrivalDate ?? null,
      daysToOrder,
      config.safetyBufferDays
    );

    await prisma.productionRequirement.upsert({
      where: {
        productionPlanId_materialId: { productionPlanId: planId, materialId: material.id },
      },
      create: {
        productionPlanId: planId,
        inventoryId: inventory.id,
        materialId: material.id,
        requiredQuantity,
        reservedQuantity: 0,
        missingQuantity,
        isCritical,
        actionStatus,
      },
      update: {
        requiredQuantity,
        missingQuantity,
        isCritical,
        actionStatus,
      },
    });
  }

  // Sync alert status + isCritical for all affected inventory items
  const uniqueIds = [...new Set(affectedInventoryIds)];
  for (const inventoryId of uniqueIds) {
    await recalculateInventoryAlertStatus(inventoryId);
  }
}

// ─── Reserve stock for an approved plan ──────────────────────────────────────

/**
 * Allocates available stock to each requirement of the plan, in order of
 * earliest production date (earlier plans claim stock first). Updates
 * reservedQuantity on each requirement and recomputes Inventory.reservedStock.
 */
export async function reserveStockForPlan(planId: string): Promise<void> {
  const requirements = await prisma.productionRequirement.findMany({
    where: { productionPlanId: planId },
    include: { inventory: true },
  });

  for (const req of requirements) {
    // Stock reserved by other active plans for the same inventory item
    const otherRes = await prisma.productionRequirement.aggregate({
      where: {
        inventoryId: req.inventoryId,
        productionPlanId: { not: planId },
        productionPlan: {
          approvalStatus: "APPROVED",
          productionStatus: { notIn: ["COMPLETED", "CANCELLED"] },
        },
      },
      _sum: { reservedQuantity: true },
    });
    const alreadyReserved = otherRes._sum.reservedQuantity ?? 0;

    const available = Math.max(0, req.inventory.currentStock - alreadyReserved);
    const toReserve = Math.min(req.requiredQuantity, available);

    await prisma.productionRequirement.update({
      where: { id: req.id },
      data: { reservedQuantity: toReserve },
    });
  }

  const inventoryIds = [...new Set(requirements.map((r) => r.inventoryId))];
  for (const inventoryId of inventoryIds) {
    await recalculateReservedStock(inventoryId);
  }
}

// ─── Release reservations when a plan is completed or cancelled ───────────────

export async function releaseReservedStock(planId: string): Promise<void> {
  const requirements = await prisma.productionRequirement.findMany({
    where: { productionPlanId: planId },
    select: { inventoryId: true },
  });

  await prisma.productionRequirement.updateMany({
    where: { productionPlanId: planId },
    data: { reservedQuantity: 0 },
  });

  const inventoryIds = [...new Set(requirements.map((r) => r.inventoryId))];
  for (const inventoryId of inventoryIds) {
    await recalculateReservedStock(inventoryId);
    await recalculateInventoryAlertStatus(inventoryId);
  }
}

// ─── Full sync for a single inventory item ────────────────────────────────────

/**
 * Convenience wrapper: recalculates both reservedStock and alertStatus/isCritical.
 * Call after any stock-changing event (reception, manual update, etc.).
 */
export async function syncInventoryState(inventoryId: string): Promise<void> {
  await recalculateReservedStock(inventoryId);
  await recalculateInventoryAlertStatus(inventoryId);
}

// ─── JIT analysis for a single plan (read-only, no DB writes) ─────────────────

export interface RequirementAnalysis {
  materialId: string;
  materialName: string;
  unit: string;
  requiredQuantity: number;
  currentStock: number;
  reservedByOthers: number;
  incomingQuantity: number;
  effectiveAvailable: number;
  missingQuantity: number;
  isCritical: boolean;
  actionStatus: ActionStatus;
  bestExpectedDelivery: Date | null;
  supplierName: string | null;
  daysToOrder: number;
}

export async function analyzeProductionRequirements(
  planId: string
): Promise<RequirementAnalysis[]> {
  const plan = await prisma.productionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");

  const config = await getJITConfig();

  const recipeLines = await prisma.recipeLine.findMany({
    where: { beerStyle: plan.style },
    include: {
      material: { include: { inventory: true, supplier: true } },
    },
  });

  const results: RequirementAnalysis[] = [];

  for (const line of recipeLines) {
    const { material } = line;
    const inventory = material.inventory;
    if (!inventory) continue;

    const requiredQuantity = line.qtyPerBatch * plan.plannedBatches;
    const incomingQty = await calculateIncomingQuantity(material.id);

    const otherRes = await prisma.productionRequirement.aggregate({
      where: {
        inventoryId: inventory.id,
        productionPlanId: { not: planId },
        productionPlan: {
          approvalStatus: "APPROVED",
          productionStatus: { notIn: ["COMPLETED", "CANCELLED"] },
        },
      },
      _sum: { reservedQuantity: true },
    });
    const reservedByOthers = otherRes._sum.reservedQuantity ?? 0;

    const effectiveAvailable = Math.max(0, inventory.currentStock - reservedByOthers + incomingQty);
    const missingQuantity = Math.max(0, requiredQuantity - effectiveAvailable);
    const isCritical = missingQuantity > 0 && incomingQty < missingQuantity;

    const bestOrder = await prisma.order.findFirst({
      where: {
        materialId: material.id,
        status: { in: ["PENDING", "IN_TRANSIT"] },
        estimatedArrivalDate: { not: null },
      },
      orderBy: { estimatedArrivalDate: "asc" },
    });

    const daysToOrder = material.supplier?.daysToOrder ?? 7;
    const actionStatus = calculateRequirementStatus(
      missingQuantity,
      incomingQty,
      plan.productionDate,
      bestOrder?.estimatedArrivalDate ?? null,
      daysToOrder,
      config.safetyBufferDays
    );

    results.push({
      materialId: material.id,
      materialName: material.name,
      unit: material.unit,
      requiredQuantity,
      currentStock: inventory.currentStock,
      reservedByOthers,
      incomingQuantity: incomingQty,
      effectiveAvailable,
      missingQuantity,
      isCritical,
      actionStatus,
      bestExpectedDelivery: bestOrder?.estimatedArrivalDate ?? null,
      supplierName: material.supplier?.name ?? null,
      daysToOrder,
    });
  }

  return results;
}
