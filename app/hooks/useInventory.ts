import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi } from "../services/api";

export function useInventory(params?: { alert?: string; type?: string; search?: string }) {
  return useQuery({
    queryKey: ["inventory", params],
    queryFn: () => inventoryApi.list(params),
    refetchInterval: 30_000,
  });
}

export function useInventoryAlerts() {
  return useQuery({
    queryKey: ["inventory", "alerts"],
    queryFn: inventoryApi.alerts,
    refetchInterval: 30_000,
  });
}

export function useUpdateInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      materialId,
      data,
    }: {
      materialId: string;
      data: Partial<{ currentStock: number; dailyConsumption: number; reorderPointDays: number; notes: string }>;
    }) => inventoryApi.update(materialId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
