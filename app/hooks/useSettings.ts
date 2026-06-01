import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "../services/api";
import type { SettingsMap } from "../types";

export function useSettings() {
  return useQuery<SettingsMap>({
    queryKey: ["settings"],
    queryFn: settingsApi.all,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useSetting(category: string, key: string, defaultValue: string): string {
  const { data } = useSettings();
  return data?.[category]?.find((s) => s.key === key)?.value ?? defaultValue;
}

export function useSettingBool(category: string, key: string, defaultValue: boolean): boolean {
  const v = useSetting(category, key, String(defaultValue));
  return v === "true";
}

export function useSettingNumber(category: string, key: string, defaultValue: number): number {
  const v = useSetting(category, key, String(defaultValue));
  const n = parseFloat(v);
  return isNaN(n) ? defaultValue : n;
}
