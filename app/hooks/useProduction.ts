import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productionApi } from "../services/api";
import type { ProductionPlan, ProductionStatus } from "../types";

export function useProductionPlans(params?: { from?: string; to?: string; style?: string; productionStatus?: string }) {
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
    mutationFn: (data: {
      productionDate: string;
      style: string;
      plannedBatches: number;
      maltKgPerBatch: number;
      hopKgPerBatch: number;
      yeastGPerBatch: number;
      notes?: string | null;
      orderedAt?: string | null;
    }) => productionApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
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
      qc.invalidateQueries({ queryKey: ["inventory"] });
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

export function useUpdateProductionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      productionStatus,
    }: {
      id: string;
      productionStatus: Exclude<ProductionStatus, "PENDING">;
    }) => productionApi.updateStatus(id, productionStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteProductionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productionApi.delete(id),
    onSuccess: (_, id) => {
      qc.setQueriesData<ProductionPlan[]>({ queryKey: ["production"] }, (old) =>
        Array.isArray(old) ? old.filter((p) => p.id !== id) : old
      );
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useJITAnalysis(planId: string | null) {
  return useQuery({
    queryKey: ["production", planId, "jit-analysis"],
    queryFn: () => productionApi.jitAnalysis(planId!),
    enabled: !!planId,
  });
}

export function useRecalculateJIT() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productionApi.recalculateJIT(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["production"] });
      qc.invalidateQueries({ queryKey: ["production", id, "jit-analysis"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
