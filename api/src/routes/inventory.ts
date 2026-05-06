import { Router, Request, Response, NextFunction } from "express";
import { AlertStatus } from "@prisma/client";
import prisma from "../lib/prisma";
import { z } from "zod";
import * as XLSX from "xlsx";
import multer from "multer";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function computeAlertStatus(
  currentStock: number,
  dailyConsumption: number,
  reorderPointDays: number,
  daysToOrder: number
): AlertStatus {
  if (dailyConsumption === 0) return "NONE";
  const coverageDays = currentStock / dailyConsumption;
  if (currentStock === 0 || coverageDays <= daysToOrder) return "RED";
  if (coverageDays <= reorderPointDays) return "YELLOW";
  return "GREEN";
}

const UpdateSchema = z.object({
  currentStock: z.number().min(0).optional(),
  dailyConsumption: z.number().min(0).optional(),
  reorderPointDays: z.number().int().min(1).optional(),
  notes: z.string().optional().nullable(),
});

// GET /api/inventory
router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alert, type, search } = req.query;
    const rows = await prisma.inventory.findMany({
      where: {
        ...(alert ? { alertStatus: alert as AlertStatus } : {}),
        material: {
          ...(type ? { type: type as any } : {}),
          ...(search ? { name: { contains: String(search), mode: "insensitive" } } : {}),
        },
      },
      include: { material: { include: { supplier: true } } },
      orderBy: [{ alertStatus: "asc" }, { material: { name: "asc" } }],
    });
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/inventory/template — download Excel template
router.get(
  "/template",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await prisma.inventory.findMany({
        include: { material: true },
        orderBy: { material: { name: "asc" } },
      });

      const data = [
        ["id", "nombre", "unidad", "stockActual", "consumoDiario", "notas"],
        ...rows.map((r) => [
          r.material.id,
          r.material.name,
          r.material.unit,
          r.currentStock,
          r.dailyConsumption,
          r.notes ?? "",
        ]),
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, ws, "Inventario");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Disposition", "attachment; filename=inventario_template.xlsx");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buffer);
    } catch (e) { next(e); }
  }
);

// POST /api/inventory/import — bulk update from Excel
router.post(
  "/import",
  requireAuth,
  requireRole("DEVELOPER", "SUPERVISOR"),
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No se recibió archivo" });

      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

      let updated = 0;
      const errors: { row: number; id: string; reason: string }[] = [];

      for (let i = 0; i < raw.length; i++) {
        const rowNum = i + 2; // 1-indexed + header
        const row = raw[i];
        const id = String(row["id"] ?? "").trim();

        if (!id) {
          errors.push({ row: rowNum, id: "", reason: "id vacío" });
          continue;
        }

        const stockRaw = parseFloat(row["stockActual"]);
        const consumoRaw = parseFloat(row["consumoDiario"]);

        if (isNaN(stockRaw) || stockRaw < 0) {
          errors.push({ row: rowNum, id, reason: "stockActual inválido" });
          continue;
        }

        const inv = await prisma.inventory.findUnique({
          where: { materialId: id },
          include: { material: { include: { supplier: true } } },
        });

        if (!inv) {
          errors.push({ row: rowNum, id, reason: "Material no encontrado" });
          continue;
        }

        const newConsumption = isNaN(consumoRaw) ? inv.dailyConsumption : consumoRaw;
        const newStock = stockRaw;
        const daysToOrder = inv.material.supplier?.daysToOrder ?? 7;
        const alertStatus = computeAlertStatus(newStock, newConsumption, inv.reorderPointDays, daysToOrder);
        const quantityToOrder = newConsumption > 0
          ? Math.max(0, newConsumption * inv.reorderPointDays - newStock)
          : 0;
        const estimatedOrderCost = quantityToOrder * inv.material.unitPrice;

        await prisma.inventory.update({
          where: { materialId: id },
          data: {
            currentStock: newStock,
            dailyConsumption: newConsumption,
            notes: String(row["notas"] ?? "").trim() || inv.notes,
            alertStatus,
            quantityToOrder,
            estimatedOrderCost,
          },
        });
        updated++;
      }

      res.json({ updated, errors, total: raw.length });
    } catch (e) { next(e); }
  }
);

// GET /api/inventory/alerts
router.get("/alerts", requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.inventory.findMany({
      where: { alertStatus: { in: ["RED", "YELLOW"] } },
      include: { material: { include: { supplier: true } } },
      orderBy: [{ alertStatus: "asc" }, { material: { name: "asc" } }],
    });
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/inventory/:materialId
router.get("/:materialId", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await prisma.inventory.findUnique({
      where: { materialId: req.params.materialId },
      include: { material: { include: { supplier: true } } },
    });
    if (!row) return res.status(404).json({ error: "Inventory row not found" });
    res.json(row);
  } catch (e) { next(e); }
});

// PUT /api/inventory/:materialId
router.put("/:materialId", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = UpdateSchema.parse(req.body);
    const current = await prisma.inventory.findUnique({
      where: { materialId: req.params.materialId },
      include: { material: { include: { supplier: true } } },
    });
    if (!current) return res.status(404).json({ error: "Not found" });

    const newStock = updates.currentStock ?? current.currentStock;
    const newConsumption = updates.dailyConsumption ?? current.dailyConsumption;
    const newReorderDays = updates.reorderPointDays ?? current.reorderPointDays;
    const daysToOrder = current.material.supplier?.daysToOrder ?? 7;

    const alertStatus = computeAlertStatus(newStock, newConsumption, newReorderDays, daysToOrder);
    const quantityToOrder = newConsumption > 0
      ? Math.max(0, newConsumption * newReorderDays - newStock)
      : 0;
    const estimatedOrderCost = quantityToOrder * current.material.unitPrice;

    const updated = await prisma.inventory.update({
      where: { materialId: req.params.materialId },
      data: { ...updates, alertStatus, quantityToOrder, estimatedOrderCost },
      include: { material: { include: { supplier: true } } },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

export default router;
