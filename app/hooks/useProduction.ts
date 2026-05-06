import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productionApi } from "../services/api";
import type { ProductionPlan } from "../types";

export function useProductionPlans(params?: { from?: string; to?: string; style?: string }) {
  return useQuery({
    queryKey: ["production", params],
    queryFn: () => productionApi.list(params),
  });
}

export function usePendingProduction() {
  return useQuery({
    queryKey: ["production", "pending"],
    queryFn: productionApi.pending,
    refetchInterval: 30_000,
  });
}

export function useUpcomingProduction() {
  return useQuery({
    queryKey: ["production", "upcoming"],
    queryFn: productionApi.upcoming,
    refetchInterval: 60_000,
  });
}

export function useCreateProductionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<ProductionPlan, "id" | "totalMaltKg" | "totalHopKg" | "totalYeastG" | "approvalStatus" | "approvedById" | "approvedAt" | "rejectedById" | "rejectedAt" | "rejectionReason" | "hasMissingPrices" | "estimatedCost" | "createdById" | "createdAt" | "updatedAt">) =>
      productionApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useApproveProductionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productionApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useRejectProductionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      productionApi.reject(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production"] });
    },
  });
}

export function useDeleteProductionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productionApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
