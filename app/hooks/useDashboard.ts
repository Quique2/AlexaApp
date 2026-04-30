import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../services/api";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: dashboardApi.summary,
    refetchInterval: 60_000,
  });
}

export function useSpendHistory() {
  return useQuery({
    queryKey: ["dashboard", "spend"],
    queryFn: dashboardApi.spend,
  });
}
