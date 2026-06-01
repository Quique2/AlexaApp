import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../services/api";

export interface DashboardParams {
  from: string;
  to: string;
  materialType?: string;
}

export function useDashboardSummary(params?: DashboardParams) {
  return useQuery({
    queryKey: ["dashboard", "summary", params],
    queryFn: () => dashboardApi.summary(params),
    refetchInterval: 60_000,
  });
}

export function useSpendHistory() {
  return useQuery({
    queryKey: ["dashboard", "spend"],
    queryFn: dashboardApi.spend,
  });
}

export function useJITSummary() {
  return useQuery({
    queryKey: ["dashboard", "jit-summary"],
    queryFn: dashboardApi.jitSummary,
    refetchInterval: 60_000,
  });
}
