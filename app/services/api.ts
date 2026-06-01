import Constants from "expo-constants";
import {
  AppUser,
  AuditLog,
  AuditGroupedUser,
  BlockedEntity,
  DashboardSummary,
  GenerateOrdersPreview,
  ImportResult,
  InventoryRow,
  JITSummary,
  Material,
  Order,
  ProductionPlan,
  ProductionStatus,
  Reception,
  RecipeLine,
  RequirementAnalysis,
  Role,
  Supplier,
} from "../types";

const PRIMARY_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://alexaapp-production.up.railway.app/api";

const BACKUP_URL =
  process.env.EXPO_PUBLIC_API_URL_BACKUP ||
  "https://rrey-api-backup.onrender.com/api";

let _accessToken: string | null = null;
export const setApiToken = (token: string | null) => { _accessToken = token; };

// Tries primary URL first; falls back to backup on network error or 5xx.
async function fetchWithFailover(primaryUrl: string, backupUrl: string, options: RequestInit): Promise<Response> {
  try {
    const res = await fetch(primaryUrl, options);
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch {
    return fetch(backupUrl, options);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;
  const res = await fetchWithFailover(`${PRIMARY_URL}${path}`, `${BACKUP_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as any).error ?? "Request failed");
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return res.json();
}

async function requestRaw(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;
  return fetchWithFailover(`${PRIMARY_URL}${path}`, `${BACKUP_URL}${path}`, { ...options, headers });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export type AuthUser = { id: string; email: string; name?: string | null; role?: Role };
export type AuthResponse = { accessToken: string; refreshToken: string; user: AuthUser };

export const authApi = {
  register: (email: string, password: string, name?: string) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  refresh: (refreshToken: string) =>
    request<{ accessToken: string }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
  me: () => request<AuthUser>("/auth/me"),
  logout: (refreshToken: string) =>
    request<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
  createBiometricToken: () =>
    request<{ refreshToken: string }>("/auth/biometric-token", { method: "POST" }),
  createSession: () =>
    request<{ refreshToken: string }>("/auth/biometric-token", { method: "POST" }),
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const dashboardApi = {
  summary: (params?: { from?: string; to?: string; materialType?: string }) => {
    const qs = params
      ? "?" + new URLSearchParams(
          Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
        ).toString()
      : "";
    return request<DashboardSummary>(`/dashboard/summary${qs}`);
  },
  spend: () => request<{ month: string; total: number; orders: number }[]>("/dashboard/spend"),
  jitSummary: () => request<JITSummary>("/dashboard/jit-summary"),
};

// ─── Inventory ───────────────────────────────────────────────────────────────
export const inventoryApi = {
  list: (params?: { alert?: string; type?: string; search?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString();
    return request<InventoryRow[]>(`/inventory${qs ? `?${qs}` : ""}`);
  },
  alerts: () => request<InventoryRow[]>("/inventory/alerts"),
  critical: () => request<InventoryRow[]>("/inventory/critical"),
  get: (materialId: string) => request<InventoryRow>(`/inventory/${materialId}`),
  update: (
    materialId: string,
    data: Partial<{ currentStock: number; notes: string }>
  ) =>
    request<InventoryRow>(`/inventory/${materialId}`, { method: "PUT", body: JSON.stringify(data) }),
  downloadTemplate: async (): Promise<Blob> => {
    const res = await requestRaw("/inventory/template");
    if (!res.ok) throw new Error("Error descargando template");
    return res.blob();
  },
  import: (file: File | { uri: string; name: string; type: string }): Promise<ImportResult> => {
    const form = new FormData();
    form.append("file", file as any);
    return request<ImportResult>("/inventory/import", {
      method: "POST",
      body: form,
      headers: {},
    });
  },
};

// ─── Materials ───────────────────────────────────────────────────────────────
export const materialsApi = {
  list: (params?: { type?: string; search?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString();
    return request<Material[]>(`/materials${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<Material>(`/materials/${id}`),
  create: (data: Omit<Material, "supplier" | "inventory" | "createdAt" | "updatedAt">) =>
    request<Material>("/materials", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Material>) =>
    request<Material>(`/materials/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updatePrice: (id: string, unitPrice: number, priceUnit?: string) =>
    request<Material>(`/materials/${id}/price`, {
      method: "PUT",
      body: JSON.stringify({ unitPrice, priceUnit }),
    }),
  delete: (id: string) => request<void>(`/materials/${id}`, { method: "DELETE" }),
};

// ─── Production ──────────────────────────────────────────────────────────────
export const productionApi = {
  list: (params?: { from?: string; to?: string; style?: string; productionStatus?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString();
    return request<ProductionPlan[]>(`/production${qs ? `?${qs}` : ""}`);
  },
  pending: () => request<ProductionPlan[]>("/production/pending"),
  upcoming: () => request<ProductionPlan[]>("/production/upcoming"),
  get: (id: string) => request<ProductionPlan>(`/production/${id}`),
  create: (data: {
    productionDate: string;
    style: string;
    plannedBatches: number;
    maltKgPerBatch: number;
    hopKgPerBatch: number;
    yeastGPerBatch: number;
    notes?: string | null;
    orderedAt?: string | null;
  }) =>
    request<ProductionPlan>("/production", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ProductionPlan>) =>
    request<ProductionPlan>(`/production/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/production/${id}`, { method: "DELETE" }),
  approve: (id: string) =>
    request<ProductionPlan>(`/production/${id}/approve`, { method: "POST" }),
  reject: (id: string, reason?: string) =>
    request<ProductionPlan>(`/production/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  updateStatus: (id: string, productionStatus: Exclude<ProductionStatus, "PENDING">) =>
    request<ProductionPlan>(`/production/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ productionStatus }),
    }),
  jitAnalysis: (id: string) =>
    request<{ plan: ProductionPlan; analysis: RequirementAnalysis[] }>(
      `/production/${id}/jit-analysis`
    ),
  recalculateJIT: (id: string) =>
    request<ProductionPlan>(`/production/${id}/recalculate-jit`, { method: "POST" }),
  signOff: (id: string) =>
    request<ProductionPlan>(`/production/${id}/sign-off`, { method: "POST" }),
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: (params?: { status?: string; materialId?: string; productionPlanId?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString();
    return request<Order[]>(`/orders${qs ? `?${qs}` : ""}`);
  },
  monthlySummary: () =>
    request<{ month: string; totalPaid: number; orderCount: number; avgPerOrder: number }[]>(
      "/orders/summary/monthly"
    ),
  get: (id: string) => request<Order>(`/orders/${id}`),
  create: (
    data: Omit<Order, "id" | "folio" | "month" | "material" | "supplier" | "productionPlan" | "receptions" | "createdAt" | "updatedAt">
  ) =>
    request<Order>("/orders", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Order>) =>
    request<Order>(`/orders/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  confirmReceived: (
    id: string,
    data: {
      receivedQuantity: number;
      condition?: string;
      batchLot?: string | null;
      receivedBy?: string | null;
      notes?: string | null;
      isConforming?: boolean;
    }
  ) =>
    request<{ reception: Reception; orderStatus: string; totalReceived: number }>(
      `/orders/${id}/confirm-received`,
      { method: "PATCH", body: JSON.stringify(data) }
    ),
  delete: (id: string) => request<void>(`/orders/${id}`, { method: "DELETE" }),
};

// ─── Receptions ──────────────────────────────────────────────────────────────
export const receptionsApi = {
  list: (orderId?: string) =>
    request<Reception[]>(`/receptions${orderId ? `?orderId=${orderId}` : ""}`),
  get: (id: string) => request<Reception>(`/receptions/${id}`),
  create: (data: Omit<Reception, "id" | "order" | "createdAt">) =>
    request<Reception>("/receptions", { method: "POST", body: JSON.stringify(data) }),
};

// ─── Styles ──────────────────────────────────────────────────────────────────
export const stylesApi = {
  list: () => request<{ name: string; imageUri: string | null }[]>("/styles"),
  upsert: (name: string, imageUri?: string | null) =>
    request<{ name: string; imageUri: string | null }>("/styles", {
      method: "POST",
      body: JSON.stringify({ name, imageUri }),
    }),
  update: (oldName: string, data: { name?: string; imageUri?: string | null }) =>
    request<{ name: string; imageUri: string | null }>(`/styles/${encodeURIComponent(oldName)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (name: string) =>
    request<void>(`/styles/${encodeURIComponent(name)}`, { method: "DELETE" }),
};

// ─── Recipes ─────────────────────────────────────────────────────────────────
export const recipesApi = {
  styles: () => request<string[]>("/recipes/styles"),
  list: (style?: string) =>
    request<RecipeLine[]>(`/recipes${style ? `?style=${encodeURIComponent(style)}` : ""}`),
  create: (data: { beerStyle: string; materialId: string; qtyPerBatch: number; notes?: string }) =>
    request<RecipeLine>("/recipes", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { qtyPerBatch: number; notes?: string }) =>
    request<RecipeLine>(`/recipes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/recipes/${id}`, { method: "DELETE" }),
  previewOrders: (planId: string) =>
    request<GenerateOrdersPreview>(`/production/${planId}/generate-orders?confirm=false`, { method: "POST" }),
  confirmOrders: (planId: string) =>
    request<{ created: Order[]; skipped: number }>(`/production/${planId}/generate-orders?confirm=true`, { method: "POST" }),
};

// ─── Suppliers ───────────────────────────────────────────────────────────────
export const suppliersApi = {
  list: () => request<(Supplier & { _count: { materials: number; orders: number } })[]>("/suppliers"),
  get: (id: string) => request<Supplier>(`/suppliers/${id}`),
  update: (id: string, data: Partial<Supplier>) =>
    request<Supplier>(`/suppliers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const usersApi = {
  list: () => request<AppUser[]>("/users"),
  get: (id: string) => request<AppUser>(`/users/${id}`),
  create: (data: { email: string; password: string; name?: string; role: Role }) =>
    request<AppUser>("/users", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; role?: Role; isActive?: boolean }) =>
    request<AppUser>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  resetPassword: (id: string, password: string) =>
    request<{ ok: boolean }>(`/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
};

// ─── Audit ───────────────────────────────────────────────────────────────────
type AuditListParams = {
  limit?: number;
  offset?: number;
  userId?: string;
  search?: string;
  action?: string;
  entityType?: string;
  onlyChanges?: boolean;
};

function buildAuditQs(params?: AuditListParams): string {
  if (!params) return "";
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)])
  ).toString();
  return qs ? `?${qs}` : "";
}

export const auditApi = {
  list: (params?: AuditListParams) =>
    request<{ logs: AuditLog[]; total: number; limit: number; offset: number }>(
      `/audit${buildAuditQs(params)}`
    ),
  recent: () => request<AuditLog[]>("/audit/recent"),
  groupedByUser: () => request<AuditGroupedUser[]>("/audit/grouped-by-user"),
  listForUser: (userId: string, params?: Omit<AuditListParams, "userId">) =>
    request<{ logs: AuditLog[]; total: number; limit: number; offset: number }>(
      `/audit/user/${userId}${buildAuditQs(params)}`
    ),
  exportUrl: (params?: AuditListParams) =>
    `${(typeof process !== "undefined" ? process.env.EXPO_PUBLIC_API_URL : undefined) ?? "https://alexaapp-production.up.railway.app/api"}/audit/export${buildAuditQs(params)}`,
  exportRaw: (params?: AuditListParams) =>
    requestRaw(`/audit/export${buildAuditQs(params)}`),
};

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminApi = {
  listBlocked: () => request<BlockedEntity[]>("/admin/blocked"),
  block: (data: { type: "EMAIL" | "IP"; value: string; reason?: string }) =>
    request<BlockedEntity>("/admin/blocked", { method: "POST", body: JSON.stringify(data) }),
  unblock: (id: string) => request<void>(`/admin/blocked/${id}`, { method: "DELETE" }),
};
