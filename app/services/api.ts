import Constants from "expo-constants";
import {
  AppUser,
  BlockedEntity,
  DashboardSummary,
  GenerateOrdersPreview,
  ImportResult,
  InventoryRow,
  Material,
  Order,
  ProductionPlan,
  Reception,
  RecipeLine,
  Role,
  Supplier,
} from "../types";

const BASE_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://alexaapp-production.up.railway.app/api";

let _accessToken: string | null = null;
export const setApiToken = (token: string | null) => { _accessToken = token; };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as any).error ?? "Request failed");
  }
  return res.json();
}

async function requestRaw(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;
  return fetch(url, { ...options, headers });
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
  summary: () => request<DashboardSummary>("/dashboard/summary"),
  spend: () => request<{ month: string; total: number; orders: number }[]>("/dashboard/spend"),
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
  get: (materialId: string) => request<InventoryRow>(`/inventory/${materialId}`),
  update: (
    materialId: string,
    data: Partial<{ currentStock: number; dailyConsumption: number; reorderPointDays: number; notes: string }>
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
  list: (params?: { from?: string; to?: string; style?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString();
    return request<ProductionPlan[]>(`/production${qs ? `?${qs}` : ""}`);
  },
  pending: () => request<ProductionPlan[]>("/production/pending"),
  upcoming: () => request<ProductionPlan[]>("/production/upcoming"),
  get: (id: string) => request<ProductionPlan>(`/production/${id}`),
  create: (data: Omit<ProductionPlan, "id" | "totalMaltKg" | "totalHopKg" | "totalYeastG" | "approvalStatus" | "approvedById" | "approvedAt" | "rejectedById" | "rejectedAt" | "rejectionReason" | "hasMissingPrices" | "estimatedCost" | "createdById" | "createdAt" | "updatedAt">) =>
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
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: (params?: { status?: string; materialId?: string }) => {
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
  create: (data: Omit<Order, "id" | "folio" | "month" | "material" | "supplier" | "receptions" | "createdAt" | "updatedAt">) =>
    request<Order>("/orders", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Order>) =>
    request<Order>(`/orders/${id}`, { method: "PUT", body: JSON.stringify(data) }),
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

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminApi = {
  listBlocked: () => request<BlockedEntity[]>("/admin/blocked"),
  block: (data: { type: "EMAIL" | "IP"; value: string; reason?: string }) =>
    request<BlockedEntity>("/admin/blocked", { method: "POST", body: JSON.stringify(data) }),
  unblock: (id: string) => request<void>(`/admin/blocked/${id}`, { method: "DELETE" }),
};
