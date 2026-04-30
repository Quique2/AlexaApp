import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ordersApi } from "../services/api";
import type { Order } from "../types";

export function useOrders(params?: { status?: string; materialId?: string }) {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: () => ordersApi.list(params),
    refetchInterval: 30_000,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      data: Omit<Order, "id" | "folio" | "month" | "material" | "supplier" | "receptions" | "createdAt" | "updatedAt">
    ) => ordersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Order> }) =>
      ordersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
