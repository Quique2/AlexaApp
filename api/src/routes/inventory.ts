import { Router, Request, Response, NextFunction } from "express";
import { AlertStatus } from "@prisma/client";
import prisma from "../lib/prisma";
import { z } from "zod";
import * as XLSX from "xlsx";
import multer from "multer";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { syncInventoryState, roundQty } from "../lib/jit";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const UpdateSchema = z.object({
  currentStock: z.number().min(0).optional(),
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
      include: {
        material: { include: { supplier: true } },
        requirements: {
          where: {
            reservedQuantity: { gt: 0 },
            productionPlan: {
              signedOffAt: { not: null },
              productionStatus: { notIn: ["COMPLETED", "CANCELLED"] },
            },
          },
          select: {
            id: true,
            reservedQuantity: true,
            productionPlan: { select: { id: true, style: true, productionDate: true } },
          },
        },
      },
      orderBy: [{ alertStatus: "asc" }, { material: { name: "asc" } }],
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// GET /api/inventory/critical — items flagged as critical by JIT
router.get("/critical", requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.inventory.findMany({
      where: { isCritical: true },
      include: {
        material: { include: { supplier: true } },
        requirements: {
          where: {
            isCritical: true,
            productionPlan: {
              approvalStatus: "APPROVED",
              productionStatus: { notIn: ["COMPLETED", "CANCELLED"] },
            },
          },
          include: {
            productionPlan: { select: { id: true, style: true, productionDate: true } },
            material: { select: { name: true, unit: true } },
            linkedOrder: { select: { id: true, folio: true, estimatedArrivalDate: true, status: true } },
          },
          orderBy: { productionPlan: { productionDate: "asc" } },
        },
      },
      orderBy: [{ alertStatus: "asc" }, { material: { name: "asc" } }],
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
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
        ["id", "nombre", "unidad", "stockActual", "notas"],
        ...rows.map((r) => [
          r.material.id,
          r.material.name,
          r.material.unit,
          r.currentStock,
          r.notes ?? "",
        ]),
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, ws, "Inventario");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Disposition", "attachment; filename=inventario_template.xlsx");
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.send(buffer);
    } catch (e) {
      next(e);
    }
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
        const rowNum = i + 2;
        const row = raw[i];
        const id = String(row["id"] ?? "").trim();

        if (!id) {
          errors.push({ row: rowNum, id: "", reason: "id vacío" });
          continue;
        }

        const stockRaw = parseFloat(row["stockActual"]);

        if (isNaN(stockRaw) || stockRaw < 0) {
          errors.push({ row: rowNum, id, reason: "stockActual inválido" });
          continue;
        }

        const inv = await prisma.inventory.findUnique({ where: { materialId: id } });

        if (!inv) {
          errors.push({ row: rowNum, id, reason: "Material no encontrado" });
          continue;
        }

        await prisma.inventory.update({
          where: { materialId: id },
          data: {
            currentStock: roundQty(stockRaw),
            notes: String(row["notas"] ?? "").trim() || inv.notes,
          },
        });

        await syncInventoryState(inv.id);
        updated++;
      }

      res.json({ updated, errors, total: raw.length });
    } catch (e) {
      next(e);
    }
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
  } catch (e) {
    next(e);
  }
});

// GET /api/inventory/:materialId
router.get("/:materialId", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await prisma.inventory.findUnique({
      where: { materialId: req.params.materialId },
      include: {
        material: { include: { supplier: true } },
        requirements: {
          where: {
            productionPlan: {
              approvalStatus: "APPROVED",
              productionStatus: { notIn: ["COMPLETED", "CANCELLED"] },
            },
          },
          include: {
            productionPlan: { select: { id: true, style: true, productionDate: true } },
          },
          orderBy: { productionPlan: { productionDate: "asc" } },
        },
      },
    });
    if (!row) return res.status(404).json({ error: "Inventory row not found" });
    res.json(row);
  } catch (e) {
    next(e);
  }
});

// PUT /api/inventory/:materialId
router.put("/:materialId", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = UpdateSchema.parse(req.body);
    const updates = raw.currentStock !== undefined
      ? { ...raw, currentStock: roundQty(raw.currentStock) }
      : raw;
    const current = await prisma.inventory.findUnique({
      where: { materialId: req.params.materialId },
    });
    if (!current) return res.status(404).json({ error: "Not found" });

    const updated = await prisma.inventory.update({
      where: { materialId: req.params.materialId },
      data: updates,
      include: { material: { include: { supplier: true } } },
    });

    await syncInventoryState(current.id);

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

export default router;
