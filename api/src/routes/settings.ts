import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { logAudit, extractIp } from "../lib/audit";
import { invalidateSettingCache } from "../lib/settings";

const router = Router();

// ─── Settings schema (source of truth for defaults, types, labels) ────────────

type ValueType = "number" | "boolean" | "string" | "select";

interface SettingDef {
  key: string;
  label: string;
  description?: string;
  valueType: ValueType;
  defaultValue: string;
  editableByRole: "DEVELOPER" | "SUPERVISOR";
  options?: string[]; // for select type
  min?: number;
  max?: number;
}

const SETTINGS_SCHEMA: Record<string, SettingDef[]> = {
  general: [
    { key: "companyName",         label: "Nombre de empresa",          valueType: "string",  defaultValue: "Cervecería Rrëy",      editableByRole: "SUPERVISOR" },
    { key: "currency",            label: "Moneda",                     valueType: "select",  defaultValue: "MXN",                  editableByRole: "DEVELOPER",  options: ["MXN", "USD", "EUR"] },
    { key: "defaultWeightUnit",   label: "Unidad de peso default",     valueType: "select",  defaultValue: "kg",                   editableByRole: "SUPERVISOR", options: ["kg", "g", "lb"] },
    { key: "timezone",            label: "Zona horaria",               valueType: "select",  defaultValue: "America/Monterrey",    editableByRole: "DEVELOPER",  options: ["America/Monterrey", "America/Mexico_City", "America/Cancun", "UTC"] },
    { key: "defaultDashboardDays",label: "Días visibles en dashboard", valueType: "number",  defaultValue: "7",                    editableByRole: "SUPERVISOR", min: 1, max: 90, description: "Rango de días que se carga por defecto al abrir el Dashboard" },
  ],
  dashboard: [
    { key: "showProductionCalendar", label: "Mostrar calendario de producción", valueType: "boolean", defaultValue: "true",  editableByRole: "SUPERVISOR" },
    { key: "showSpendCard",          label: "Mostrar card de gasto",            valueType: "boolean", defaultValue: "true",  editableByRole: "SUPERVISOR" },
    { key: "showJITStrip",           label: "Mostrar tira JIT",                 valueType: "boolean", defaultValue: "true",  editableByRole: "SUPERVISOR" },
    { key: "upcomingPlansLimit",     label: "Planes visibles en dashboard",     valueType: "number",  defaultValue: "4",     editableByRole: "SUPERVISOR", min: 1, max: 20 },
    { key: "urgentItemsLimit",       label: "Alertas visibles en dashboard",    valueType: "number",  defaultValue: "5",     editableByRole: "SUPERVISOR", min: 1, max: 20 },
  ],
  inventory: [
    { key: "showPricesToOperators",  label: "Mostrar precios a Operadores",  valueType: "boolean", defaultValue: "false", editableByRole: "SUPERVISOR" },
    { key: "allowNegativeStock",     label: "Permitir stock negativo",       valueType: "boolean", defaultValue: "false", editableByRole: "DEVELOPER",  description: "Permite que el stock de inventario sea negativo al consumir" },
    { key: "showCriticalFirst",      label: "Mostrar críticos primero",      valueType: "boolean", defaultValue: "true",  editableByRole: "SUPERVISOR" },
    { key: "defaultUnit",            label: "Unidad default",                valueType: "string",  defaultValue: "kg",    editableByRole: "SUPERVISOR" },
  ],
  production: [
    { key: "requireApproval",        label: "Requiere aprobación supervisor", valueType: "boolean", defaultValue: "true",    editableByRole: "DEVELOPER",  description: "Si está desactivado, cualquier usuario puede auto-aprobar" },
    { key: "operatorsCanCreate",     label: "Operadores pueden crear planes", valueType: "boolean", defaultValue: "true",    editableByRole: "SUPERVISOR" },
    { key: "allowEditApproved",      label: "Permitir editar plan aprobado", valueType: "boolean", defaultValue: "false",   editableByRole: "DEVELOPER" },
    { key: "allowCancelApproved",    label: "Permitir cancelar aprobado",    valueType: "boolean", defaultValue: "true",    editableByRole: "SUPERVISOR" },
    { key: "defaultVisibleDays",     label: "Días visibles por defecto",     valueType: "number",  defaultValue: "30",      editableByRole: "SUPERVISOR", min: 7, max: 365 },
  ],
  orders: [
    { key: "allowPartialReception",   label: "Permitir recepción parcial",        valueType: "boolean", defaultValue: "true",  editableByRole: "SUPERVISOR" },
    { key: "allowCloseIncomplete",    label: "Permitir cerrar pedido incompleto", valueType: "boolean", defaultValue: "false", editableByRole: "SUPERVISOR" },
    { key: "defaultETADays",          label: "Días ETA si proveedor sin lead time", valueType: "number", defaultValue: "7",   editableByRole: "SUPERVISOR", min: 1, max: 90 },
    { key: "recalcInventoryOnReceive",label: "Recalcular inventario al recibir",  valueType: "boolean", defaultValue: "true", editableByRole: "DEVELOPER" },
  ],
  recipes: [
    { key: "allowIncompletePrice",   label: "Permitir receta sin precios completos", valueType: "boolean", defaultValue: "true",  editableByRole: "SUPERVISOR" },
    { key: "allowNoSupplier",        label: "Permitir ingrediente sin proveedor",    valueType: "boolean", defaultValue: "true",  editableByRole: "SUPERVISOR" },
    { key: "validateBeforeProduction",label: "Validar receta antes de producción",   valueType: "boolean", defaultValue: "true",  editableByRole: "SUPERVISOR" },
    { key: "roundingDecimals",       label: "Decimales en cantidades",               valueType: "number",  defaultValue: "3",     editableByRole: "DEVELOPER", min: 0, max: 6 },
  ],
  audit: [
    { key: "recentAuditLimit",      label: "Movimientos recientes visibles",  valueType: "number",  defaultValue: "50",   editableByRole: "SUPERVISOR", min: 10, max: 200 },
    { key: "enableChangeTracking",  label: "Registrar cambios before/after", valueType: "boolean", defaultValue: "true", editableByRole: "DEVELOPER" },
    { key: "enableExcelExport",     label: "Permitir exportar a Excel",      valueType: "boolean", defaultValue: "true", editableByRole: "DEVELOPER" },
    { key: "showIPAddress",         label: "Mostrar dirección IP",           valueType: "boolean", defaultValue: "true", editableByRole: "DEVELOPER" },
    { key: "logLoginLogout",        label: "Registrar login/logout",         valueType: "boolean", defaultValue: "true", editableByRole: "DEVELOPER" },
  ],
  security: [
    { key: "passwordMinLength",     label: "Longitud mínima de contraseña", valueType: "number",  defaultValue: "8",    editableByRole: "DEVELOPER", min: 6, max: 32 },
    { key: "allowPublicRegister",   label: "Permitir registro público",     valueType: "boolean", defaultValue: "false",editableByRole: "DEVELOPER", description: "Si está activado, cualquiera puede crear una cuenta" },
    { key: "sessionExpirationDays", label: "Expiración de sesión (días)",   valueType: "number",  defaultValue: "30",   editableByRole: "DEVELOPER", min: 1, max: 365 },
    { key: "maxLoginAttempts",      label: "Intentos máximos de login",     valueType: "number",  defaultValue: "5",    editableByRole: "DEVELOPER", min: 3, max: 20 },
  ],
  notifications: [
    { key: "alertCriticalMaterials", label: "Alertar materiales críticos",   valueType: "boolean", defaultValue: "true",  editableByRole: "SUPERVISOR", description: "Próximamente" },
    { key: "alertLateOrders",        label: "Alertar pedidos tardíos",       valueType: "boolean", defaultValue: "true",  editableByRole: "SUPERVISOR", description: "Próximamente" },
    { key: "alertPendingApproval",   label: "Alertar aprobación pendiente",  valueType: "boolean", defaultValue: "true",  editableByRole: "SUPERVISOR", description: "Próximamente" },
    { key: "alertPriceChanges",      label: "Alertar cambios de precio",     valueType: "boolean", defaultValue: "false", editableByRole: "SUPERVISOR", description: "Próximamente" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getActorRole(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, name: true, email: true } });
  return user?.role ?? "OPERATOR";
}

async function getActorName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  return user?.name ?? user?.email ?? userId;
}

function canEdit(actorRole: string, settingRole: "DEVELOPER" | "SUPERVISOR"): boolean {
  if (actorRole === "DEVELOPER") return true;
  if (actorRole === "SUPERVISOR" && settingRole === "SUPERVISOR") return true;
  return false;
}

async function mergeCategoryWithDB(category: string): Promise<any[]> {
  const schema = SETTINGS_SCHEMA[category] ?? [];
  const dbRows = await prisma.systemSetting.findMany({ where: { category } });
  const dbMap = new Map(dbRows.map((r) => [r.key, r.value]));

  return schema.map((def) => ({
    ...def,
    value: dbMap.get(def.key) ?? def.defaultValue,
    isDefault: !dbMap.has(def.key),
    updatedAt: dbRows.find((r) => r.key === def.key)?.updatedAt ?? null,
  }));
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/settings — all categories with their settings
router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = (req as AuthRequest).userId;
    const role = await getActorRole(actorId);
    if (role === "OPERATOR" || role === "TRANSPORTER") {
      return res.status(403).json({ error: "Acceso no autorizado" });
    }

    const result: Record<string, any[]> = {};
    for (const category of Object.keys(SETTINGS_SCHEMA)) {
      result[category] = await mergeCategoryWithDB(category);
    }

    // JIT is handled via /api/config but we include it here for UI
    const jitConfig = await prisma.jITConfig.findUnique({ where: { id: 1 } });
    result.jit = [
      { key: "safetyBufferDays",    label: "Días de margen JIT",           valueType: "number", value: String(jitConfig?.safetyBufferDays    ?? 1),  defaultValue: "1",  editableByRole: "SUPERVISOR", min: 0, max: 14, description: "Días extra requeridos antes de la fecha de producción" },
      { key: "workingDaysPerWeek",  label: "Días laborables por semana",   valueType: "number", value: String(jitConfig?.workingDaysPerWeek  ?? 5),  defaultValue: "5",  editableByRole: "SUPERVISOR", min: 1, max: 7 },
      { key: "maxDaysRawMaterial",  label: "Días máximos materia prima",   valueType: "number", value: String(jitConfig?.maxDaysRawMaterial  ?? 7),  defaultValue: "7",  editableByRole: "SUPERVISOR", min: 1, max: 90 },
      { key: "hopCoverageDays",     label: "Cobertura lúpulo (días)",      valueType: "number", value: String(jitConfig?.hopCoverageDays     ?? 90), defaultValue: "90", editableByRole: "SUPERVISOR", min: 1, max: 365 },
      { key: "yeastCoverageDays",   label: "Cobertura levadura (días)",    valueType: "number", value: String(jitConfig?.yeastCoverageDays   ?? 15), defaultValue: "15", editableByRole: "SUPERVISOR", min: 1, max: 60 },
      { key: "avgDailyProduction",  label: "Producción diaria promedio",   valueType: "number", value: String(jitConfig?.avgDailyProduction  ?? 1),  defaultValue: "1",  editableByRole: "DEVELOPER", min: 0.1 },
    ];

    res.json(result);
  } catch (e) { next(e); }
});

// GET /api/settings/:category
router.get("/:category", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = (req as AuthRequest).userId;
    const role = await getActorRole(actorId);
    if (role === "OPERATOR" || role === "TRANSPORTER") {
      return res.status(403).json({ error: "Acceso no autorizado" });
    }
    const { category } = req.params;
    if (category === "jit") {
      const jitConfig = await prisma.jITConfig.findUnique({ where: { id: 1 } });
      return res.json({ category: "jit", config: jitConfig });
    }
    if (!SETTINGS_SCHEMA[category]) return res.status(404).json({ error: "Categoría no encontrada" });
    const settings = await mergeCategoryWithDB(category);
    res.json({ category, settings });
  } catch (e) { next(e); }
});

// PUT /api/settings/:category/:key
router.put("/:category/:key", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = (req as AuthRequest).userId;
    const role = await getActorRole(actorId);
    if (role === "OPERATOR" || role === "TRANSPORTER") {
      return res.status(403).json({ error: "Acceso no autorizado" });
    }

    const { category, key } = req.params;
    const { value } = z.object({ value: z.string() }).parse(req.body);

    // JIT settings go through JITConfig
    if (category === "jit") {
      const jitFields: Record<string, any> = {
        safetyBufferDays: (v: string) => ({ safetyBufferDays: parseInt(v) }),
        workingDaysPerWeek: (v: string) => ({ workingDaysPerWeek: parseInt(v) }),
        maxDaysRawMaterial: (v: string) => ({ maxDaysRawMaterial: parseInt(v) }),
        hopCoverageDays: (v: string) => ({ hopCoverageDays: parseInt(v) }),
        yeastCoverageDays: (v: string) => ({ yeastCoverageDays: parseInt(v) }),
        avgDailyProduction: (v: string) => ({ avgDailyProduction: parseFloat(v) }),
      };
      if (!jitFields[key]) return res.status(404).json({ error: "Ajuste JIT no encontrado" });
      const current = await prisma.jITConfig.findUnique({ where: { id: 1 } });
      const updated = await prisma.jITConfig.upsert({
        where: { id: 1 },
        update: jitFields[key](value),
        create: { id: 1, ...jitFields[key](value) },
      });
      await logAudit({
        userId: actorId,
        action: "SETTING_UPDATED",
        entityType: "SystemSetting",
        entityName: `JIT · ${key}`,
        description: `Ajuste JIT actualizado: ${key}`,
        ipAddress: extractIp(req),
        changes: [{ field: key, label: key, oldValue: (current as any)?.[key] ?? null, newValue: value }],
      });
      return res.json(updated);
    }

    // All other categories
    const schema = SETTINGS_SCHEMA[category];
    if (!schema) return res.status(404).json({ error: "Categoría no encontrada" });
    const def = schema.find((s) => s.key === key);
    if (!def) return res.status(404).json({ error: "Ajuste no encontrado" });

    if (!canEdit(role, def.editableByRole)) {
      return res.status(403).json({ error: "Sin permisos para editar este ajuste" });
    }

    // Type validation
    if (def.valueType === "number") {
      const num = parseFloat(value);
      if (isNaN(num)) return res.status(400).json({ error: "Valor numérico inválido" });
      if (def.min !== undefined && num < def.min) return res.status(400).json({ error: `Mínimo: ${def.min}` });
      if (def.max !== undefined && num > def.max) return res.status(400).json({ error: `Máximo: ${def.max}` });
    }
    if (def.valueType === "boolean" && !["true", "false"].includes(value)) {
      return res.status(400).json({ error: "Valor booleano inválido" });
    }
    if (def.valueType === "select" && def.options && !def.options.includes(value)) {
      return res.status(400).json({ error: `Opciones válidas: ${def.options.join(", ")}` });
    }

    const existing = await prisma.systemSetting.findUnique({ where: { category_key: { category, key } } });
    const setting = await prisma.systemSetting.upsert({
      where: { category_key: { category, key } },
      update: { value, updatedById: actorId },
      create: { category, key, value, updatedById: actorId },
    });

    invalidateSettingCache(category, key);

    await logAudit({
      userId: actorId,
      action: "SETTING_UPDATED",
      entityType: "SystemSetting",
      entityName: `${category} · ${def.label}`,
      description: `Ajuste actualizado: ${def.label}`,
      ipAddress: extractIp(req),
      changes: [{ field: key, label: def.label, oldValue: existing?.value ?? def.defaultValue, newValue: value }],
    });

    res.json({ ...def, value: setting.value, updatedAt: setting.updatedAt });
  } catch (e) { next(e); }
});

// POST /api/settings/reset/:category/:key — reset to default
router.post("/reset/:category/:key", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = (req as AuthRequest).userId;
    const role = await getActorRole(actorId);
    if (role !== "DEVELOPER") return res.status(403).json({ error: "Solo DEVELOPER puede resetear ajustes" });

    const { category, key } = req.params;
    await prisma.systemSetting.deleteMany({ where: { category, key } });
    const def = SETTINGS_SCHEMA[category]?.find((s) => s.key === key);
    res.json({ category, key, value: def?.defaultValue ?? null, isDefault: true });
  } catch (e) { next(e); }
});

export { SETTINGS_SCHEMA };
export default router;
