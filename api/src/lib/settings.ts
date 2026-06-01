import prisma from "./prisma";

// In-memory cache with 60s TTL to avoid DB hits on every request
const cache = new Map<string, { value: string; expiresAt: number }>();

export async function getSetting(category: string, key: string, defaultValue: string): Promise<string> {
  const cacheKey = `${category}:${key}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const row = await prisma.systemSetting.findUnique({
    where: { category_key: { category, key } },
  });
  const value = row?.value ?? defaultValue;
  cache.set(cacheKey, { value, expiresAt: Date.now() + 60_000 });
  return value;
}

export async function getSettingBool(category: string, key: string, defaultValue: boolean): Promise<boolean> {
  const v = await getSetting(category, key, String(defaultValue));
  return v === "true";
}

export async function getSettingNumber(category: string, key: string, defaultValue: number): Promise<number> {
  const v = await getSetting(category, key, String(defaultValue));
  const n = parseFloat(v);
  return isNaN(n) ? defaultValue : n;
}

// Call this after a setting changes so next request gets fresh value
export function invalidateSettingCache(category: string, key: string) {
  cache.delete(`${category}:${key}`);
}
