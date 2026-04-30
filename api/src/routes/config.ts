import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { z } from "zod";

const router = Router();

const ConfigSchema = z.object({
  workingDaysPerWeek: z.number().int().min(1).max(7).optional(),
  maxDaysRawMaterial: z.number().int().min(1).optional(),
  hopCoverageDays: z.number().int().min(1).optional(),
  yeastCoverageDays: z.number().int().min(1).optional(),
  safetyBufferDays: z.number().int().min(0).optional(),
  avgDailyProduction: z.number().min(0).optional(),
});

// GET /api/config
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await prisma.jITConfig.findUnique({ where: { id: 1 } });
    res.json(config);
  } catch (e) {
    next(e);
  }
});

// PUT /api/config
router.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = ConfigSchema.parse(req.body);
    const config = await prisma.jITConfig.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });
    res.json(config);
  } catch (e) {
    next(e);
  }
});

export default router;

